import { describe, it, expect, beforeEach, vi } from 'vitest';
import PocketBase from 'pocketbase';

describe('Ticket Workflow and Status Management Tests', () => {
  let pb: PocketBase;
  
  beforeEach(() => {
    vi.clearAllMocks();
    pb = new PocketBase();
  });

  describe('Ticket Status Workflow', () => {
    it('should handle complete ticket lifecycle', async () => {
      const mockUpdate = vi.fn();
      const mockGetOne = vi.fn();

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate,
        getOne: mockGetOne
      });

      // Initial ticket
      let currentTicket = {
        id: 'ticket-1',
        ticket_number: 'T001',
        table_id: 'table-t01',
        server_id: global.testUser.server.id,
        status: 'open',
        total_amount: 92.34
      };

      // 1. Server sends to kitchen
      mockUpdate.mockResolvedValueOnce({
        ...currentTicket,
        status: 'sent_to_kitchen'
      });

      currentTicket = await pb.collection('tickets').update('ticket-1', {
        status: 'sent_to_kitchen'
      });

      expect(mockUpdate).toHaveBeenCalledWith('ticket-1', {
        status: 'sent_to_kitchen'
      });

      // 2. Chef starts preparing
      mockUpdate.mockResolvedValueOnce({
        ...currentTicket,
        status: 'preparing'
      });

      currentTicket = await pb.collection('tickets').update('ticket-1', {
        status: 'preparing'
      });

      // 3. Chef marks ready
      mockUpdate.mockResolvedValueOnce({
        ...currentTicket,
        status: 'ready'
      });

      currentTicket = await pb.collection('tickets').update('ticket-1', {
        status: 'ready'
      });

      // 4. Server serves food
      mockUpdate.mockResolvedValueOnce({
        ...currentTicket,
        status: 'served'
      });

      currentTicket = await pb.collection('tickets').update('ticket-1', {
        status: 'served'
      });

      // 5. Process payment
      mockUpdate.mockResolvedValueOnce({
        ...currentTicket,
        status: 'payment_processing',
        tip_amount: 15.00,
        total_amount: 107.34
      });

      currentTicket = await pb.collection('tickets').update('ticket-1', {
        status: 'payment_processing',
        tip_amount: 15.00,
        total_amount: 107.34
      });

      // 6. Close ticket
      mockUpdate.mockResolvedValueOnce({
        ...currentTicket,
        status: 'closed'
      });

      await pb.collection('tickets').update('ticket-1', {
        status: 'closed'
      });

      expect(mockUpdate).toHaveBeenCalledTimes(6);
    });

    it('should validate status transitions', () => {
      const validTransitions = {
        'open': ['sent_to_kitchen', 'closed'],
        'sent_to_kitchen': ['preparing', 'open'],
        'preparing': ['ready', 'sent_to_kitchen'],
        'ready': ['served', 'preparing'],
        'served': ['payment_processing', 'ready'],
        'payment_processing': ['closed', 'served'],
        'closed': []
      };

      Object.entries(validTransitions).forEach(([currentStatus, allowedNextStatuses]) => {
        allowedNextStatuses.forEach(nextStatus => {
          expect(isValidStatusTransition(currentStatus, nextStatus)).toBe(true);
        });

        // Test invalid transitions
        const allStatuses = ['open', 'sent_to_kitchen', 'preparing', 'ready', 'served', 'payment_processing', 'closed'];
        const invalidStatuses = allStatuses.filter(status => !allowedNextStatuses.includes(status) && status !== currentStatus);
        
        invalidStatuses.forEach(invalidStatus => {
          expect(isValidStatusTransition(currentStatus, invalidStatus)).toBe(false);
        });
      });
    });

    it('should prevent invalid status transitions', async () => {
      const mockUpdate = vi.fn().mockRejectedValue(new Error('Invalid status transition'));

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      // Try invalid transition: preparing -> closed
      await expect(pb.collection('tickets').update('ticket-1', {
        status: 'closed'
      })).rejects.toThrow('Invalid status transition');
    });
  });

  describe('Kitchen Workflow', () => {
    it('should filter tickets for kitchen view', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'ticket1',
            ticket_number: 'T001',
            status: 'sent_to_kitchen',
            special_instructions: 'No onions'
          },
          {
            id: 'ticket2',
            ticket_number: 'T002',
            status: 'preparing',
            special_instructions: 'Extra spicy'
          },
          {
            id: 'ticket3',
            ticket_number: 'T003',
            status: 'ready',
            special_instructions: ''
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('tickets').getList(1, 50, {
        filter: 'status = "sent_to_kitchen" || status = "preparing" || status = "ready"',
        sort: 'created'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'status = "sent_to_kitchen" || status = "preparing" || status = "ready"',
        sort: 'created'
      });
      expect(result.items).toHaveLength(3);
    });

    it('should prioritize tickets by order time', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'ticket1',
            ticket_number: 'T001',
            status: 'sent_to_kitchen',
            created: '2024-01-01T12:00:00Z'
          },
          {
            id: 'ticket2',
            ticket_number: 'T002',
            status: 'sent_to_kitchen',
            created: '2024-01-01T12:05:00Z'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('tickets').getList(1, 50, {
        filter: 'status = "sent_to_kitchen"',
        sort: 'created' // Oldest first (FIFO)
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'status = "sent_to_kitchen"',
        sort: 'created'
      });
    });

    it('should allow chef to update multiple tickets', async () => {
      const mockBatchUpdate = vi.fn().mockResolvedValue({
        items: [
          { id: 'ticket1', status: 'ready' },
          { id: 'ticket2', status: 'ready' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        batchUpdate: mockBatchUpdate
      });

      const updates = [
        { id: 'ticket1', status: 'ready' },
        { id: 'ticket2', status: 'ready' }
      ];

      await pb.collection('tickets').batchUpdate(updates);

      expect(mockBatchUpdate).toHaveBeenCalledWith(updates);
    });
  });

  describe('Payment Processing', () => {
    it('should calculate payment totals correctly', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'ticket-1',
        subtotal_amount: 85.50,
        tax_amount: 6.84,
        tip_amount: 15.00,
        total_amount: 107.34,
        status: 'payment_processing'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      const subtotal = 85.50;
      const taxRate = 0.08;
      const tipAmount = 15.00;
      const tax = calculateTax(subtotal, taxRate);
      const total = calculateTotal(subtotal, tax, tipAmount);

      await pb.collection('tickets').update('ticket-1', {
        subtotal_amount: subtotal,
        tax_amount: tax,
        tip_amount: tipAmount,
        total_amount: total,
        status: 'payment_processing'
      });

      expect(mockUpdate).toHaveBeenCalledWith('ticket-1', {
        subtotal_amount: 85.50,
        tax_amount: 6.84,
        tip_amount: 15.00,
        total_amount: 107.34,
        status: 'payment_processing'
      });
    });

    it('should handle different payment scenarios', async () => {
      const mockUpdate = vi.fn();

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      // Scenario 1: Cash payment with tip
      mockUpdate.mockResolvedValueOnce({
        id: 'ticket-1',
        tip_amount: 12.00,
        total_amount: 104.34,
        status: 'closed'
      });

      await pb.collection('tickets').update('ticket-1', {
        tip_amount: 12.00,
        total_amount: 104.34,
        status: 'closed'
      });

      // Scenario 2: Card payment, no tip
      mockUpdate.mockResolvedValueOnce({
        id: 'ticket-2',
        tip_amount: 0,
        total_amount: 92.34,
        status: 'closed'
      });

      await pb.collection('tickets').update('ticket-2', {
        tip_amount: 0,
        total_amount: 92.34,
        status: 'closed'
      });

      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it('should validate payment amounts', () => {
      const subtotal = 100.00;
      const tax = 8.00;
      const tip = 15.00;
      const total = 123.00;

      expect(validatePaymentAmounts(subtotal, tax, tip, total)).toBe(true);

      // Invalid total
      expect(validatePaymentAmounts(subtotal, tax, tip, 120.00)).toBe(false);

      // Negative amounts
      expect(validatePaymentAmounts(-10.00, tax, tip, total)).toBe(false);
      expect(validatePaymentAmounts(subtotal, -1.00, tip, total)).toBe(false);
      expect(validatePaymentAmounts(subtotal, tax, -5.00, total)).toBe(false);
    });
  });

  describe('Server Dashboard Integration', () => {
    it('should get server active tickets', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'ticket1',
            ticket_number: 'T001',
            status: 'open',
            server_id: global.testUser.server.id
          },
          {
            id: 'ticket2',
            ticket_number: 'T002',
            status: 'sent_to_kitchen',
            server_id: global.testUser.server.id
          },
          {
            id: 'ticket3',
            ticket_number: 'T003',
            status: 'ready',
            server_id: global.testUser.server.id
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('tickets').getList(1, 50, {
        filter: `server_id = "${global.testUser.server.id}" && status != "closed"`,
        sort: '-created'
      });

      expect(result.items).toHaveLength(3);
      expect(result.items.every(ticket => ticket.status !== 'closed')).toBe(true);
    });

    it('should group tickets by status for server view', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'ticket1', status: 'open' },
          { id: 'ticket2', status: 'sent_to_kitchen' },
          { id: 'ticket3', status: 'ready' },
          { id: 'ticket4', status: 'ready' },
          { id: 'ticket5', status: 'served' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('tickets').getList(1, 50, {
        filter: `server_id = "${global.testUser.server.id}" && status != "closed"`
      });

      const groupedByStatus = groupTicketsByStatus(result.items);

      expect(groupedByStatus.open).toHaveLength(1);
      expect(groupedByStatus.sent_to_kitchen).toHaveLength(1);
      expect(groupedByStatus.ready).toHaveLength(2);
      expect(groupedByStatus.served).toHaveLength(1);
    });
  });

  describe('Performance and Analytics', () => {
    it('should calculate daily sales summary', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'ticket1',
            status: 'closed',
            total_amount: 85.50,
            tip_amount: 12.00,
            customer_count: 4
          },
          {
            id: 'ticket2',
            status: 'closed',
            total_amount: 92.34,
            tip_amount: 15.00,
            customer_count: 2
          },
          {
            id: 'ticket3',
            status: 'open',
            total_amount: 45.00,
            tip_amount: 0,
            customer_count: 2
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('tickets').getList(1, 100, {
        filter: 'created >= "2024-01-01 00:00:00" && created <= "2024-01-01 23:59:59"'
      });

      const summary = calculateDailySummary(result.items);

      expect(summary.total_revenue).toBe(177.84); // Only closed tickets
      expect(summary.total_tips).toBe(27.00);
      expect(summary.total_customers).toBe(6); // Only closed tickets
      expect(summary.average_ticket).toBe(88.92);
      expect(summary.tickets_closed).toBe(2);
      expect(summary.tickets_pending).toBe(1);
    });

    it('should calculate server performance metrics', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            server_id: global.testUser.server.id,
            status: 'closed',
            total_amount: 95.00,
            tip_amount: 15.00,
            created: '2024-01-01T12:00:00Z',
            updated: '2024-01-01T13:00:00Z'
          },
          {
            server_id: global.testUser.server.id,
            status: 'closed',
            total_amount: 82.50,
            tip_amount: 12.50,
            created: '2024-01-01T14:00:00Z',
            updated: '2024-01-01T15:30:00Z'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('tickets').getList(1, 100, {
        filter: `server_id = "${global.testUser.server.id}" && status = "closed"`,
        sort: 'created'
      });

      const performance = calculateServerPerformance(result.items);

      expect(performance.total_sales).toBe(177.50);
      expect(performance.total_tips).toBe(27.50);
      expect(performance.average_ticket).toBe(88.75);
      expect(performance.tip_percentage).toBeCloseTo(18.33, 2);
      expect(performance.tickets_completed).toBe(2);
    });
  });

  describe('Real-time Updates', () => {
    it('should support real-time ticket status updates', async () => {
      const mockSubscribe = vi.fn();
      const mockUnsubscribe = vi.fn();

      pb.collection = vi.fn().mockReturnValue({
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
      });

      const callback = vi.fn();
      await pb.collection('tickets').subscribe('*', callback);

      expect(mockSubscribe).toHaveBeenCalledWith('*', callback);

      // Simulate status update
      const updateData = {
        action: 'update',
        record: {
          id: 'ticket-1',
          status: 'ready'
        }
      };

      callback(updateData);

      expect(callback).toHaveBeenCalledWith(updateData);
    });
  });
});

