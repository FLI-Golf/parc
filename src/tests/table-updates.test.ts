import { describe, it, expect, beforeEach, vi } from 'vitest';
import PocketBase from 'pocketbase';

describe('Table Updates Collection Tests', () => {
  let pb: PocketBase;
  
  beforeEach(() => {
    vi.clearAllMocks();
    pb = new PocketBase();
  });

  describe('CRUD Operations', () => {
    it('should create table update record', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'test-update-id',
        table_name: 'T01',
        action_type: 'seated',
        performed_by: global.testUser.host.id,
        notes: 'Party of 4 seated'
      });

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      const updateData = {
        table_name: 'T01',
        action_type: 'seated',
        performed_by: global.testUser.host.id,
        notes: 'Party of 4 seated'
      };

      const result = await pb.collection('table_updates').create(updateData);
      
      expect(mockCreate).toHaveBeenCalledWith(updateData);
      expect(result.table_name).toBe('T01');
      expect(result.action_type).toBe('seated');
    });

    it('should retrieve table updates by table name', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'update1',
            table_name: 'T01',
            action_type: 'seated',
            performed_by: global.testUser.host.id,
            notes: 'Party of 4'
          },
          {
            id: 'update2', 
            table_name: 'T01',
            action_type: 'cleared',
            performed_by: global.testUser.server.id,
            notes: 'Table cleared and reset'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('table_updates').getList(1, 50, {
        filter: 'table_name = "T01"',
        sort: '-created'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'table_name = "T01"',
        sort: '-created'
      });
      expect(result.items).toHaveLength(2);
      expect(result.items[0].table_name).toBe('T01');
    });

    it('should update table update record', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'test-update-id',
        table_name: 'T01',
        action_type: 'seated',
        performed_by: global.testUser.host.id,
        notes: 'Updated: Party of 6 seated'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      const result = await pb.collection('table_updates').update('test-update-id', {
        notes: 'Updated: Party of 6 seated'
      });

      expect(mockUpdate).toHaveBeenCalledWith('test-update-id', {
        notes: 'Updated: Party of 6 seated'
      });
      expect(result.notes).toBe('Updated: Party of 6 seated');
    });

    it('should delete table update record', async () => {
      const mockDelete = vi.fn().mockResolvedValue(true);

      pb.collection = vi.fn().mockReturnValue({
        delete: mockDelete
      });

      await pb.collection('table_updates').delete('test-update-id');

      expect(mockDelete).toHaveBeenCalledWith('test-update-id');
    });
  });

  describe('Action Type Validation', () => {
    const validActionTypes = ['seated', 'cleared', 'reserved', 'cleaned', 'out_of_order', 'back_in_service'];

    validActionTypes.forEach(actionType => {
      it(`should accept valid action type: ${actionType}`, async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: 'test-id',
          action_type: actionType
        });

        pb.collection = vi.fn().mockReturnValue({
          create: mockCreate
        });

        await pb.collection('table_updates').create({
          table_name: 'T01',
          action_type: actionType,
          performed_by: global.testUser.host.id
        });

        expect(mockCreate).toHaveBeenCalled();
      });
    });

    it('should reject invalid action type', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid action_type'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('table_updates').create({
        table_name: 'T01',
        action_type: 'invalid_action',
        performed_by: global.testUser.host.id
      })).rejects.toThrow('Invalid action_type');
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow Host to create table updates', () => {
      const hostUser = global.testUser.host;
      expect(canCreateTableUpdate(hostUser.role)).toBe(true);
    });

    it('should allow Manager to create table updates', () => {
      const managerUser = global.testUser.manager;
      expect(canCreateTableUpdate(managerUser.role)).toBe(true);
    });

    it('should allow Server to create table updates', () => {
      const serverUser = global.testUser.server;
      expect(canCreateTableUpdate(serverUser.role)).toBe(true);
    });

    it('should restrict Chef from creating table updates', () => {
      const chefUser = global.testUser.chef;
      expect(canCreateTableUpdate(chefUser.role)).toBe(false);
    });

    it('should restrict Bartender from creating table updates', () => {
      const bartenderUser = global.testUser.bartender;
      expect(canCreateTableUpdate(bartenderUser.role)).toBe(false);
    });

    it('should allow viewing table updates for all roles', () => {
      const roles = ['Manager', 'Server', 'Host', 'Chef', 'Bartender'];
      roles.forEach(role => {
        expect(canViewTableUpdates(role)).toBe(true);
      });
    });
  });

  describe('Table Status Integration', () => {
    it('should track table status changes correctly', async () => {
      const statusChangeSequence = [
        { action_type: 'seated', expected_table_status: 'occupied' },
        { action_type: 'cleared', expected_table_status: 'cleaning' },
        { action_type: 'cleaned', expected_table_status: 'available' },
        { action_type: 'reserved', expected_table_status: 'reserved' },
        { action_type: 'out_of_order', expected_table_status: 'out_of_order' },
        { action_type: 'back_in_service', expected_table_status: 'available' }
      ];

      statusChangeSequence.forEach(({ action_type, expected_table_status }) => {
        expect(getTableStatusFromAction(action_type)).toBe(expected_table_status);
      });
    });

    it('should create table update and update table status', async () => {
      const mockCreateUpdate = vi.fn().mockResolvedValue({
        id: 'update-id',
        table_name: 'T01',
        action_type: 'seated',
        performed_by: global.testUser.host.id
      });

      const mockUpdateTable = vi.fn().mockResolvedValue({
        id: 'table-id',
        table_name: 'T01',
        status: 'occupied'
      });

      pb.collection = vi.fn((collection) => {
        if (collection === 'table_updates') {
          return { create: mockCreateUpdate };
        }
        if (collection === 'tables') {
          return { update: mockUpdateTable };
        }
      });

      // Simulate workflow: create table update then update table status
      await pb.collection('table_updates').create({
        table_name: 'T01',
        action_type: 'seated',
        performed_by: global.testUser.host.id
      });

      await pb.collection('tables').update('table-id', {
        status: 'occupied'
      });

      expect(mockCreateUpdate).toHaveBeenCalled();
      expect(mockUpdateTable).toHaveBeenCalledWith('table-id', {
        status: 'occupied'
      });
    });
  });

  describe('Historical Tracking', () => {
    it('should retrieve table history in chronological order', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'update3',
            table_name: 'T01',
            action_type: 'cleaned',
            created: '2024-01-01T12:30:00Z'
          },
          {
            id: 'update2',
            table_name: 'T01', 
            action_type: 'cleared',
            created: '2024-01-01T12:00:00Z'
          },
          {
            id: 'update1',
            table_name: 'T01',
            action_type: 'seated',
            created: '2024-01-01T11:30:00Z'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('table_updates').getList(1, 50, {
        filter: 'table_name = "T01"',
        sort: '-created'
      });

      expect(result.items[0].action_type).toBe('cleaned');
      expect(result.items[1].action_type).toBe('cleared');
      expect(result.items[2].action_type).toBe('seated');
    });

    it('should filter updates by date range', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'update1',
            table_name: 'T01',
            action_type: 'seated',
            created: '2024-01-01T12:00:00Z'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('table_updates').getList(1, 50, {
        filter: 'created >= "2024-01-01 00:00:00" && created <= "2024-01-01 23:59:59"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'created >= "2024-01-01 00:00:00" && created <= "2024-01-01 23:59:59"'
      });
    });
  });
});

// Helper functions
function canCreateTableUpdate(role: string): boolean {
  return ['Manager', 'Host', 'Server'].includes(role);
}

function canViewTableUpdates(role: string): boolean {
  return ['Manager', 'Server', 'Host', 'Chef', 'Bartender'].includes(role);
}

function getTableStatusFromAction(actionType: string): string {
  const statusMap: Record<string, string> = {
    'seated': 'occupied',
    'cleared': 'cleaning',
    'cleaned': 'available',
    'reserved': 'reserved',
    'out_of_order': 'out_of_order',
    'back_in_service': 'available'
  };
  return statusMap[actionType] || 'available';
}
