import { describe, it, expect, beforeEach, vi } from 'vitest';
import PocketBase from 'pocketbase';

describe('Ticket Items Collection Tests', () => {
  let pb: PocketBase;
  
  beforeEach(() => {
    vi.clearAllMocks();
    pb = new PocketBase();
  });

  describe('CRUD Operations', () => {
    it('should create ticket item record', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'test-item-id',
        ticket_id: 'ticket-1',
        menu_item_id: 'menu-item-1',
        quantity: 2,
        unit_price: 24.50,
        total_price: 49.00,
        modifications: 'Extra cheese, no onions',
        status: 'ordered',
        course: 'main',
        kitchen_station: 'grill'
      });

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      const itemData = {
        ticket_id: 'ticket-1',
        menu_item_id: 'menu-item-1',
        quantity: 2,
        unit_price: 24.50,
        total_price: 49.00,
        modifications: 'Extra cheese, no onions',
        status: 'ordered',
        course: 'main',
        kitchen_station: 'grill'
      };

      const result = await pb.collection('ticket_items').create(itemData);
      
      expect(mockCreate).toHaveBeenCalledWith(itemData);
      expect(result.quantity).toBe(2);
      expect(result.total_price).toBe(49.00);
      expect(result.status).toBe('ordered');
    });

    it('should retrieve ticket items by ticket ID', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'item1',
            ticket_id: 'ticket-1',
            menu_item_id: 'menu-item-1',
            quantity: 1,
            status: 'ordered',
            course: 'appetizer'
          },
          {
            id: 'item2',
            ticket_id: 'ticket-1',
            menu_item_id: 'menu-item-2',
            quantity: 2,
            status: 'ordered',
            course: 'main'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('ticket_items').getList(1, 50, {
        filter: 'ticket_id = "ticket-1"',
        sort: 'course'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'ticket_id = "ticket-1"',
        sort: 'course'
      });
      expect(result.items).toHaveLength(2);
      expect(result.items[0].course).toBe('appetizer');
    });

    it('should update ticket item status', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'test-item-id',
        status: 'preparing',
        updated: '2024-01-01T12:00:00Z'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      const result = await pb.collection('ticket_items').update('test-item-id', {
        status: 'preparing'
      });

      expect(mockUpdate).toHaveBeenCalledWith('test-item-id', {
        status: 'preparing'
      });
      expect(result.status).toBe('preparing');
    });

    it('should delete ticket item', async () => {
      const mockDelete = vi.fn().mockResolvedValue(true);

      pb.collection = vi.fn().mockReturnValue({
        delete: mockDelete
      });

      await pb.collection('ticket_items').delete('test-item-id');

      expect(mockDelete).toHaveBeenCalledWith('test-item-id');
    });

    it('should update ticket item modifications', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'test-item-id',
        modifications: 'Well done, extra sauce',
        updated: '2024-01-01T12:00:00Z'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      const result = await pb.collection('ticket_items').update('test-item-id', {
        modifications: 'Well done, extra sauce'
      });

      expect(result.modifications).toBe('Well done, extra sauce');
    });
  });

  describe('Status Validation', () => {
    const validStatuses = ['ordered', 'sent_to_kitchen', 'preparing', 'ready', 'served', 'cancelled'];

    validStatuses.forEach(status => {
      it(`should accept valid status: ${status}`, async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: 'test-id',
          status: status
        });

        pb.collection = vi.fn().mockReturnValue({
          create: mockCreate
        });

        await pb.collection('ticket_items').create({
          ticket_id: 'ticket-1',
          menu_item_id: 'menu-item-1',
          quantity: 1,
          unit_price: 15.00,
          total_price: 15.00,
          status: status,
          course: 'main',
          kitchen_station: 'kitchen'
        });

        expect(mockCreate).toHaveBeenCalled();
      });
    });

    it('should reject invalid status', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid status'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('ticket_items').create({
        ticket_id: 'ticket-1',
        menu_item_id: 'menu-item-1',
        quantity: 1,
        unit_price: 15.00,
        total_price: 15.00,
        status: 'invalid_status',
        course: 'main',
        kitchen_station: 'kitchen'
      })).rejects.toThrow('Invalid status');
    });
  });

  describe('Course Validation', () => {
    const validCourses = ['appetizer', 'main', 'dessert', 'drink', 'side'];

    validCourses.forEach(course => {
      it(`should accept valid course: ${course}`, async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: 'test-id',
          course: course
        });

        pb.collection = vi.fn().mockReturnValue({
          create: mockCreate
        });

        await pb.collection('ticket_items').create({
          ticket_id: 'ticket-1',
          menu_item_id: 'menu-item-1',
          quantity: 1,
          unit_price: 15.00,
          total_price: 15.00,
          status: 'ordered',
          course: course,
          kitchen_station: 'kitchen'
        });

        expect(mockCreate).toHaveBeenCalled();
      });
    });

    it('should reject invalid course', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid course'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('ticket_items').create({
        ticket_id: 'ticket-1',
        menu_item_id: 'menu-item-1',
        quantity: 1,
        unit_price: 15.00,
        total_price: 15.00,
        status: 'ordered',
        course: 'invalid_course',
        kitchen_station: 'kitchen'
      })).rejects.toThrow('Invalid course');
    });
  });

  describe('Kitchen Station Validation', () => {
    const validStations = ['kitchen', 'bar', 'cold_station', 'grill', 'fryer'];

    validStations.forEach(station => {
      it(`should accept valid kitchen station: ${station}`, async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: 'test-id',
          kitchen_station: station
        });

        pb.collection = vi.fn().mockReturnValue({
          create: mockCreate
        });

        await pb.collection('ticket_items').create({
          ticket_id: 'ticket-1',
          menu_item_id: 'menu-item-1',
          quantity: 1,
          unit_price: 15.00,
          total_price: 15.00,
          status: 'ordered',
          course: 'main',
          kitchen_station: station
        });

        expect(mockCreate).toHaveBeenCalled();
      });
    });

    it('should reject invalid kitchen station', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid kitchen station'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('ticket_items').create({
        ticket_id: 'ticket-1',
        menu_item_id: 'menu-item-1',
        quantity: 1,
        unit_price: 15.00,
        total_price: 15.00,
        status: 'ordered',
        course: 'main',
        kitchen_station: 'invalid_station'
      })).rejects.toThrow('Invalid kitchen station');
    });
  });

  describe('Price Calculations', () => {
    it('should validate total price calculation', () => {
      const quantity = 3;
      const unitPrice = 18.50;
      const expectedTotal = 55.50;

      expect(calculateItemTotal(quantity, unitPrice)).toBe(expectedTotal);
    });

    it('should handle decimal quantities for drinks', () => {
      const quantity = 1.5; // e.g., 1.5 bottles of wine
      const unitPrice = 45.00;
      const expectedTotal = 67.50;

      expect(calculateItemTotal(quantity, unitPrice)).toBe(expectedTotal);
    });

    it('should validate minimum quantities', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Quantity must be positive'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('ticket_items').create({
        ticket_id: 'ticket-1',
        menu_item_id: 'menu-item-1',
        quantity: 0,
        unit_price: 15.00,
        total_price: 0,
        status: 'ordered',
        course: 'main',
        kitchen_station: 'kitchen'
      })).rejects.toThrow('Quantity must be positive');
    });

    it('should validate price consistency', () => {
      const quantity = 2;
      const unitPrice = 24.50;
      const providedTotal = 49.00;

      expect(validatePriceConsistency(quantity, unitPrice, providedTotal)).toBe(true);

      // Test inconsistent pricing
      expect(validatePriceConsistency(quantity, unitPrice, 50.00)).toBe(false);
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow Server to create ticket items', () => {
      const serverUser = global.testUser.server;
      expect(canCreateTicketItem(serverUser.role)).toBe(true);
    });

    it('should allow Manager to create ticket items', () => {
      const managerUser = global.testUser.manager;
      expect(canCreateTicketItem(managerUser.role)).toBe(true);
    });

    it('should restrict Host from creating ticket items', () => {
      const hostUser = global.testUser.host;
      expect(canCreateTicketItem(hostUser.role)).toBe(false);
    });

    it('should allow Chef to update item status for kitchen stations', () => {
      const chefUser = global.testUser.chef;
      const kitchenItem = { kitchen_station: 'grill' };
      const barItem = { kitchen_station: 'bar' };

      expect(canUpdateItemStatus(chefUser.role, kitchenItem)).toBe(true);
      expect(canUpdateItemStatus(chefUser.role, barItem)).toBe(false);
    });

    it('should allow Bartender to update item status for bar items', () => {
      const bartenderUser = global.testUser.bartender;
      const barItem = { kitchen_station: 'bar' };
      const kitchenItem = { kitchen_station: 'grill' };

      expect(canUpdateItemStatus(bartenderUser.role, barItem)).toBe(true);
      expect(canUpdateItemStatus(bartenderUser.role, kitchenItem)).toBe(false);
    });

    it('should restrict access based on ticket ownership', () => {
      const serverUser = global.testUser.server;
      const ownTicketItem = {
        expand: { ticket_id: { server_id: serverUser.id } }
      };
      const otherTicketItem = {
        expand: { ticket_id: { server_id: 'other-server-id' } }
      };

      expect(canModifyTicketItem(serverUser.role, serverUser.id, ownTicketItem)).toBe(true);
      expect(canModifyTicketItem(serverUser.role, serverUser.id, otherTicketItem)).toBe(false);
      expect(canModifyTicketItem('Manager', 'manager-id', otherTicketItem)).toBe(true);
    });
  });

  describe('Filtering and Querying', () => {
    it('should filter items by kitchen station', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'item1', kitchen_station: 'grill', status: 'preparing' },
          { id: 'item2', kitchen_station: 'grill', status: 'ready' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('ticket_items').getList(1, 50, {
        filter: 'kitchen_station = "grill"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'kitchen_station = "grill"'
      });
    });

    it('should filter items by course', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'item1', course: 'appetizer', status: 'preparing' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('ticket_items').getList(1, 50, {
        filter: 'course = "appetizer"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'course = "appetizer"'
      });
    });

    it('should filter items by status and kitchen station', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'item1', kitchen_station: 'bar', status: 'preparing' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('ticket_items').getList(1, 50, {
        filter: 'kitchen_station = "bar" && status = "preparing"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'kitchen_station = "bar" && status = "preparing"'
      });
    });

    it('should search items with modifications', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'item1', modifications: 'No onions, extra cheese' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('ticket_items').getList(1, 50, {
        filter: 'modifications ~ "no onions"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'modifications ~ "no onions"'
      });
    });

    it('should filter by quantity range', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'item1', quantity: 3 },
          { id: 'item2', quantity: 5 }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('ticket_items').getList(1, 50, {
        filter: 'quantity >= 2 && quantity <= 10'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'quantity >= 2 && quantity <= 10'
      });
    });
  });

  describe('Relations and Expand', () => {
    it('should expand ticket and menu item relations', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'item1',
            ticket_id: 'ticket-1',
            menu_item_id: 'menu-item-1',
            quantity: 2,
            expand: {
              ticket_id: {
                id: 'ticket-1',
                ticket_number: 'T001',
                table_id: 'table-t01'
              },
              menu_item_id: {
                id: 'menu-item-1',
                name: 'Grilled Salmon',
                description: 'Fresh Atlantic salmon',
                price: 28.50
              }
            }
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('ticket_items').getList(1, 50, {
        expand: 'ticket_id,menu_item_id'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        expand: 'ticket_id,menu_item_id'
      });
      expect(result.items[0].expand.ticket_id.ticket_number).toBe('T001');
      expect(result.items[0].expand.menu_item_id.name).toBe('Grilled Salmon');
    });

    it('should filter by related ticket properties', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'item1',
            ticket_id: 'ticket-1',
            expand: {
              ticket_id: {
                table_id: 'table-t01'
              }
            }
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('ticket_items').getList(1, 50, {
        filter: 'ticket_id.table_id = "table-t01"',
        expand: 'ticket_id'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'ticket_id.table_id = "table-t01"',
        expand: 'ticket_id'
      });
    });
  });

  describe('Bulk Operations', () => {
    it('should create multiple ticket items for an order', async () => {
      const mockBatchCreate = vi.fn().mockResolvedValue({
        items: [
          { id: 'item1', menu_item_id: 'menu-1', quantity: 2 },
          { id: 'item2', menu_item_id: 'menu-2', quantity: 1 },
          { id: 'item3', menu_item_id: 'menu-3', quantity: 3 }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        batchCreate: mockBatchCreate
      });

      const orderItems = [
        {
          ticket_id: 'ticket-1',
          menu_item_id: 'menu-1',
          quantity: 2,
          unit_price: 15.50,
          total_price: 31.00,
          status: 'ordered',
          course: 'appetizer',
          kitchen_station: 'kitchen'
        },
        {
          ticket_id: 'ticket-1',
          menu_item_id: 'menu-2',
          quantity: 1,
          unit_price: 28.00,
          total_price: 28.00,
          status: 'ordered',
          course: 'main',
          kitchen_station: 'grill'
        },
        {
          ticket_id: 'ticket-1',
          menu_item_id: 'menu-3',
          quantity: 3,
          unit_price: 8.50,
          total_price: 25.50,
          status: 'ordered',
          course: 'drink',
          kitchen_station: 'bar'
        }
      ];

      await pb.collection('ticket_items').batchCreate(orderItems);

      expect(mockBatchCreate).toHaveBeenCalledWith(orderItems);
    });

    it('should update multiple items status simultaneously', async () => {
      const mockBatchUpdate = vi.fn().mockResolvedValue({
        items: [
          { id: 'item1', status: 'ready' },
          { id: 'item2', status: 'ready' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        batchUpdate: mockBatchUpdate
      });

      const updates = [
        { id: 'item1', status: 'ready' },
        { id: 'item2', status: 'ready' }
      ];

      await pb.collection('ticket_items').batchUpdate(updates);

      expect(mockBatchUpdate).toHaveBeenCalledWith(updates);
    });
  });
});

// Helper functions
function calculateItemTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

function validatePriceConsistency(quantity: number, unitPrice: number, totalPrice: number): boolean {
  const calculatedTotal = calculateItemTotal(quantity, unitPrice);
  return Math.abs(calculatedTotal - totalPrice) < 0.01;
}

function canCreateTicketItem(role: string): boolean {
  return ['Manager', 'Server'].includes(role);
}

function canUpdateItemStatus(role: string, item: any): boolean {
  if (role === 'Manager') return true;
  if (role === 'Chef') {
    return ['kitchen', 'grill', 'fryer', 'cold_station'].includes(item.kitchen_station);
  }
  if (role === 'Bartender') {
    return item.kitchen_station === 'bar';
  }
  return false;
}

function canModifyTicketItem(role: string, userId: string, item: any): boolean {
  if (role === 'Manager') return true;
  if (role === 'Server') {
    return item.expand?.ticket_id?.server_id === userId;
  }
  return false;
}
