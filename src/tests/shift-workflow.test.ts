import { describe, it, expect, beforeEach, vi } from 'vitest';
import PocketBase from 'pocketbase';

describe('Shift Workflow and Scheduling Tests', () => {
  let pb: PocketBase;
  
  beforeEach(() => {
    vi.clearAllMocks();
    pb = new PocketBase();
  });

  describe('Shift Status Workflow', () => {
    it('should handle complete shift lifecycle', async () => {
      const mockUpdate = vi.fn();

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      // 1. Shift created (scheduled status)
      let currentShift = {
        id: 'shift-1',
        staff_member: global.testUser.server.id,
        shift_date: '2024-01-15',
        start_time: '17:00',
        end_time: '23:00',
        position: 'server',
        status: 'scheduled'
      };

      // 2. Staff member confirms shift
      mockUpdate.mockResolvedValueOnce({
        ...currentShift,
        status: 'confirmed',
        notes: 'Confirmed by staff member'
      });

      currentShift = await pb.collection('shifts').update('shift-1', {
        status: 'confirmed',
        notes: 'Confirmed by staff member'
      });

      // 3. Shift completed
      mockUpdate.mockResolvedValueOnce({
        ...currentShift,
        status: 'completed',
        notes: 'Shift completed successfully'
      });

      await pb.collection('shifts').update('shift-1', {
        status: 'completed',
        notes: 'Shift completed successfully'
      });

      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it('should validate shift status transitions', () => {
      const validTransitions = {
        'scheduled': ['confirmed', 'cancelled'],
        'confirmed': ['completed', 'no_show', 'cancelled'],
        'completed': [],
        'cancelled': ['scheduled'], // Can reschedule cancelled shifts
        'no_show': []
      };

      Object.entries(validTransitions).forEach(([currentStatus, allowedNextStatuses]) => {
        allowedNextStatuses.forEach(nextStatus => {
          expect(isValidStatusTransition(currentStatus, nextStatus)).toBe(true);
        });

        const allStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];
        const invalidStatuses = allStatuses.filter(status => !allowedNextStatuses.includes(status) && status !== currentStatus);
        
        invalidStatuses.forEach(invalidStatus => {
          expect(isValidStatusTransition(currentStatus, invalidStatus)).toBe(false);
        });
      });
    });

    it('should handle shift cancellation workflow', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'shift-1',
        status: 'cancelled',
        notes: 'Cancelled due to illness - 4 hours notice'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      await pb.collection('shifts').update('shift-1', {
        status: 'cancelled',
        notes: 'Cancelled due to illness - 4 hours notice'
      });

      expect(mockUpdate).toHaveBeenCalledWith('shift-1', {
        status: 'cancelled',
        notes: 'Cancelled due to illness - 4 hours notice'
      });
    });

    it('should handle no-show tracking', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'shift-1',
        status: 'no_show',
        notes: 'Staff member did not appear for shift'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      await pb.collection('shifts').update('shift-1', {
        status: 'no_show',
        notes: 'Staff member did not appear for shift'
      });

      expect(mockUpdate).toHaveBeenCalledWith('shift-1', {
        status: 'no_show',
        notes: 'Staff member did not appear for shift'
      });
    });
  });

  describe('Shift Scheduling and Planning', () => {
    it('should detect shift conflicts for same staff member', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'shift1',
            staff_member: global.testUser.server.id,
            shift_date: '2024-01-15',
            start_time: '17:00',
            end_time: '23:00',
            status: 'confirmed'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const existingShifts = await pb.collection('shifts').getList(1, 100, {
        filter: `staff_member = "${global.testUser.server.id}" && shift_date = "2024-01-15" && status != "cancelled"`
      });

      const newShift = {
        staff_member: global.testUser.server.id,
        shift_date: '2024-01-15',
        start_time: '20:00',
        end_time: '02:00'
      };

      const hasConflict = checkShiftConflict(existingShifts.items, newShift);
      expect(hasConflict).toBe(true);
    });

    it('should generate weekly schedule template', () => {
      const scheduleTemplate = {
        monday: [
          { position: 'manager', start_time: '08:00', end_time: '16:00' },
          { position: 'server', start_time: '11:00', end_time: '19:00' },
          { position: 'chef', start_time: '10:00', end_time: '22:00' }
        ],
        tuesday: [
          { position: 'server', start_time: '17:00', end_time: '23:00' },
          { position: 'bartender', start_time: '16:00', end_time: '00:00' }
        ]
      };

      const weekStartDate = '2024-01-15'; // Monday
      const generatedShifts = generateWeeklyShifts(scheduleTemplate, weekStartDate, global.testUser.server.id);

      expect(generatedShifts).toHaveLength(5); // 3 Monday + 2 Tuesday shifts
      expect(generatedShifts[0].shift_date).toBe('2024-01-15'); // Monday
      expect(generatedShifts[3].shift_date).toBe('2024-01-16'); // Tuesday
    });

    it('should calculate optimal staffing levels', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { position: 'server', shift_date: '2024-01-15', start_time: '17:00', end_time: '23:00' },
          { position: 'server', shift_date: '2024-01-15', start_time: '17:30', end_time: '23:30' },
          { position: 'bartender', shift_date: '2024-01-15', start_time: '18:00', end_time: '01:00' },
          { position: 'chef', shift_date: '2024-01-15', start_time: '16:00', end_time: '00:00' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const dayShifts = await pb.collection('shifts').getList(1, 100, {
        filter: 'shift_date = "2024-01-15" && status != "cancelled"'
      });

      const staffingLevels = calculateStaffingLevels(dayShifts.items);

      expect(staffingLevels['18:00'].server).toBe(2);
      expect(staffingLevels['18:00'].bartender).toBe(1);
      expect(staffingLevels['18:00'].chef).toBe(1);
    });

    it('should identify coverage gaps', () => {
      const requiredCoverage = {
        'server': { min: 2, hours: ['17:00', '18:00', '19:00', '20:00', '21:00', '22:00'] },
        'bartender': { min: 1, hours: ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00'] }
      };

      const currentStaffing = {
        '17:00': { server: 1, bartender: 0 },
        '18:00': { server: 2, bartender: 1 },
        '19:00': { server: 2, bartender: 1 },
        '20:00': { server: 1, bartender: 1 }, // Server understaffed
        '21:00': { server: 2, bartender: 0 },  // Bartender missing
        '22:00': { server: 1, bartender: 0 }   // Server OK, no bartender required
      };

      const gaps = identifyCoverageGaps(requiredCoverage, currentStaffing);

      expect(gaps.length).toBeGreaterThan(0);
      expect(gaps.some(gap => gap.hour === '17:00' && gap.position === 'server')).toBe(true);
      expect(gaps.some(gap => gap.hour === '20:00' && gap.position === 'server')).toBe(true);
      expect(gaps.some(gap => gap.hour === '21:00' && gap.position === 'bartender')).toBe(true);
    });
  });

  describe('Staff Availability and Preferences', () => {
    it('should respect staff availability constraints', () => {
      const staffAvailability = {
        [global.testUser.server.id]: {
          monday: { available: true, preferred_start: '17:00', preferred_end: '23:00' },
          tuesday: { available: false },
          wednesday: { available: true, preferred_start: '11:00', preferred_end: '19:00' }
        }
      };

      const proposedShift = {
        staff_member: global.testUser.server.id,
        shift_date: '2024-01-16', // Tuesday
        start_time: '17:00',
        end_time: '23:00'
      };

      expect(isStaffAvailable(staffAvailability, proposedShift)).toBe(false);

      const validShift = {
        staff_member: global.testUser.server.id,
        shift_date: '2024-01-15', // Monday
        start_time: '17:00',
        end_time: '23:00'
      };

      expect(isStaffAvailable(staffAvailability, validShift)).toBe(true);
    });

    it('should handle shift swap requests', async () => {
      const mockUpdate = vi.fn();

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      // Original shifts
      const shift1 = {
        id: 'shift-1',
        staff_member: global.testUser.server.id,
        shift_date: '2024-01-15'
      };

      const shift2 = {
        id: 'shift-2',
        staff_member: global.testUser.chef.id,
        shift_date: '2024-01-16'
      };

      // Swap shifts
      mockUpdate.mockResolvedValueOnce({
        ...shift1,
        staff_member: global.testUser.chef.id,
        notes: 'Swapped with chef - approved by manager'
      });

      mockUpdate.mockResolvedValueOnce({
        ...shift2,
        staff_member: global.testUser.server.id,
        notes: 'Swapped with server - approved by manager'
      });

      await pb.collection('shifts').update('shift-1', {
        staff_member: global.testUser.chef.id,
        notes: 'Swapped with chef - approved by manager'
      });

      await pb.collection('shifts').update('shift-2', {
        staff_member: global.testUser.server.id,
        notes: 'Swapped with server - approved by manager'
      });

      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it('should calculate overtime hours', () => {
      const weeklyShifts = [
        { shift_date: '2024-01-15', start_time: '09:00', end_time: '17:00', break_duration: 60 }, // 7 hours
        { shift_date: '2024-01-16', start_time: '17:00', end_time: '23:00', break_duration: 30 }, // 5.5 hours
        { shift_date: '2024-01-17', start_time: '11:00', end_time: '19:00', break_duration: 30 }, // 7.5 hours
        { shift_date: '2024-01-18', start_time: '17:00', end_time: '01:00', break_duration: 30 }, // 7.5 hours
        { shift_date: '2024-01-19', start_time: '10:00', end_time: '22:00', break_duration: 60 }  // 11 hours
      ];

      const weeklyHours = calculateWeeklyHours(weeklyShifts);
      const overtimeHours = calculateOvertimeHours(weeklyHours, 35); // 35 hour standard week

      expect(weeklyHours).toBe(38.5);
      expect(overtimeHours).toBe(3.5);
    });
  });

  describe('Shift Performance and Analytics', () => {
    it('should calculate staff punctuality metrics', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            staff_member: global.testUser.server.id,
            status: 'completed',
            shift_date: '2024-01-15'
          },
          {
            staff_member: global.testUser.server.id,
            status: 'completed',
            shift_date: '2024-01-16'
          },
          {
            staff_member: global.testUser.server.id,
            status: 'no_show',
            shift_date: '2024-01-17'
          },
          {
            staff_member: global.testUser.server.id,
            status: 'cancelled',
            shift_date: '2024-01-18'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const staffShifts = await pb.collection('shifts').getList(1, 100, {
        filter: `staff_member = "${global.testUser.server.id}"`
      });

      const metrics = calculateStaffMetrics(staffShifts.items);

      expect(metrics.total_shifts).toBe(4);
      expect(metrics.completed_shifts).toBe(2);
      expect(metrics.no_show_count).toBe(1);
      expect(metrics.cancellation_count).toBe(1);
      expect(metrics.reliability_rate).toBe(50); // 2 completed out of 4 total
    });

    it('should generate shift coverage report', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            shift_date: '2024-01-15',
            position: 'server',
            start_time: '17:00',
            end_time: '23:00',
            status: 'completed'
          },
          {
            shift_date: '2024-01-15',
            position: 'chef',
            start_time: '16:00',
            end_time: '00:00',
            status: 'completed'
          },
          {
            shift_date: '2024-01-15',
            position: 'server',
            start_time: '17:00',
            end_time: '23:00',
            status: 'no_show'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const dayShifts = await pb.collection('shifts').getList(1, 100, {
        filter: 'shift_date = "2024-01-15"'
      });

      const coverageReport = generateCoverageReport(dayShifts.items);

      expect(coverageReport.total_scheduled).toBe(3);
      expect(coverageReport.completed).toBe(2);
      expect(coverageReport.no_shows).toBe(1);
      expect(coverageReport.coverage_rate).toBe(66.67);
      expect(coverageReport.by_position.server.scheduled).toBe(2);
      expect(coverageReport.by_position.server.completed).toBe(1);
    });

    it('should identify scheduling patterns', () => {
      const shifts = [
        { staff_member: 'staff-1', shift_date: '2024-01-15', start_time: '17:00', position: 'server' },
        { staff_member: 'staff-1', shift_date: '2024-01-22', start_time: '17:00', position: 'server' },
        { staff_member: 'staff-1', shift_date: '2024-01-29', start_time: '17:00', position: 'server' },
        { staff_member: 'staff-2', shift_date: '2024-01-16', start_time: '11:00', position: 'host' },
        { staff_member: 'staff-2', shift_date: '2024-01-23', start_time: '11:00', position: 'host' }
      ];

      const patterns = identifySchedulingPatterns(shifts);

      expect(patterns['staff-1'].consistent_schedule).toBe(true);
      expect(patterns['staff-1'].preferred_start_time).toBe('17:00');
      expect(patterns['staff-1'].weekly_frequency).toBe(1);
      expect(patterns['staff-2'].preferred_start_time).toBe('11:00');
    });
  });

  describe('Real-time Shift Management', () => {
    it('should support real-time shift updates', async () => {
      const mockSubscribe = vi.fn();
      const mockUnsubscribe = vi.fn();

      pb.collection = vi.fn().mockReturnValue({
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
      });

      const callback = vi.fn();
      await pb.collection('shifts').subscribe('*', callback);

      // Simulate real-time shift confirmation
      const updateData = {
        action: 'update',
        record: {
          id: 'shift-1',
          status: 'confirmed',
          staff_member: global.testUser.server.id
        }
      };

      callback(updateData);

      expect(callback).toHaveBeenCalledWith(updateData);
      expect(mockSubscribe).toHaveBeenCalledWith('*', callback);
    });

    it('should handle emergency shift notifications', () => {
      const emergencyShift = {
        id: 'shift-emergency',
        staff_member: global.testUser.server.id,
        shift_date: new Date().toISOString().split('T')[0],
        start_time: '18:00',
        end_time: '23:00',
        position: 'server',
        status: 'scheduled',
        notes: 'URGENT: Cover for sick staff member',
        priority: 'high'
      };

      const notification = createShiftNotification(emergencyShift);

      expect(notification.urgency).toBe('high');
      expect(notification.message).toContain('URGENT');
      expect(notification.recipient).toBe(global.testUser.server.id);
    });
  });

  describe('Shift Cost and Labor Analytics', () => {
    it('should calculate labor costs per shift', () => {
      const shifts = [
        {
          position: 'server',
          start_time: '17:00',
          end_time: '23:00',
          break_duration: 30,
          hourly_rate: 15.50
        },
        {
          position: 'chef',
          start_time: '16:00',
          end_time: '00:00',
          break_duration: 60,
          hourly_rate: 22.00
        }
      ];

      const laborCosts = calculateLaborCosts(shifts);

      expect(laborCosts.server).toBeCloseTo(85.25, 2); // 5.5 hours * 15.50
      expect(laborCosts.chef).toBeCloseTo(154.00, 2); // 7 hours * 22.00
      expect(laborCosts.total).toBeCloseTo(239.25, 2);
    });

    it('should optimize staff scheduling for cost efficiency', () => {
      const requirements = {
        '17:00': { server: 2, chef: 1 },
        '18:00': { server: 3, chef: 1, bartender: 1 },
        '19:00': { server: 3, chef: 1, bartender: 1 },
        '20:00': { server: 2, chef: 1, bartender: 1 },
        '21:00': { server: 2, chef: 1, bartender: 1 },
        '22:00': { server: 1, chef: 1 }
      };

      const availableStaff = [
        { id: 'staff-1', position: 'server', hourly_rate: 15.50, max_hours: 8 },
        { id: 'staff-2', position: 'server', hourly_rate: 16.00, max_hours: 6 },
        { id: 'staff-3', position: 'chef', hourly_rate: 22.00, max_hours: 8 },
        { id: 'staff-4', position: 'bartender', hourly_rate: 18.00, max_hours: 6 }
      ];

      const optimizedSchedule = optimizeScheduling(requirements, availableStaff);

      expect(optimizedSchedule.total_cost).toBeDefined();
      expect(optimizedSchedule.coverage_achieved).toBeDefined();
      expect(optimizedSchedule.staff_assignments).toBeDefined();
    });
  });
});

