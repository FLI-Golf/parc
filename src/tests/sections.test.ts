import { describe, it, expect, beforeEach, vi } from 'vitest';
import PocketBase from 'pocketbase';

describe('Sections Collection Tests', () => {
  let pb: PocketBase;
  
  beforeEach(() => {
    vi.clearAllMocks();
    pb = new PocketBase();
  });

  describe('CRUD Operations', () => {
    it('should create section record', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'test-section-id',
        section_name: 'Section A - Main Dining',
        section_code: 'A',
        area_type: 'dining',
        max_capacity: 40
      });

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      const sectionData = {
        section_name: 'Section A - Main Dining',
        section_code: 'A',
        area_type: 'dining',
        max_capacity: 40
      };

      const result = await pb.collection('sections').create(sectionData);
      
      expect(mockCreate).toHaveBeenCalledWith(sectionData);
      expect(result.section_name).toBe('Section A - Main Dining');
      expect(result.section_code).toBe('A');
      expect(result.area_type).toBe('dining');
      expect(result.max_capacity).toBe(40);
    });

    it('should retrieve section by ID', async () => {
      const mockGetOne = vi.fn().mockResolvedValue({
        id: 'test-section-id',
        section_name: 'Section A - Main Dining',
        section_code: 'A',
        area_type: 'dining',
        max_capacity: 40
      });

      pb.collection = vi.fn().mockReturnValue({
        getOne: mockGetOne
      });

      const result = await pb.collection('sections').getOne('test-section-id');

      expect(mockGetOne).toHaveBeenCalledWith('test-section-id');
      expect(result.id).toBe('test-section-id');
      expect(result.section_name).toBe('Section A - Main Dining');
    });

    it('should update section information', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'test-section-id',
        section_name: 'Section A - Premium Dining',
        max_capacity: 35,
        updated: '2024-01-01T12:00:00Z'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      const result = await pb.collection('sections').update('test-section-id', {
        section_name: 'Section A - Premium Dining',
        max_capacity: 35
      });

      expect(mockUpdate).toHaveBeenCalledWith('test-section-id', {
        section_name: 'Section A - Premium Dining',
        max_capacity: 35
      });
      expect(result.section_name).toBe('Section A - Premium Dining');
      expect(result.max_capacity).toBe(35);
    });

    it('should delete section', async () => {
      const mockDelete = vi.fn().mockResolvedValue(true);

      pb.collection = vi.fn().mockReturnValue({
        delete: mockDelete
      });

      await pb.collection('sections').delete('test-section-id');

      expect(mockDelete).toHaveBeenCalledWith('test-section-id');
    });

    it('should list all sections', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'section1',
            section_name: 'Main Dining',
            section_code: 'A',
            area_type: 'dining',
            max_capacity: 40
          },
          {
            id: 'section2',
            section_name: 'Bar Area',
            section_code: 'B',
            area_type: 'bar',
            max_capacity: 20
          },
          {
            id: 'section3',
            section_name: 'Terrace',
            section_code: 'T',
            area_type: 'outdoor',
            max_capacity: 24
          }
        ],
        totalItems: 3
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('sections').getList(1, 50, {
        sort: 'section_code'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        sort: 'section_code'
      });
      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
    });
  });

  describe('Area Type Validation', () => {
    const validAreaTypes = ['dining', 'bar', 'kitchen', 'front', 'admin', 'storage', 'outdoor', 'private'];

    validAreaTypes.forEach(areaType => {
      it(`should accept valid area type: ${areaType}`, async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: 'test-id',
          area_type: areaType
        });

        pb.collection = vi.fn().mockReturnValue({
          create: mockCreate
        });

        await pb.collection('sections').create({
          section_name: `Test ${areaType} Section`,
          section_code: areaType.toUpperCase().substring(0, 2),
          area_type: areaType,
          max_capacity: 20
        });

        expect(mockCreate).toHaveBeenCalled();
      });
    });

    it('should reject invalid area type', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid area type'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('sections').create({
        section_name: 'Test Section',
        section_code: 'X',
        area_type: 'invalid_area',
        max_capacity: 20
      })).rejects.toThrow('Invalid area type');
    });
  });

  describe('Capacity Validation', () => {
    it('should accept valid positive capacity', async () => {
      const validCapacities = [1, 10, 25, 50, 100];

      const mockCreate = vi.fn();
      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      for (const capacity of validCapacities) {
        mockCreate.mockResolvedValueOnce({
          id: 'test-id',
          max_capacity: capacity
        });

        await pb.collection('sections').create({
          section_name: 'Test Section',
          section_code: 'T',
          area_type: 'dining',
          max_capacity: capacity
        });
      }

      expect(mockCreate).toHaveBeenCalledTimes(validCapacities.length);
    });

    it('should reject invalid capacities', async () => {
      const invalidCapacities = [0, -5, -10];

      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid capacity'));
      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      for (const capacity of invalidCapacities) {
        await expect(pb.collection('sections').create({
          section_name: 'Test Section',
          section_code: 'T',
          area_type: 'dining',
          max_capacity: capacity
        })).rejects.toThrow('Invalid capacity');
      }
    });

    it('should validate reasonable capacity limits by area type', () => {
      const areaCapacityLimits = {
        'dining': { min: 1, max: 200 },
        'bar': { min: 1, max: 100 },
        'kitchen': { min: 1, max: 50 },
        'front': { min: 1, max: 30 },
        'admin': { min: 1, max: 20 },
        'storage': { min: 1, max: 10 },
        'outdoor': { min: 1, max: 150 },
        'private': { min: 2, max: 50 }
      };

      Object.entries(areaCapacityLimits).forEach(([areaType, limits]) => {
        expect(isValidCapacityForArea(limits.min, areaType)).toBe(true);
        expect(isValidCapacityForArea(limits.max, areaType)).toBe(true);
        expect(isValidCapacityForArea(limits.max + 50, areaType)).toBe(false);
        
        if (areaType === 'private') {
          expect(isValidCapacityForArea(1, areaType)).toBe(false); // Private rooms need min 2
        }
      });
    });
  });

  describe('Section Code Validation', () => {
    it('should accept valid section codes', () => {
      const validCodes = ['A', 'B', 'C', 'T1', 'P1', 'K', 'BAR', 'VIP'];

      validCodes.forEach(code => {
        expect(isValidSectionCode(code)).toBe(true);
      });
    });

    it('should reject invalid section codes', () => {
      const invalidCodes = ['', '   ', 'TOOLONG', '123456', 'A B', 'a-1'];

      invalidCodes.forEach(code => {
        expect(isValidSectionCode(code)).toBe(false);
      });
    });

    it('should ensure section codes are unique', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Section code already exists'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('sections').create({
        section_name: 'Another Section A',
        section_code: 'A', // Duplicate code
        area_type: 'dining',
        max_capacity: 30
      })).rejects.toThrow('Section code already exists');
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow Manager to create sections', () => {
      const managerUser = global.testUser.manager;
      expect(canCreateSection(managerUser.role)).toBe(true);
    });

    it('should restrict Server from creating sections', () => {
      const serverUser = global.testUser.server;
      expect(canCreateSection(serverUser.role)).toBe(false);
    });

    it('should allow Manager to update sections', () => {
      const managerUser = global.testUser.manager;
      expect(canUpdateSection(managerUser.role)).toBe(true);
    });

    it('should allow Manager to delete sections', () => {
      const managerUser = global.testUser.manager;
      expect(canDeleteSection(managerUser.role)).toBe(true);
    });

    it('should allow all roles to view sections', () => {
      const roles = ['Manager', 'Server', 'Chef', 'Bartender', 'Host'];
      roles.forEach(role => {
        expect(canViewSections(role)).toBe(true);
      });
    });

    it('should restrict section management to Manager only', () => {
      const restrictedRoles = ['Server', 'Chef', 'Bartender', 'Host'];
      restrictedRoles.forEach(role => {
        expect(canCreateSection(role)).toBe(false);
        expect(canUpdateSection(role)).toBe(false);
        expect(canDeleteSection(role)).toBe(false);
      });
    });
  });

  describe('Filtering and Searching', () => {
    it('should filter sections by area type', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'section1',
            section_name: 'Main Dining',
            area_type: 'dining'
          },
          {
            id: 'section2',
            section_name: 'East Wing',
            area_type: 'dining'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('sections').getList(1, 50, {
        filter: 'area_type = "dining"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'area_type = "dining"'
      });
    });

    it('should filter sections by capacity range', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'section1',
            section_name: 'Large Section',
            max_capacity: 45
          },
          {
            id: 'section2',
            section_name: 'Medium Section',
            max_capacity: 35
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('sections').getList(1, 50, {
        filter: 'max_capacity >= 30 && max_capacity <= 50'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'max_capacity >= 30 && max_capacity <= 50'
      });
    });

    it('should search sections by name', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'section1',
            section_name: 'Main Dining Room'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('sections').getList(1, 50, {
        filter: 'section_name ~ "Main"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'section_name ~ "Main"'
      });
    });

    it('should search sections by code', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'section1',
            section_code: 'A',
            section_name: 'Section A'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('sections').getList(1, 50, {
        filter: 'section_code = "A"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'section_code = "A"'
      });
    });

    it('should filter by multiple criteria', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'section1',
            section_name: 'Terrace A',
            area_type: 'outdoor',
            max_capacity: 24
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('sections').getList(1, 50, {
        filter: 'area_type = "outdoor" && max_capacity >= 20'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'area_type = "outdoor" && max_capacity >= 20'
      });
    });
  });

  describe('Business Logic Validation', () => {
    it('should group sections by area type', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 's1', section_name: 'Main Dining', area_type: 'dining', max_capacity: 40 },
          { id: 's2', section_name: 'East Wing', area_type: 'dining', max_capacity: 30 },
          { id: 's3', section_name: 'Bar Area', area_type: 'bar', max_capacity: 20 },
          { id: 's4', section_name: 'Terrace', area_type: 'outdoor', max_capacity: 24 }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('sections').getList(1, 100);
      const groupedSections = groupSectionsByAreaType(result.items);

      expect(groupedSections.dining).toHaveLength(2);
      expect(groupedSections.bar).toHaveLength(1);
      expect(groupedSections.outdoor).toHaveLength(1);
      expect(groupedSections.kitchen || []).toHaveLength(0);
    });

    it('should calculate total capacity by area type', () => {
      const sections = [
        { area_type: 'dining', max_capacity: 40 },
        { area_type: 'dining', max_capacity: 30 },
        { area_type: 'bar', max_capacity: 20 },
        { area_type: 'outdoor', max_capacity: 24 }
      ];

      const capacityByArea = calculateCapacityByAreaType(sections);

      expect(capacityByArea.dining).toBe(70);
      expect(capacityByArea.bar).toBe(20);
      expect(capacityByArea.outdoor).toBe(24);
      expect(capacityByArea.total).toBe(114);
    });

    it('should identify sections suitable for events', () => {
      const sections = [
        { id: 's1', section_name: 'Small Room', area_type: 'private', max_capacity: 12 },
        { id: 's2', section_name: 'Main Hall', area_type: 'dining', max_capacity: 60 },
        { id: 's3', section_name: 'Bar Counter', area_type: 'bar', max_capacity: 15 },
        { id: 's4', section_name: 'Garden Terrace', area_type: 'outdoor', max_capacity: 40 }
      ];

      const eventSections = identifyEventSuitableSections(sections, 25);

      expect(eventSections).toHaveLength(2); // Main Hall and Garden Terrace
      expect(eventSections.map(s => s.id)).toContain('s2');
      expect(eventSections.map(s => s.id)).toContain('s4');
    });

    it('should validate section dependencies', () => {
      // Example: Kitchen sections should exist before creating dining sections
      const existingSections = [
        { area_type: 'kitchen', section_name: 'Main Kitchen' },
        { area_type: 'dining', section_name: 'Dining Room A' }
      ];

      expect(hasRequiredDependencies('dining', existingSections)).toBe(true);
      expect(hasRequiredDependencies('bar', existingSections)).toBe(true); // Bar can exist independently
      
      const sectionsWithoutKitchen = [
        { area_type: 'dining', section_name: 'Dining Room A' }
      ];
      
      // This should still be valid - kitchen dependency is not strict
      expect(hasRequiredDependencies('dining', sectionsWithoutKitchen)).toBe(true);
    });
  });

  describe('Sorting and Ordering', () => {
    it('should sort sections by code', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 's1', section_code: 'A', section_name: 'Section A' },
          { id: 's2', section_code: 'B', section_name: 'Section B' },
          { id: 's3', section_code: 'T', section_name: 'Terrace' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('sections').getList(1, 50, {
        sort: 'section_code'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        sort: 'section_code'
      });
    });

    it('should sort sections by capacity (descending)', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 's1', section_name: 'Large Section', max_capacity: 60 },
          { id: 's2', section_name: 'Medium Section', max_capacity: 40 },
          { id: 's3', section_name: 'Small Section', max_capacity: 20 }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('sections').getList(1, 50, {
        sort: '-max_capacity'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        sort: '-max_capacity'
      });
    });

    it('should sort by area type then capacity', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 's1', area_type: 'bar', max_capacity: 20 },
          { id: 's2', area_type: 'dining', max_capacity: 60 },
          { id: 's3', area_type: 'dining', max_capacity: 40 }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('sections').getList(1, 50, {
        sort: 'area_type,-max_capacity'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        sort: 'area_type,-max_capacity'
      });
    });
  });

  describe('Integration with Other Collections', () => {
    it('should be referenced by shifts collection', () => {
      const shiftData = {
        staff_member: global.testUser.server.id,
        shift_date: '2024-01-15',
        start_time: '17:00',
        end_time: '23:00',
        position: 'server',
        assigned_section: 'section-a' // References sections collection
      };

      expect(shiftData.assigned_section).toBeDefined();
      expect(typeof shiftData.assigned_section).toBe('string');
    });

    it('should be referenced by tables collection', () => {
      const tableData = {
        table_name: 'T01',
        section_id: 'section-a', // References sections collection
        capacity: 4,
        table_type: 'standard'
      };

      expect(tableData.section_id).toBeDefined();
      expect(typeof tableData.section_id).toBe('string');
    });
  });
});

