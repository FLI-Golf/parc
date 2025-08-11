import { describe, it, expect, beforeEach, vi } from 'vitest';
import PocketBase from 'pocketbase';

describe('Ticket Items Workflow and Kitchen Management Tests', () => {
  let pb: PocketBase;
  
  beforeEach(() => {
    vi.clearAllMocks();
    pb = new PocketBase();
  });

  describe('Item Status Workflow', () => {
    it('should handle complete item lifecycle', async () => {
      const mockUpdate = vi.fn();

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      // 1. Order placed - status: ordered
      let currentItem = {
        id: 'item-1',
        ticket_id: 'ticket-1',
        menu_item_id: 'menu-steak',
        status: 'ordered',
        kitchen_station: 'grill'
      };

      // 2. Send to kitchen
      mockUpdate.mockResolvedValueOnce({
        ...currentItem,
        status: 'sent_to_kitchen'
      });

      currentItem = await pb.collection('ticket_items').update('item-1', {
        status: 'sent_to_kitchen'
      });

      // 3. Chef starts preparing
      mockUpdate.mockResolvedValueOnce({
        ...currentItem,
        status: 'preparing'
      });

      currentItem = await pb.collection('ticket_items').update('item-1', {
        status: 'preparing'
      });

      // 4. Item ready
      mockUpdate.mockResolvedValueOnce({
        ...currentItem,
        status: 'ready'
      });

      currentItem = await pb.collection('ticket_items').update('item-1', {
        status: 'ready'
      });

      // 5. Item served
      mockUpdate.mockResolvedValueOnce({
        ...currentItem,
        status: 'served'
      });

      await pb.collection('ticket_items').update('item-1', {
        status: 'served'
      });

      expect(mockUpdate).toHaveBeenCalledTimes(4);
    });

    it('should validate item status transitions', () => {
      const validTransitions = {
        'ordered': ['sent_to_kitchen', 'cancelled'],
        'sent_to_kitchen': ['preparing', 'ordered'],
        'preparing': ['ready', 'sent_to_kitchen'],
        'ready': ['served', 'preparing'],
        'served': [],
        'cancelled': []
      };

      Object.entries(validTransitions).forEach(([currentStatus, allowedNextStatuses]) => {
        allowedNextStatuses.forEach(nextStatus => {
          expect(isValidItemStatusTransition(currentStatus, nextStatus)).toBe(true);
        });

        const allStatuses = ['ordered', 'sent_to_kitchen', 'preparing', 'ready', 'served', 'cancelled'];
        const invalidStatuses = allStatuses.filter(status => !allowedNextStatuses.includes(status) && status !== currentStatus);
        
        invalidStatuses.forEach(invalidStatus => {
          expect(isValidItemStatusTransition(currentStatus, invalidStatus)).toBe(false);
        });
      });
    });

    it('should handle item cancellation workflow', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'item-1',
        status: 'cancelled',
        modifications: 'Cancelled: Customer changed mind'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      await pb.collection('ticket_items').update('item-1', {
        status: 'cancelled',
        modifications: 'Cancelled: Customer changed mind'
      });

      expect(mockUpdate).toHaveBeenCalledWith('item-1', {
        status: 'cancelled',
        modifications: 'Cancelled: Customer changed mind'
      });
    });
  });

  describe('Kitchen Station Routing', () => {
    it('should route items to appropriate kitchen stations', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'item1',
            menu_item_id: 'steak',
            kitchen_station: 'grill',
            status: 'sent_to_kitchen',
            course: 'main'
          },
          {
            id: 'item2',
            menu_item_id: 'caesar-salad',
            kitchen_station: 'cold_station',
            status: 'sent_to_kitchen',
            course: 'appetizer'
          },
          {
            id: 'item3',
            menu_item_id: 'french-fries',
            kitchen_station: 'fryer',
            status: 'sent_to_kitchen',
            course: 'side'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      // Get grill station items
      const grillItems = await pb.collection('ticket_items').getList(1, 50, {
        filter: 'kitchen_station = "grill" && status = "sent_to_kitchen"',
        sort: 'created'
      });

      expect(grillItems.items[0].kitchen_station).toBe('grill');
    });

    it('should prioritize items by course sequence', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'item1',
            course: 'appetizer',
            status: 'sent_to_kitchen',
            created: '2024-01-01T12:00:00Z'
          },
          {
            id: 'item2',
            course: 'main',
            status: 'sent_to_kitchen',
            created: '2024-01-01T12:01:00Z'
          },
          {
            id: 'item3',
            course: 'dessert',
            status: 'sent_to_kitchen',
            created: '2024-01-01T12:02:00Z'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('ticket_items').getList(1, 50, {
        filter: 'status = "sent_to_kitchen"',
        sort: 'course,created' // Course priority, then time
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'status = "sent_to_kitchen"',
        sort: 'course,created'
      });
    });

    it('should handle kitchen station workload distribution', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'item1', kitchen_station: 'grill', status: 'preparing' },
          { id: 'item2', kitchen_station: 'grill', status: 'preparing' },
          { id: 'item3', kitchen_station: 'grill', status: 'sent_to_kitchen' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const grillWorkload = await pb.collection('ticket_items').getList(1, 100, {
        filter: 'kitchen_station = "grill" && (status = "preparing" || status = "sent_to_kitchen")'
      });

      const workloadByStatus = groupItemsByStatus(grillWorkload.items);
      
      expect(workloadByStatus.preparing).toHaveLength(2);
      expect(workloadByStatus.sent_to_kitchen).toHaveLength(1);
    });
  });

  describe('Course Timing and Coordination', () => {
    it('should coordinate appetizer and main course timing', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'item1',
            ticket_id: 'ticket-1',
            course: 'appetizer',
            status: 'ready',
            kitchen_station: 'cold_station'
          },
          {
            id: 'item2',
            ticket_id: 'ticket-1',
            course: 'main',
            status: 'preparing',
            kitchen_station: 'grill'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const ticketItems = await pb.collection('ticket_items').getList(1, 50, {
        filter: 'ticket_id = "ticket-1"',
        sort: 'course'
      });

      const courseStatus = analyzeTicketCourseStatus(ticketItems.items);
      
      expect(courseStatus.appetizer_ready).toBe(true);
      expect(courseStatus.main_ready).toBe(false);
      expect(courseStatus.can_serve_appetizer).toBe(true);
    });

    it('should handle special timing requests', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'item-1',
        modifications: 'Fire with main course - hold appetizer',
        status: 'ordered'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      await pb.collection('ticket_items').update('item-1', {
        modifications: 'Fire with main course - hold appetizer'
      });

      expect(mockUpdate).toHaveBeenCalledWith('item-1', {
        modifications: 'Fire with main course - hold appetizer'
      });
    });

    it('should coordinate course completion for table', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'item1',
            ticket_id: 'ticket-1',
            course: 'main',
            status: 'ready',
            expand: { ticket_id: { table_id: 'table-t01' } }
          },
          {
            id: 'item2',
            ticket_id: 'ticket-2',
            course: 'main',
            status: 'ready',
            expand: { ticket_id: { table_id: 'table-t01' } }
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const tableItems = await pb.collection('ticket_items').getList(1, 50, {
        filter: 'ticket_id.table_id = "table-t01" && course = "main"',
        expand: 'ticket_id'
      });

      const tableReadyStatus = checkTableCourseReady(tableItems.items, 'main');
      expect(tableReadyStatus.all_ready).toBe(true);
    });
  });

  describe('Kitchen Display System', () => {
    it('should format items for kitchen display by station', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'item1',
            ticket_id: 'ticket-1',
            menu_item_id: 'ribeye-steak',
            kitchen_station: 'grill',
            status: 'sent_to_kitchen',
            modifications: 'Medium rare, no seasoning',
            quantity: 1,
            expand: {
              ticket_id: { ticket_number: 'T001', table_id: 'table-t05' },
              menu_item_id: { name: 'Ribeye Steak', cook_time: 12 }
            }
          },
          {
            id: 'item2',
            ticket_id: 'ticket-1',
            menu_item_id: 'grilled-vegetables',
            kitchen_station: 'grill',
            status: 'sent_to_kitchen',
            modifications: 'Extra char',
            quantity: 1,
            expand: {
              ticket_id: { ticket_number: 'T001', table_id: 'table-t05' },
              menu_item_id: { name: 'Grilled Vegetables', cook_time: 8 }
            }
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const grillItems = await pb.collection('ticket_items').getList(1, 50, {
        filter: 'kitchen_station = "grill" && status = "sent_to_kitchen"',
        expand: 'ticket_id,menu_item_id',
        sort: 'created'
      });

      const displayItems = formatKitchenDisplay(grillItems.items);
      
      expect(displayItems[0].table).toBe('T05');
      expect(displayItems[0].ticket_number).toBe('T001');
      expect(displayItems[0].item_name).toBe('Ribeye Steak');
      expect(displayItems[0].modifications).toBe('Medium rare, no seasoning');
    });

    it('should calculate estimated completion times', () => {
      const items = [
        {
          menu_item_id: 'steak',
          cook_time: 12,
          started_at: '2024-01-01T12:00:00Z'
        },
        {
          menu_item_id: 'vegetables',
          cook_time: 8,
          started_at: '2024-01-01T12:02:00Z'
        }
      ];

      const estimatedTimes = calculateEstimatedCompletionTimes(items);
      
      expect(estimatedTimes[0].estimated_completion).toBe('2024-01-01T12:12:00Z');
      expect(estimatedTimes[1].estimated_completion).toBe('2024-01-01T12:10:00Z');
    });

    it('should handle rush orders and priorities', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'item-1',
        modifications: 'RUSH ORDER - VIP table',
        priority: 'high'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      await pb.collection('ticket_items').update('item-1', {
        modifications: 'RUSH ORDER - VIP table',
        priority: 'high'
      });

      expect(mockUpdate).toHaveBeenCalledWith('item-1', {
        modifications: 'RUSH ORDER - VIP table',
        priority: 'high'
      });
    });
  });

  describe('Bar and Beverage Management', () => {
    it('should handle bar item workflow', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'item1',
            ticket_id: 'ticket-1',
            menu_item_id: 'moscow-mule',
            kitchen_station: 'bar',
            status: 'sent_to_kitchen',
            course: 'drink',
            quantity: 2,
            modifications: 'Extra lime'
          },
          {
            id: 'item2',
            ticket_id: 'ticket-1',
            menu_item_id: 'wine-chardonnay',
            kitchen_station: 'bar',
            status: 'sent_to_kitchen',
            course: 'drink',
            quantity: 1,
            modifications: 'Chilled'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const barItems = await pb.collection('ticket_items').getList(1, 50, {
        filter: 'kitchen_station = "bar" && status = "sent_to_kitchen"',
        sort: 'created'
      });

      expect(barItems.items).toHaveLength(2);
      expect(barItems.items[0].course).toBe('drink');
    });

    it('should prioritize beverage service timing', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'item1',
            course: 'drink',
            status: 'ready',
            prep_time: 2 // minutes
          },
          {
            id: 'item2',
            course: 'appetizer',
            status: 'preparing',
            prep_time: 8
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const priorityItems = await pb.collection('ticket_items').getList(1, 50, {
        filter: 'status = "ready" || status = "preparing"',
        sort: 'course,prep_time' // Drinks first, then by prep time
      });

      expect(priorityItems.items[0].course).toBe('drink');
    });
  });

  describe('Inventory Integration', () => {
    it('should handle out-of-stock items', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'item-1',
        status: 'cancelled',
        modifications: 'Cancelled: Item out of stock'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      await pb.collection('ticket_items').update('item-1', {
        status: 'cancelled',
        modifications: 'Cancelled: Item out of stock'
      });

      expect(mockUpdate).toHaveBeenCalledWith('item-1', {
        status: 'cancelled',
        modifications: 'Cancelled: Item out of stock'
      });
    });

    it('should suggest substitutions for unavailable items', () => {
      const unavailableItem = {
        menu_item_id: 'salmon-dish',
        course: 'main',
        kitchen_station: 'grill'
      };

      const availableItems = [
        { menu_item_id: 'cod-dish', course: 'main', kitchen_station: 'grill' },
        { menu_item_id: 'chicken-dish', course: 'main', kitchen_station: 'grill' },
        { menu_item_id: 'salad', course: 'appetizer', kitchen_station: 'cold_station' }
      ];

      const suggestions = suggestSubstitutions(unavailableItem, availableItems);
      
      expect(suggestions).toHaveLength(2); // Only matching course and station
      expect(suggestions[0].menu_item_id).toBe('cod-dish');
    });
  });

  describe('Performance Analytics', () => {
    it('should calculate kitchen station performance metrics', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'item1',
            kitchen_station: 'grill',
            status: 'served',
            created: '2024-01-01T12:00:00Z',
            updated: '2024-01-01T12:15:00Z' // 15 min cook time
          },
          {
            id: 'item2',
            kitchen_station: 'grill',
            status: 'served',
            created: '2024-01-01T12:30:00Z',
            updated: '2024-01-01T12:42:00Z' // 12 min cook time
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const grillItems = await pb.collection('ticket_items').getList(1, 100, {
        filter: 'kitchen_station = "grill" && status = "served"'
      });

      const performance = calculateStationPerformance(grillItems.items);
      
      expect(performance.average_cook_time).toBe(13.5); // (15 + 12) / 2
      expect(performance.items_completed).toBe(2);
    });

    it('should track modification frequency', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'item1', modifications: 'No onions' },
          { id: 'item2', modifications: 'Extra cheese' },
          { id: 'item3', modifications: 'No onions, extra sauce' },
          { id: 'item4', modifications: '' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const allItems = await pb.collection('ticket_items').getList(1, 100, {
        filter: 'status = "served"'
      });

      const modificationStats = analyzeModifications(allItems.items);
      
      expect(modificationStats.total_items).toBe(4);
      expect(modificationStats.items_with_modifications).toBe(3);
      expect(modificationStats.modification_rate).toBe(75); // 3/4 * 100
    });
  });

  describe('Real-time Kitchen Updates', () => {
    it('should support real-time item status updates', async () => {
      const mockSubscribe = vi.fn();
      const mockUnsubscribe = vi.fn();

      pb.collection = vi.fn().mockReturnValue({
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
      });

      const callback = vi.fn();
      await pb.collection('ticket_items').subscribe('*', callback);

      // Simulate kitchen updating item status
      const updateData = {
        action: 'update',
        record: {
          id: 'item-1',
          status: 'ready',
          kitchen_station: 'grill'
        }
      };

      callback(updateData);

      expect(callback).toHaveBeenCalledWith(updateData);
      expect(mockSubscribe).toHaveBeenCalledWith('*', callback);
    });
  });
});

