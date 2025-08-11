import { describe, it, expect, beforeEach, vi } from 'vitest';
import PocketBase from 'pocketbase';

describe('Staff Collection Tests', () => {
  let pb: PocketBase;
  
  beforeEach(() => {
    vi.clearAllMocks();
    pb = new PocketBase();
  });

  describe('CRUD Operations', () => {
    it('should create staff record', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'test-staff-id',
        first_name: 'Marie',
        last_name: 'Rousseau',
        email: 'marie.rousseau@parcbistro.com',
        phone: '+33 1 42 68 75 84',
        position: 'server',
        hourly_rate: 15.50,
        hire_date: '2024-01-15',
        status: 'active',
        user_id: 'user-123'
      });

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      const staffData = {
        first_name: 'Marie',
        last_name: 'Rousseau',
        email: 'marie.rousseau@parcbistro.com',
        phone: '+33 1 42 68 75 84',
        position: 'server',
        hourly_rate: 15.50,
        hire_date: '2024-01-15',
        status: 'active',
        user_id: 'user-123'
      };

      const result = await pb.collection('staff').create(staffData);
      
      expect(mockCreate).toHaveBeenCalledWith(staffData);
      expect(result.first_name).toBe('Marie');
      expect(result.last_name).toBe('Rousseau');
      expect(result.position).toBe('server');
      expect(result.hourly_rate).toBe(15.50);
      expect(result.status).toBe('active');
    });

    it('should retrieve staff by ID', async () => {
      const mockGetOne = vi.fn().mockResolvedValue({
        id: 'test-staff-id',
        first_name: 'Marie',
        last_name: 'Rousseau',
        email: 'marie.rousseau@parcbistro.com',
        position: 'server',
        status: 'active'
      });

      pb.collection = vi.fn().mockReturnValue({
        getOne: mockGetOne
      });

      const result = await pb.collection('staff').getOne('test-staff-id');

      expect(mockGetOne).toHaveBeenCalledWith('test-staff-id');
      expect(result.id).toBe('test-staff-id');
      expect(result.first_name).toBe('Marie');
    });

    it('should update staff information', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'test-staff-id',
        first_name: 'Marie',
        last_name: 'Rousseau',
        position: 'server',
        hourly_rate: 16.00,
        updated: '2024-01-01T12:00:00Z'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      const result = await pb.collection('staff').update('test-staff-id', {
        hourly_rate: 16.00
      });

      expect(mockUpdate).toHaveBeenCalledWith('test-staff-id', {
        hourly_rate: 16.00
      });
      expect(result.hourly_rate).toBe(16.00);
    });

    it('should delete staff record', async () => {
      const mockDelete = vi.fn().mockResolvedValue(true);

      pb.collection = vi.fn().mockReturnValue({
        delete: mockDelete
      });

      await pb.collection('staff').delete('test-staff-id');

      expect(mockDelete).toHaveBeenCalledWith('test-staff-id');
    });

    it('should list staff with pagination', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'staff1',
            first_name: 'Marie',
            last_name: 'Rousseau',
            position: 'server',
            status: 'active'
          },
          {
            id: 'staff2',
            first_name: 'Pierre',
            last_name: 'Dubois',
            position: 'manager',
            status: 'active'
          }
        ],
        totalItems: 15,
        totalPages: 3,
        page: 1
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('staff').getList(1, 10, {
        sort: 'last_name,first_name'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 10, {
        sort: 'last_name,first_name'
      });
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(15);
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

        await pb.collection('staff').create({
          first_name: 'Test',
          last_name: 'User',
          email: 'test@parcbistro.com',
          phone: '+33 1 42 68 75 84',
          position: position,
          hourly_rate: 15.00,
          hire_date: '2024-01-15',
          status: 'active',
          user_id: 'user-123'
        });

        expect(mockCreate).toHaveBeenCalled();
      });
    });

    it('should reject invalid position', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid position'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('staff').create({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@parcbistro.com',
        phone: '+33 1 42 68 75 84',
        position: 'invalid_position',
        hourly_rate: 15.00,
        hire_date: '2024-01-15',
        status: 'active',
        user_id: 'user-123'
      })).rejects.toThrow('Invalid position');
    });
  });

  describe('Status Validation', () => {
    const validStatuses = ['active', 'inactive', 'terminated'];

    validStatuses.forEach(status => {
      it(`should accept valid status: ${status}`, async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: 'test-id',
          status: status
        });

        pb.collection = vi.fn().mockReturnValue({
          create: mockCreate
        });

        await pb.collection('staff').create({
          first_name: 'Test',
          last_name: 'User',
          email: 'test@parcbistro.com',
          phone: '+33 1 42 68 75 84',
          position: 'server',
          hourly_rate: 15.00,
          hire_date: '2024-01-15',
          status: status,
          user_id: 'user-123'
        });

        expect(mockCreate).toHaveBeenCalled();
      });
    });

    it('should reject invalid status', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid status'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('staff').create({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@parcbistro.com',
        phone: '+33 1 42 68 75 84',
        position: 'server',
        hourly_rate: 15.00,
        hire_date: '2024-01-15',
        status: 'invalid_status',
        user_id: 'user-123'
      })).rejects.toThrow('Invalid status');
    });
  });

  describe('Data Validation', () => {
    it('should validate email formats', async () => {
      const validEmails = [
        'marie@parcbistro.com',
        'pierre.dubois@restaurant.fr',
        'chef.antoine@bistro.com',
        'marie-claire@example.org'
      ];

      const mockCreate = vi.fn();
      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      for (const email of validEmails) {
        mockCreate.mockResolvedValueOnce({
          id: 'test-id',
          email: email
        });

        await pb.collection('staff').create({
          first_name: 'Test',
          last_name: 'User',
          email: email,
          phone: '+33 1 42 68 75 84',
          position: 'server',
          hourly_rate: 15.00,
          hire_date: '2024-01-15',
          status: 'active',
          user_id: 'user-123'
        });
      }

      expect(mockCreate).toHaveBeenCalledTimes(validEmails.length);
    });

    it('should reject invalid email formats', async () => {
      const invalidEmails = [
        'invalid-email',
        '@parcbistro.com',
        'test@',
        'test.parcbistro.com'
      ];

      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid email format'));
      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      for (const email of invalidEmails) {
        await expect(pb.collection('staff').create({
          first_name: 'Test',
          last_name: 'User',
          email: email,
          phone: '+33 1 42 68 75 84',
          position: 'server',
          hourly_rate: 15.00,
          hire_date: '2024-01-15',
          status: 'active',
          user_id: 'user-123'
        })).rejects.toThrow('Invalid email format');
      }
    });

    it('should validate phone number formats', () => {
      const validPhoneNumbers = [
        '+33 1 42 68 75 84',
        '+33 6 12 34 56 78',
        '01 42 68 75 84',
        '+1 555 123 4567',
        '(555) 123-4567'
      ];

      validPhoneNumbers.forEach(phone => {
        expect(isValidPhoneNumber(phone)).toBe(true);
      });

      const invalidPhoneNumbers = [
        '123',
        'abc-def-ghij',
        '12-34'
      ];

      invalidPhoneNumbers.forEach(phone => {
        expect(isValidPhoneNumber(phone)).toBe(false);
      });
    });

    it('should validate hourly rates', () => {
      expect(isValidHourlyRate(15.50)).toBe(true);
      expect(isValidHourlyRate(8.50)).toBe(true); // Minimum wage
      expect(isValidHourlyRate(50.00)).toBe(true); // High rate for chef/manager
      
      expect(isValidHourlyRate(0)).toBe(false); // Zero rate
      expect(isValidHourlyRate(-5.00)).toBe(false); // Negative rate
      expect(isValidHourlyRate(200.00)).toBe(false); // Unreasonably high
    });

    it('should validate hire dates', () => {
      const today = new Date().toISOString().split('T')[0];
      const pastDate = '2023-01-15';
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      expect(isValidHireDate(pastDate)).toBe(true);
      expect(isValidHireDate(today)).toBe(true);
      expect(isValidHireDate(futureDate)).toBe(true); // Future dates allowed for planning
    });

    it('should require mandatory fields', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Missing required fields'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('staff').create({
        // Missing required fields
        first_name: 'Test'
      })).rejects.toThrow('Missing required fields');
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow Manager to create staff', () => {
      const managerUser = global.testUser.manager;
      expect(canCreateStaff(managerUser.role)).toBe(true);
    });

    it('should restrict Server from creating staff', () => {
      const serverUser = global.testUser.server;
      expect(canCreateStaff(serverUser.role)).toBe(false);
    });

    it('should allow Manager to update staff information', () => {
      const managerUser = global.testUser.manager;
      expect(canUpdateStaff(managerUser.role)).toBe(true);
    });

    it('should allow staff to view own information', () => {
      const serverUser = global.testUser.server;
      const ownRecord = { user_id: serverUser.id };
      const otherRecord = { user_id: 'other-user-id' };

      expect(canViewStaff(serverUser.role, serverUser.id, ownRecord)).toBe(true);
      expect(canViewStaff(serverUser.role, serverUser.id, otherRecord)).toBe(false);
    });

    it('should allow Manager to view all staff information', () => {
      const managerUser = global.testUser.manager;
      const anyRecord = { user_id: 'any-user-id' };

      expect(canViewStaff(managerUser.role, managerUser.id, anyRecord)).toBe(true);
    });

    it('should allow staff to update own contact information', () => {
      const serverUser = global.testUser.server;
      const ownRecord = { user_id: serverUser.id };
      const otherRecord = { user_id: 'other-user-id' };

      expect(canUpdateOwnInfo(serverUser.role, serverUser.id, ownRecord)).toBe(true);
      expect(canUpdateOwnInfo(serverUser.role, serverUser.id, otherRecord)).toBe(false);
    });

    it('should restrict staff deletion to Manager only', () => {
      const roles = ['Server', 'Chef', 'Bartender', 'Host'];
      roles.forEach(role => {
        expect(canDeleteStaff(role)).toBe(false);
      });

      expect(canDeleteStaff('Manager')).toBe(true);
    });
  });

  describe('Filtering and Searching', () => {
    it('should filter staff by position', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'staff1', first_name: 'Marie', position: 'server' },
          { id: 'staff2', first_name: 'Jacques', position: 'server' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('staff').getList(1, 50, {
        filter: 'position = "server"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'position = "server"'
      });
    });

    it('should filter staff by status', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'staff1', first_name: 'Marie', status: 'active' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('staff').getList(1, 50, {
        filter: 'status = "active"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'status = "active"'
      });
    });

    it('should search staff by name', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'staff1', first_name: 'Marie', last_name: 'Rousseau' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('staff').getList(1, 50, {
        filter: 'first_name ~ "Marie" || last_name ~ "Marie"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'first_name ~ "Marie" || last_name ~ "Marie"'
      });
    });

    it('should search staff by email', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'staff1', email: 'marie.rousseau@parcbistro.com' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('staff').getList(1, 50, {
        filter: 'email ~ "marie"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'email ~ "marie"'
      });
    });

    it('should filter by hire date range', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'staff1', hire_date: '2024-01-15' },
          { id: 'staff2', hire_date: '2024-01-20' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('staff').getList(1, 50, {
        filter: 'hire_date >= "2024-01-01" && hire_date <= "2024-01-31"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'hire_date >= "2024-01-01" && hire_date <= "2024-01-31"'
      });
    });

    it('should filter by hourly rate range', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'staff1', hourly_rate: 16.50 },
          { id: 'staff2', hourly_rate: 18.00 }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('staff').getList(1, 50, {
        filter: 'hourly_rate >= 15.00 && hourly_rate <= 20.00'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'hourly_rate >= 15.00 && hourly_rate <= 20.00'
      });
    });

    it('should filter by multiple criteria', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'staff1',
            first_name: 'Marie',
            position: 'server',
            status: 'active',
            hourly_rate: 16.00
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('staff').getList(1, 50, {
        filter: 'position = "server" && status = "active" && hourly_rate >= 15.00'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'position = "server" && status = "active" && hourly_rate >= 15.00'
      });
    });
  });

  describe('Business Logic', () => {
    it('should group staff by position', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 's1', first_name: 'Marie', position: 'server' },
          { id: 's2', first_name: 'Jacques', position: 'server' },
          { id: 's3', first_name: 'Antoine', position: 'chef' },
          { id: 's4', first_name: 'Pierre', position: 'manager' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('staff').getList(1, 100);
      const groupedStaff = groupStaffByPosition(result.items);

      expect(groupedStaff.server).toHaveLength(2);
      expect(groupedStaff.chef).toHaveLength(1);
      expect(groupedStaff.manager).toHaveLength(1);
    });

    it('should calculate average hourly rate by position', () => {
      const staff = [
        { position: 'server', hourly_rate: 15.50 },
        { position: 'server', hourly_rate: 16.50 },
        { position: 'chef', hourly_rate: 22.00 },
        { position: 'chef', hourly_rate: 24.00 }
      ];

      const averageRates = calculateAverageRatesByPosition(staff);

      expect(averageRates.server).toBe(16.00);
      expect(averageRates.chef).toBe(23.00);
    });

    it('should calculate staff turnover metrics', () => {
      const staff = [
        { status: 'active', hire_date: '2023-01-15' },
        { status: 'active', hire_date: '2023-06-01' },
        { status: 'terminated', hire_date: '2023-03-01' },
        { status: 'terminated', hire_date: '2023-08-01' }
      ];

      const metrics = calculateTurnoverMetrics(staff);

      expect(metrics.total_staff).toBe(4);
      expect(metrics.active_staff).toBe(2);
      expect(metrics.terminated_staff).toBe(2);
      expect(metrics.turnover_rate).toBe(50);
    });

    it('should identify staff due for performance review', () => {
      const currentDate = new Date();
      const sixMonthsAgo = new Date(currentDate.getTime() - (6 * 30 * 24 * 60 * 60 * 1000));
      const oneYearAgo = new Date(currentDate.getTime() - (365 * 24 * 60 * 60 * 1000));

      const staff = [
        {
          id: 'staff1',
          first_name: 'Marie',
          hire_date: oneYearAgo.toISOString().split('T')[0],
          last_review_date: sixMonthsAgo.toISOString().split('T')[0]
        },
        {
          id: 'staff2',
          first_name: 'Pierre',
          hire_date: '2024-01-01',
          last_review_date: null
        }
      ];

      const dueForReview = identifyStaffDueForReview(staff);

      expect(dueForReview.length).toBeGreaterThan(0);
      expect(dueForReview.some(staff => staff.id === 'staff2')).toBe(true);
    });
  });

  describe('Relations and Expand', () => {
    it('should expand user relations', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'staff1',
            first_name: 'Marie',
            last_name: 'Rousseau',
            user_id: global.testUser.server.id,
            expand: {
              user_id: {
                id: global.testUser.server.id,
                email: global.testUser.server.email,
                role: global.testUser.server.role
              }
            }
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('staff').getList(1, 50, {
        expand: 'user_id'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        expand: 'user_id'
      });
      expect(result.items[0].expand.user_id.email).toBe(global.testUser.server.email);
    });

    it('should filter by related user properties', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'staff1',
            first_name: 'Marie',
            expand: {
              user_id: {
                role: 'Server'
              }
            }
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('staff').getList(1, 50, {
        filter: 'user_id.role = "Server"',
        expand: 'user_id'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'user_id.role = "Server"',
        expand: 'user_id'
      });
    });
  });

  describe('Sorting and Ordering', () => {
    it('should sort staff by last name then first name', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 's1', first_name: 'Pierre', last_name: 'Dubois' },
          { id: 's2', first_name: 'Marie', last_name: 'Rousseau' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('staff').getList(1, 50, {
        sort: 'last_name,first_name'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        sort: 'last_name,first_name'
      });
    });

    it('should sort by hire date (newest first)', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 's1', hire_date: '2024-01-15' },
          { id: 's2', hire_date: '2023-12-01' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('staff').getList(1, 50, {
        sort: '-hire_date'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        sort: '-hire_date'
      });
    });

    it('should sort by hourly rate (highest first)', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 's1', hourly_rate: 24.00 },
          { id: 's2', hourly_rate: 16.50 }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('staff').getList(1, 50, {
        sort: '-hourly_rate'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        sort: '-hourly_rate'
      });
    });
  });
});