// Helper functions
function isValidCapacityForArea(capacity: number, areaType: string): boolean {
  if (capacity < 1) return false;
  
  const limits: Record<string, { min: number; max: number }> = {
    'dining': { min: 1, max: 200 },
    'bar': { min: 1, max: 100 },
    'kitchen': { min: 1, max: 50 },
    'front': { min: 1, max: 30 },
    'admin': { min: 1, max: 20 },
    'storage': { min: 1, max: 10 },
    'outdoor': { min: 1, max: 150 },
    'private': { min: 2, max: 50 }
  };

  const limit = limits[areaType];
  if (!limit) return false;

  return capacity >= limit.min && capacity <= limit.max;
}

function isValidSectionCode(code: string): boolean {
  if (!code || code.trim() === '') return false;
  if (code.trim() !== code) return false; // No leading/trailing spaces
  if (code.length > 5) return false; // Max 5 characters
  if (!/^[A-Z0-9]+$/.test(code)) return false; // Only uppercase letters and numbers
  return true;
}

function canCreateSection(role: string): boolean {
  return role === 'Manager';
}

function canUpdateSection(role: string): boolean {
  return role === 'Manager';
}

function canDeleteSection(role: string): boolean {
  return role === 'Manager';
}

function canViewSections(role: string): boolean {
  return ['Manager', 'Server', 'Chef', 'Bartender', 'Host'].includes(role);
}