// Helper functions
function isValidStatusTransition(currentStatus: string, nextStatus: string): boolean {
  const validTransitions: Record<string, string[]> = {
    'scheduled': ['confirmed', 'cancelled'],
    'confirmed': ['completed', 'no_show', 'cancelled'],
    'completed': [],
    'cancelled': ['scheduled'],
    'no_show': []
  };

  return validTransitions[currentStatus]?.includes(nextStatus) || false;
}

function checkShiftConflict(existingShifts: any[], newShift: any): boolean {
  return existingShifts.some(existing => {
    if (existing.shift_date !== newShift.shift_date) return false;
    
    const existingStart = timeToMinutes(existing.start_time);
    let existingEnd = timeToMinutes(existing.end_time);
    const newStart = timeToMinutes(newShift.start_time);
    let newEnd = timeToMinutes(newShift.end_time);
    
    // Handle overnight shifts
    if (existingEnd <= existingStart) existingEnd += 24 * 60;
    if (newEnd <= newStart) newEnd += 24 * 60;
    
    return (newStart < existingEnd && newEnd > existingStart);
  });
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function generateWeeklyShifts(template: any, weekStartDate: string, staffId: string): any[] {
  const shifts: any[] = [];
  const startDate = new Date(weekStartDate);
  
  Object.entries(template).forEach(([day, dayShifts]: [string, any]) => {
    const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(day);
    const shiftDate = new Date(startDate);
    shiftDate.setDate(shiftDate.getDate() + dayIndex);
    
    (dayShifts as any[]).forEach(shift => {
      shifts.push({
        staff_member: staffId,
        shift_date: shiftDate.toISOString().split('T')[0],
        start_time: shift.start_time,
        end_time: shift.end_time,
        position: shift.position,
        status: 'scheduled',
        break_duration: 30
      });
    });
  });
  
  return shifts;
}

function calculateStaffingLevels(shifts: any[]): Record<string, Record<string, number>> {
  const levels: Record<string, Record<string, number>> = {};
  
  // Generate hourly slots from 6 AM to 2 AM next day
  for (let hour = 6; hour <= 26; hour++) {
    const timeSlot = `${(hour % 24).toString().padStart(2, '0')}:00`;
    levels[timeSlot] = {};
  }
  
  shifts.forEach(shift => {
    const startMinutes = timeToMinutes(shift.start_time);
    let endMinutes = timeToMinutes(shift.end_time);
    
    // Handle overnight shifts
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60;
    }
    
    for (let minutes = startMinutes; minutes < endMinutes; minutes += 60) {
      const hour = Math.floor(minutes / 60) % 24;
      const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
      
      if (!levels[timeSlot][shift.position]) {
        levels[timeSlot][shift.position] = 0;
      }
      levels[timeSlot][shift.position]++;
    }
  });
  
  return levels;
}