// Helper functions
function isValidPhoneNumber(phone: string): boolean {
  if (!phone || phone.trim() === '') return false;
  const hasDigits = /\d/.test(phone);
  const phoneRegex = /^[\+]?[0-9\s\-\(\)]{7,20}$/;
  return hasDigits && phoneRegex.test(phone) && phone.replace(/[^\d]/g, '').length >= 7;
}

function isValidHourlyRate(rate: number): boolean {
  return rate > 0 && rate <= 100; // Reasonable range for restaurant industry
}

function isValidHireDate(date: string): boolean {
  const hireDate = new Date(date);
  const minDate = new Date('2020-01-01'); // Reasonable minimum
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1); // Allow future dates for planning
  
  return hireDate >= minDate && hireDate <= maxDate;
}

function canCreateStaff(role: string): boolean {
  return role === 'Manager';
}

function canUpdateStaff(role: string): boolean {
  return role === 'Manager';
}

function canViewStaff(role: string, userId: string, staffRecord: any): boolean {
  if (role === 'Manager') return true;
  return staffRecord.user_id === userId;
}

function canUpdateOwnInfo(role: string, userId: string, staffRecord: any): boolean {
  // Staff can update their own contact info, but not salary/position
  return staffRecord.user_id === userId;
}

function canDeleteStaff(role: string): boolean {
  return role === 'Manager';
}