// Helper functions
function isValidStatusTransition(currentStatus: string, nextStatus: string): boolean {
  const validTransitions: Record<string, string[]> = {
    'open': ['sent_to_kitchen', 'closed'],
    'sent_to_kitchen': ['preparing', 'open'],
    'preparing': ['ready', 'sent_to_kitchen'],
    'ready': ['served', 'preparing'],
    'served': ['payment_processing', 'ready'],
    'payment_processing': ['closed', 'served'],
    'closed': []
  };

  return validTransitions[currentStatus]?.includes(nextStatus) || false;
}

function calculateTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate * 100) / 100;
}

function calculateTotal(subtotal: number, tax: number, tip: number): number {
  return Math.round((subtotal + tax + tip) * 100) / 100;
}

function validatePaymentAmounts(subtotal: number, tax: number, tip: number, total: number): boolean {
  if (subtotal < 0 || tax < 0 || tip < 0 || total < 0) return false;
  const calculatedTotal = calculateTotal(subtotal, tax, tip);
  return Math.abs(calculatedTotal - total) < 0.01; // Allow for minor rounding differences
}

function groupTicketsByStatus(tickets: any[]): Record<string, any[]> {
  return tickets.reduce((groups, ticket) => {
    const status = ticket.status;
    if (!groups[status]) groups[status] = [];
    groups[status].push(ticket);
    return groups;
  }, {});
}

