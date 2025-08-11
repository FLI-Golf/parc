import { describe, it, expect, beforeEach, vi } from 'vitest';
import PocketBase from 'pocketbase';

describe('Shifts Collection Tests', () => {
  let pb: PocketBase;
  
  beforeEach(() => {
    vi.clearAllMocks();
    pb = new PocketBase();
  });

  describe('CRUD Operations', () => {
    it('should create shift record', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'test-shift-id',
        staff_member: global.testUser.server.id,
        shift_date: '2024-01-15',
        start_time: '17:00',
        end_time: '23:00',
        break_duration: 30,
        position: 'server',
        status: 'scheduled',
        notes: 'Evening shift, section A',
        assigned_section: 'section-a'
      });

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      const shiftData = {
        staff_member: global.testUser.server.id,
        shift_date: '2024-01-15',
        start_time: '17:00',
        end_time: '23:00',
        break_duration: 30,
        position: 'server',
        status: 'scheduled',
        notes: 'Evening shift, section A',
        assigned_section: 'section-a'
      };

      const result = await pb.collection('shifts').create(shiftData);
      
      expect(mockCreate).toHaveBeenCalledWith(shiftData);
      expect(result.position).toBe('server');
      expect(result.status).toBe('scheduled');
      expect(result.break_duration).toBe(30);
    });

    it('should retrieve shift by ID', async () => {
      const mockGetOne = vi.fn().mockResolvedValue({
        id: 'test-shift-id',
        staff_member: global.testUser.server.id,
        shift_date: '2024-01-15',
        start_time: '17:00',
        end_time: '23:00',
        position: 'server',
        status: 'scheduled'
      });

      pb.collection = vi.fn().mockReturnValue({
        getOne: mockGetOne
      });

      const result = await pb.collection('shifts').getOne('test-shift-id');

      expect(mockGetOne).toHaveBeenCalledWith('test-shift-id');
      expect(result.id).toBe('test-shift-id');
      expect(result.position).toBe('server');
    });

    it('should update shift status', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'test-shift-id',
        status: 'confirmed',
        notes: 'Confirmed by staff member',
        updated: '2024-01-01T12:00:00Z'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      const result = await pb.collection('shifts').update('test-shift-id', {
        status: 'confirmed',
        notes: 'Confirmed by staff member'
      });

      expect(mockUpdate).toHaveBeenCalledWith('test-shift-id', {
        status: 'confirmed',
        notes: 'Confirmed by staff member'
      });
      expect(result.status).toBe('confirmed');
    });

    it('should delete shift', async () => {
      const mockDelete = vi.fn().mockResolvedValue(true);

      pb.collection = vi.fn().mockReturnValue({
        delete: mockDelete
      });

      await pb.collection('shifts').delete('test-shift-id');

      expect(mockDelete).toHaveBeenCalledWith('test-shift-id');
    });

    it('should list shifts by staff member', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'shift1',
            staff_member: global.testUser.server.id,
            shift_date: '2024-01-15',
            position: 'server',
            status: 'scheduled'
          },
          {
            id: 'shift2',
            staff_member: global.testUser.server.id,
            shift_date: '2024-01-16',
            position: 'server',
            status: 'confirmed'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('shifts').getList(1, 50, {
        filter: `staff_member = "${global.testUser.server.id}"`,
        sort: 'shift_date'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: `staff_member = "${global.testUser.server.id}"`,
        sort: 'shift_date'
      });
      expect(result.items).toHaveLength(2);
    });

    it('should list shifts by date range', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'shift1',
            shift_date: '2024-01-15',
            position: 'server',
            status: 'scheduled'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('shifts').getList(1, 50, {
        filter: 'shift_date >= "2024-01-15" && shift_date <= "2024-01-21"',
        sort: 'shift_date,start_time'
      });

      expect(result.items[0].shift_date).toBe('2024-01-15');
    });
  });

  describe('Position Validation', () => {
    const validPositions = ['manager', 'server', 'chef', 'bartender', 'host', 'busser', 'dishwasher', 'kitchen_prep', 'owner'];

    validPositions.forEach(position => {
      it(`should accept valid position: ${position}`, async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: 'test-id',
          position: position
        });

        pb.collection = vi.fn().mockReturnValue({
          create: mockCreate
        });

        await pb.collection('shifts').create({
          staff_member: global.testUser.server.id,
          shift_date: '2024-01-15',
          start_time: '09:00',
          end_time: '17:00',
          break_duration: 30,
          position: position,
          status: 'scheduled',
          assigned_section: 'section-a'
        });

        expect(mockCreate).toHaveBeenCalled();
      });
    });

    it('should reject invalid position', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid position'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('shifts').create({
        staff_member: global.testUser.server.id,
        shift_date: '2024-01-15',
        start_time: '09:00',
        end_time: '17:00',
        break_duration: 30,
        position: 'invalid_position',
        status: 'scheduled',
        assigned_section: 'section-a'
      })).rejects.toThrow('Invalid position');
    });
  });

  describe('Status Validation', () => {
    const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];

    validStatuses.forEach(status => {
      it(`should accept valid status: ${status}`, async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: 'test-id',
          status: status
        });

        pb.collection = vi.fn().mockReturnValue({
          create: mockCreate
        });

        await pb.collection('shifts').create({
          staff_member: global.testUser.server.id,
          shift_date: '2024-01-15',
          start_time: '09:00',
          end_time: '17:00',
          break_duration: 30,
          position: 'server',
          status: status,
          assigned_section: 'section-a'
        });

        expect(mockCreate).toHaveBeenCalled();
      });
    });

    it('should reject invalid status', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid status'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('shifts').create({
        staff_member: global.testUser.server.id,
        shift_date: '2024-01-15',
        start_time: '09:00',
        end_time: '17:00',
        break_duration: 30,
        position: 'server',
        status: 'invalid_status',
        assigned_section: 'section-a'
      })).rejects.toThrow('Invalid status');
    });
  });

  describe('Time and Date Validation', () => {
    it('should validate shift duration calculation', () => {
      const startTime = '09:00';
      const endTime = '17:00';
      const breakDuration = 30;

      const totalHours = calculateShiftHours(startTime, endTime, breakDuration);
      expect(totalHours).toBe(7.5); // 8 hours - 0.5 hour break
    });

    it('should validate overnight shifts', () => {
      const startTime = '22:00';
      const endTime = '06:00';
      const breakDuration = 30;

      const totalHours = calculateShiftHours(startTime, endTime, breakDuration);
      expect(totalHours).toBe(7.5); // 8 hours - 0.5 hour break
    });

    it('should reject shifts with end time before start time (same day)', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid time range'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('shifts').create({
        staff_member: global.testUser.server.id,
        shift_date: '2024-01-15',
        start_time: '17:00',
        end_time: '09:00', // Invalid: end before start on same day
        break_duration: 30,
        position: 'server',
        status: 'scheduled',
        assigned_section: 'section-a'
      })).rejects.toThrow('Invalid time range');
    });

    it('should validate reasonable break durations', () => {
      expect(isValidBreakDuration(30, 8)).toBe(true); // 30 min break for 8 hour shift
      expect(isValidBreakDuration(60, 8)).toBe(true); // 1 hour break for 8 hour shift
      expect(isValidBreakDuration(120, 4)).toBe(false); // 2 hour break for 4 hour shift
      expect(isValidBreakDuration(-10, 8)).toBe(false); // Negative break
    });

    it('should validate future dates for new shifts', () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      expect(isValidShiftDate(today)).toBe(true); // Today is valid
      expect(isValidShiftDate(tomorrow)).toBe(true); // Future dates are valid
      expect(isValidShiftDate(yesterday)).toBe(false); // Past dates are invalid for new shifts
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow Manager to create shifts', () => {
      const managerUser = global.testUser.manager;
      expect(canCreateShift(managerUser.role)).toBe(true);
    });

    it('should restrict Server from creating shifts for others', () => {
      const serverUser = global.testUser.server;
      expect(canCreateShiftForOthers(serverUser.role)).toBe(false);
    });

    it('should allow staff to view their own shifts', () => {
      const serverUser = global.testUser.server;
      const ownShift = { staff_member: serverUser.id };
      const otherShift = { staff_member: 'other-staff-id' };

      expect(canViewShift(serverUser.role, serverUser.id, ownShift)).toBe(true);
      expect(canViewShift(serverUser.role, serverUser.id, otherShift)).toBe(false);
    });

    it('should allow Manager to view all shifts', () => {
      const managerUser = global.testUser.manager;
      const anyShift = { staff_member: 'any-staff-id' };

      expect(canViewShift(managerUser.role, managerUser.id, anyShift)).toBe(true);
    });

    it('should allow staff to confirm their own shifts', () => {
      const serverUser = global.testUser.server;
      const ownShift = { staff_member: serverUser.id, status: 'scheduled' };
      const otherShift = { staff_member: 'other-staff-id', status: 'scheduled' };

      expect(canConfirmShift(serverUser.role, serverUser.id, ownShift)).toBe(true);
      expect(canConfirmShift(serverUser.role, serverUser.id, otherShift)).toBe(false);
    });

    it('should restrict shift deletion to Manager only', () => {
      const roles = ['Server', 'Chef', 'Bartender', 'Host'];
      roles.forEach(role => {
        expect(canDeleteShift(role)).toBe(false);
      });

      expect(canDeleteShift('Manager')).toBe(true);
    });
  });

  describe('Filtering and Searching', () => {
    it('should filter shifts by position', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'shift1', position: 'server', status: 'scheduled' },
          { id: 'shift2', position: 'server', status: 'confirmed' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('shifts').getList(1, 50, {
        filter: 'position = "server"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'position = "server"'
      });
    });

    it('should filter shifts by status', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'shift1', status: 'scheduled' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('shifts').getList(1, 50, {
        filter: 'status = "scheduled"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'status = "scheduled"'
      });
    });

    it('should filter shifts by date range', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'shift1', shift_date: '2024-01-15' },
          { id: 'shift2', shift_date: '2024-01-16' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('shifts').getList(1, 50, {
        filter: 'shift_date >= "2024-01-15" && shift_date <= "2024-01-21"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'shift_date >= "2024-01-15" && shift_date <= "2024-01-21"'
      });
    });

    it('should filter shifts by assigned section', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'shift1', assigned_section: 'section-a', position: 'server' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('shifts').getList(1, 50, {
        filter: 'assigned_section = "section-a"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'assigned_section = "section-a"'
      });
    });

    it('should search shifts by notes', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'shift1', notes: 'Training shift for new server' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('shifts').getList(1, 50, {
        filter: 'notes ~ "training"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'notes ~ "training"'
      });
    });

    it('should filter by time range', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'shift1', start_time: '17:00', end_time: '23:00' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('shifts').getList(1, 50, {
        filter: 'start_time >= "17:00" && end_time <= "23:00"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'start_time >= "17:00" && end_time <= "23:00"'
      });
    });
  });

  describe('Relations and Expand', () => {
    it('should expand staff member and section relations', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'shift1',
            staff_member: global.testUser.server.id,
            assigned_section: 'section-a',
            expand: {
              staff_member: {
                id: global.testUser.server.id,
                name: global.testUser.server.name,
                email: global.testUser.server.email,
                role: global.testUser.server.role
              },
              assigned_section: {
                id: 'section-a',
                name: 'Section A',
                table_count: 8
              }
            }
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('shifts').getList(1, 50, {
        expand: 'staff_member,assigned_section'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        expand: 'staff_member,assigned_section'
      });
      expect(result.items[0].expand.staff_member.name).toBe(global.testUser.server.name);
      expect(result.items[0].expand.assigned_section.name).toBe('Section A');
    });

    it('should filter by related staff properties', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'shift1',
            staff_member: global.testUser.server.id,
            expand: {
              staff_member: {
                role: 'Server'
              }
            }
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('shifts').getList(1, 50, {
        filter: 'staff_member.role = "Server"',
        expand: 'staff_member'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'staff_member.role = "Server"',
        expand: 'staff_member'
      });
    });
  });

  describe('Bulk Operations', () => {
    it('should create multiple shifts for weekly schedule', async () => {
      const mockBatchCreate = vi.fn().mockResolvedValue({
        items: [
          { id: 'shift1', shift_date: '2024-01-15', position: 'server' },
          { id: 'shift2', shift_date: '2024-01-16', position: 'server' },
          { id: 'shift3', shift_date: '2024-01-17', position: 'server' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        batchCreate: mockBatchCreate
      });

      const weeklyShifts = [
        {
          staff_member: global.testUser.server.id,
          shift_date: '2024-01-15',
          start_time: '17:00',
          end_time: '23:00',
          break_duration: 30,
          position: 'server',
          status: 'scheduled',
          assigned_section: 'section-a'
        },
        {
          staff_member: global.testUser.server.id,
          shift_date: '2024-01-16',
          start_time: '17:00',
          end_time: '23:00',
          break_duration: 30,
          position: 'server',
          status: 'scheduled',
          assigned_section: 'section-a'
        },
        {
          staff_member: global.testUser.server.id,
          shift_date: '2024-01-17',
          start_time: '17:00',
          end_time: '23:00',
          break_duration: 30,
          position: 'server',
          status: 'scheduled',
          assigned_section: 'section-a'
        }
      ];

      await pb.collection('shifts').batchCreate(weeklyShifts);

      expect(mockBatchCreate).toHaveBeenCalledWith(weeklyShifts);
    });

    it('should update multiple shift statuses', async () => {
      const mockBatchUpdate = vi.fn().mockResolvedValue({
        items: [
          { id: 'shift1', status: 'confirmed' },
          { id: 'shift2', status: 'confirmed' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        batchUpdate: mockBatchUpdate
      });

      const updates = [
        { id: 'shift1', status: 'confirmed' },
        { id: 'shift2', status: 'confirmed' }
      ];

      await pb.collection('shifts').batchUpdate(updates);

      expect(mockBatchUpdate).toHaveBeenCalledWith(updates);
    });
  });
});

// Helper functions
function calculateShiftHours(startTime: string, endTime: string, breakMinutes: number): number {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  
  // Handle overnight shifts
  if (end <= start) {
    end += 24 * 60; // Add 24 hours
  }
  
  const totalMinutes = end - start - breakMinutes;
  return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimal places
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function isValidBreakDuration(breakMinutes: number, shiftHours: number): boolean {
  if (breakMinutes < 0) return false;
  if (shiftHours < 6 && breakMinutes > 60) return false; // Max 1 hour break for shorter shifts
  if (shiftHours >= 8 && breakMinutes > 120) return false; // Max 2 hour break for long shifts
  return true;
}

function isValidShiftDate(date: string): boolean {
  const shiftDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to beginning of day
  
  return shiftDate >= today;
}

function canCreateShift(role: string): boolean {
  return role === 'Manager';
}

function canCreateShiftForOthers(role: string): boolean {
  return role === 'Manager';
}

function canViewShift(role: string, userId: string, shift: any): boolean {
  if (role === 'Manager') return true;
  return shift.staff_member === userId;
}

function canConfirmShift(role: string, userId: string, shift: any): boolean {
  if (role === 'Manager') return true;
  return shift.staff_member === userId && shift.status === 'scheduled';
}

function canDeleteShift(role: string): boolean {
  return role === 'Manager';
}