function identifyCoverageGaps(required: any, current: any): any[] {
  const gaps: any[] = [];
  
  Object.entries(required).forEach(([position, req]: [string, any]) => {
    req.hours.forEach((hour: string) => {
      const currentLevel = current[hour]?.[position] || 0;
      if (currentLevel < req.min) {
        gaps.push({
          hour,
          position,
          required: req.min,
          current: currentLevel,
          shortage: req.min - currentLevel
        });
      }
    });
  });
  
  return gaps;
}

function isStaffAvailable(availability: any, shift: any): boolean {
  const shiftDate = new Date(shift.shift_date);
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[shiftDate.getDay()];
  
  const staffAvail = availability[shift.staff_member];
  if (!staffAvail || !staffAvail[dayName]) return false;
  
  return staffAvail[dayName].available;
}

function calculateWeeklyHours(shifts: any[]): number {
  return shifts.reduce((total, shift) => {
    const startMinutes = timeToMinutes(shift.start_time);
    let endMinutes = timeToMinutes(shift.end_time);
    
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60; // Overnight shift
    }
    
    const shiftMinutes = endMinutes - startMinutes - shift.break_duration;
    return total + (shiftMinutes / 60);
  }, 0);
}

function calculateOvertimeHours(totalHours: number, standardHours: number): number {
  return Math.max(0, totalHours - standardHours);
}