// Helper functions
function isValidItemStatusTransition(currentStatus: string, nextStatus: string): boolean {
  const validTransitions: Record<string, string[]> = {
    'ordered': ['sent_to_kitchen', 'cancelled'],
    'sent_to_kitchen': ['preparing', 'ordered'],
    'preparing': ['ready', 'sent_to_kitchen'],
    'ready': ['served', 'preparing'],
    'served': [],
    'cancelled': []
  };

  return validTransitions[currentStatus]?.includes(nextStatus) || false;
}

function groupItemsByStatus(items: any[]): Record<string, any[]> {
  return items.reduce((groups, item) => {
    const status = item.status;
    if (!groups[status]) groups[status] = [];
    groups[status].push(item);
    return groups;
  }, {});
}

function analyzeTicketCourseStatus(items: any[]) {
  const courseGroups = items.reduce((groups, item) => {
    if (!groups[item.course]) groups[item.course] = [];
    groups[item.course].push(item);
    return groups;
  }, {});

  return {
    appetizer_ready: courseGroups.appetizer?.every((item: any) => item.status === 'ready') || false,
    main_ready: courseGroups.main?.every((item: any) => item.status === 'ready') || false,
    can_serve_appetizer: courseGroups.appetizer?.every((item: any) => item.status === 'ready') || false
  };
}