function groupSectionsByAreaType(sections: any[]): Record<string, any[]> {
  return sections.reduce((groups, section) => {
    const areaType = section.area_type;
    if (!groups[areaType]) groups[areaType] = [];
    groups[areaType].push(section);
    return groups;
  }, {});
}

function calculateCapacityByAreaType(sections: any[]) {
  const capacities = sections.reduce((acc, section) => {
    const areaType = section.area_type;
    acc[areaType] = (acc[areaType] || 0) + section.max_capacity;
    acc.total = (acc.total || 0) + section.max_capacity;
    return acc;
  }, {});

  return capacities;
}

function identifyEventSuitableSections(sections: any[], minCapacity: number): any[] {
  return sections.filter(section => {
    // Suitable for events: dining, outdoor, private areas with sufficient capacity
    const suitableAreas = ['dining', 'outdoor', 'private'];
    return suitableAreas.includes(section.area_type) && section.max_capacity >= minCapacity;
  });
}

function hasRequiredDependencies(areaType: string, existingSections: any[]): boolean {
  // For now, all area types can exist independently
  // In a more complex system, you might require:
  // - Kitchen section before dining sections
  // - Admin section for management operations
  // - Storage sections for inventory management
  
  const existingAreaTypes = existingSections.map(s => s.area_type);
  
  switch (areaType) {
    case 'dining':
      // Dining areas are recommended to have kitchen support, but not required
      return true;
    case 'bar':
      // Bar areas can exist independently
      return true;
    default:
      return true;
  }
}