function calculateStaffMetrics(shifts: any[]) {
  const totalShifts = shifts.length;
  const completedShifts = shifts.filter(s => s.status === 'completed').length;
  const noShowCount = shifts.filter(s => s.status === 'no_show').length;
  const cancellationCount = shifts.filter(s => s.status === 'cancelled').length;
  
  return {
    total_shifts: totalShifts,
    completed_shifts: completedShifts,
    no_show_count: noShowCount,
    cancellation_count: cancellationCount,
    reliability_rate: totalShifts > 0 ? Math.round((completedShifts / totalShifts) * 100) : 0
  };
}

function generateCoverageReport(shifts: any[]) {
  const totalScheduled = shifts.length;
  const completed = shifts.filter(s => s.status === 'completed').length;
  const noShows = shifts.filter(s => s.status === 'no_show').length;
  
  const byPosition = shifts.reduce((acc, shift) => {
    if (!acc[shift.position]) {
      acc[shift.position] = { scheduled: 0, completed: 0 };
    }
    acc[shift.position].scheduled++;
    if (shift.status === 'completed') {
      acc[shift.position].completed++;
    }
    return acc;
  }, {});
  
  return {
    total_scheduled: totalScheduled,
    completed,
    no_shows: noShows,
    coverage_rate: totalScheduled > 0 ? Math.round((completed / totalScheduled) * 100 * 100) / 100 : 0,
    by_position: byPosition
  };
}