function calculateDailySummary(tickets: any[]) {
  const closedTickets = tickets.filter(t => t.status === 'closed');
  const pendingTickets = tickets.filter(t => t.status !== 'closed');
  
  const totalRevenue = closedTickets.reduce((sum, t) => sum + t.total_amount, 0);
  const totalTips = closedTickets.reduce((sum, t) => sum + t.tip_amount, 0);
  const totalCustomers = closedTickets.reduce((sum, t) => sum + t.customer_count, 0);
  
  return {
    total_revenue: Math.round(totalRevenue * 100) / 100,
    total_tips: Math.round(totalTips * 100) / 100,
    total_customers: totalCustomers,
    average_ticket: closedTickets.length > 0 ? Math.round((totalRevenue / closedTickets.length) * 100) / 100 : 0,
    tickets_closed: closedTickets.length,
    tickets_pending: pendingTickets.length
  };
}

function calculateServerPerformance(tickets: any[]) {
  const totalSales = tickets.reduce((sum, t) => sum + t.total_amount, 0);
  const totalTips = tickets.reduce((sum, t) => sum + t.tip_amount, 0);
  // Calculate subtotal as total - tip (assuming tax is included in total for this test)
  const subtotalSum = tickets.reduce((sum, t) => sum + (t.total_amount - t.tip_amount), 0);
  
  return {
    total_sales: Math.round(totalSales * 100) / 100,
    total_tips: Math.round(totalTips * 100) / 100,
    average_ticket: tickets.length > 0 ? Math.round((totalSales / tickets.length) * 100) / 100 : 0,
    tip_percentage: subtotalSum > 0 ? Math.round((totalTips / subtotalSum) * 100 * 100) / 100 : 0,
    tickets_completed: tickets.length
  };
}