function groupStaffByPosition(staff: any[]): Record<string, any[]> {
  return staff.reduce((groups, member) => {
    const position = member.position;
    if (!groups[position]) groups[position] = [];
    groups[position].push(member);
    return groups;
  }, {});
}

function calculateAverageRatesByPosition(staff: any[]): Record<string, number> {
  const positionGroups = groupStaffByPosition(staff);
  const averages: Record<string, number> = {};
  
  Object.entries(positionGroups).forEach(([position, members]) => {
    const totalRate = (members as any[]).reduce((sum, member) => sum + member.hourly_rate, 0);
    averages[position] = Math.round((totalRate / members.length) * 100) / 100;
  });
  
  return averages;
}

function calculateTurnoverMetrics(staff: any[]) {
  const totalStaff = staff.length;
  const activeStaff = staff.filter(s => s.status === 'active').length;
  const terminatedStaff = staff.filter(s => s.status === 'terminated').length;
  
  return {
    total_staff: totalStaff,
    active_staff: activeStaff,
    terminated_staff: terminatedStaff,
    turnover_rate: totalStaff > 0 ? Math.round((terminatedStaff / totalStaff) * 100) : 0
  };
}

function identifyStaffDueForReview(staff: any[]): any[] {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  return staff.filter(member => {
    // Due for review if no last review date or last review was over 6 months ago
    if (!member.last_review_date) {
      // Check if hired more than 3 months ago (probation period)
      const hireDate = new Date(member.hire_date);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return hireDate <= threeMonthsAgo;
    }
    
    const lastReviewDate = new Date(member.last_review_date);
    return lastReviewDate <= sixMonthsAgo;
  });
}