function identifySchedulingPatterns(shifts: any[]) {
  const patterns: Record<string, any> = {};
  
  shifts.forEach(shift => {
    if (!patterns[shift.staff_member]) {
      patterns[shift.staff_member] = {
        shifts: [],
        start_times: [],
        positions: []
      };
    }
    
    patterns[shift.staff_member].shifts.push(shift);
    patterns[shift.staff_member].start_times.push(shift.start_time);
    patterns[shift.staff_member].positions.push(shift.position);
  });
  
  Object.keys(patterns).forEach(staffId => {
    const staffPattern = patterns[staffId];
    const uniqueStartTimes = [...new Set(staffPattern.start_times)];
    const uniquePositions = [...new Set(staffPattern.positions)];
    
    patterns[staffId] = {
      ...staffPattern,
      consistent_schedule: uniqueStartTimes.length === 1,
      preferred_start_time: uniqueStartTimes.length === 1 ? uniqueStartTimes[0] : null,
      weekly_frequency: Math.round(staffPattern.shifts.length / 4), // Assuming 4 weeks of data
      position_consistency: uniquePositions.length === 1
    };
  });
  
  return patterns;
}

function createShiftNotification(shift: any) {
  return {
    recipient: shift.staff_member,
    urgency: shift.priority || 'normal',
    message: `${shift.notes || 'New shift assigned'} - ${shift.shift_date} ${shift.start_time}-${shift.end_time}`,
    type: 'shift_assignment'
  };
}