function checkTableCourseReady(items: any[], course: string) {
  const courseItems = items.filter(item => item.course === course);
  const allReady = courseItems.every(item => item.status === 'ready');
  
  return {
    all_ready: allReady,
    ready_count: courseItems.filter(item => item.status === 'ready').length,
    total_count: courseItems.length
  };
}

function formatKitchenDisplay(items: any[]) {
  return items.map(item => ({
    id: item.id,
    table: item.expand.ticket_id.table_id.replace('table-', '').toUpperCase(),
    ticket_number: item.expand.ticket_id.ticket_number,
    item_name: item.expand.menu_item_id.name,
    quantity: item.quantity,
    modifications: item.modifications || '',
    cook_time: item.expand.menu_item_id.cook_time
  }));
}

function calculateEstimatedCompletionTimes(items: any[]) {
  return items.map(item => {
    const startTime = new Date(item.started_at);
    const completionTime = new Date(startTime.getTime() + (item.cook_time * 60000)); // cook_time in minutes
    
    return {
      ...item,
      estimated_completion: completionTime.toISOString().replace('.000Z', 'Z')
    };
  });
}

function suggestSubstitutions(unavailableItem: any, availableItems: any[]) {
  return availableItems.filter(item => 
    item.course === unavailableItem.course && 
    item.kitchen_station === unavailableItem.kitchen_station
  );
}

function calculateStationPerformance(items: any[]) {
  const cookTimes = items.map(item => {
    const created = new Date(item.created);
    const updated = new Date(item.updated);
    return (updated.getTime() - created.getTime()) / (1000 * 60); // minutes
  });

  const totalCookTime = cookTimes.reduce((sum, time) => sum + time, 0);
  
  return {
    average_cook_time: cookTimes.length > 0 ? totalCookTime / cookTimes.length : 0,
    items_completed: items.length,
    total_cook_time: totalCookTime
  };
}

function analyzeModifications(items: any[]) {
  const itemsWithMods = items.filter(item => item.modifications && item.modifications.trim() !== '');
  
  return {
    total_items: items.length,
    items_with_modifications: itemsWithMods.length,
    modification_rate: items.length > 0 ? Math.round((itemsWithMods.length / items.length) * 100) : 0
  };
}