function calculateLaborCosts(shifts: any[]) {
  const costs: Record<string, number> = {};
  let total = 0;
  
  shifts.forEach(shift => {
    const startMinutes = timeToMinutes(shift.start_time);
    let endMinutes = timeToMinutes(shift.end_time);
    
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60; // Overnight shift
    }
    
    const shiftHours = (endMinutes - startMinutes - shift.break_duration) / 60;
    const cost = shiftHours * shift.hourly_rate;
    
    costs[shift.position] = (costs[shift.position] || 0) + cost;
    total += cost;
  });
  
  costs.total = total;
  return costs;
}

function optimizeScheduling(requirements: any, availableStaff: any[]) {
  // Simplified optimization - in reality this would be more complex
  const assignments: any[] = [];
  let totalCost = 0;
  let coverageAchieved = 0;
  let totalRequirements = 0;
  
  Object.entries(requirements).forEach(([hour, positions]: [string, any]) => {
    Object.entries(positions).forEach(([position, count]: [string, any]) => {
      totalRequirements += count as number;
      const availableForPosition = availableStaff.filter(s => s.position === position);
      const assigned = Math.min(count as number, availableForPosition.length);
      
      coverageAchieved += assigned;
      totalCost += assigned * (availableForPosition[0]?.hourly_rate || 0);
      
      if (assigned > 0) {
        assignments.push({
          hour,
          position,
          staff_count: assigned,
          cost: assigned * (availableForPosition[0]?.hourly_rate || 0)
        });
      }
    });
  });
  
  return {
    total_cost: Math.round(totalCost * 100) / 100,
    coverage_achieved: Math.round((coverageAchieved / totalRequirements) * 100),
    staff_assignments: assignments
  };
}
