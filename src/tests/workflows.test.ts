import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Restaurant Workflow Tests', () => {
  
  describe('Server Ticket Management', () => {
    it('should create a new ticket with correct initial state', () => {
      const serverUser = global.testUser.server;
      const newTicket = createTicket({
        table_id: 'table_001',
        server_id: serverUser.id,
        customer_count: 4
      });

      expect(newTicket).toMatchObject({
        table_id: 'table_001',
        server_id: serverUser.id,
        customer_count: 4,
        status: 'open',
        subtotal_amount: 0,
        tax_amount: 0,
        total_amount: 0
      });
      expect(newTicket.id).toBeDefined();
      expect(newTicket.ticket_number).toMatch(/^T\d+$/);
      expect(new Date(newTicket.created)).toBeInstanceOf(Date);
    });

    it('should add items to ticket and calculate totals correctly', () => {
      const ticket = createTicket({
        table_id: 'table_001',
        server_id: global.testUser.server.id,
        customer_count: 2
      });

      const menuItems = [
        { id: 'item_001', name: 'Steak Frites', price: 28.50, quantity: 1 },
        { id: 'item_002', name: 'Wine Glass', price: 12.00, quantity: 2 }
      ];

      const updatedTicket = addItemsToTicket(ticket, menuItems);
      
      expect(updatedTicket.subtotal_amount).toBe(52.50); // 28.50 + (12.00 * 2)
      expect(updatedTicket.tax_amount).toBeCloseTo(4.67, 2); // ~8.9% tax
      expect(updatedTicket.total_amount).toBeCloseTo(57.17, 2);
    });

    it('should update ticket status through workflow stages', async () => {
      const ticket = createTicket({
        table_id: 'table_001',
        server_id: global.testUser.server.id,
        customer_count: 2
      });

      // Test workflow: open -> sent_to_kitchen -> preparing -> ready -> served -> closed
      const workflows = [
        { from: 'open', to: 'sent_to_kitchen', user: 'Server' },
        { from: 'sent_to_kitchen', to: 'preparing', user: 'Chef' },
        { from: 'preparing', to: 'ready', user: 'Chef' },
        { from: 'ready', to: 'served', user: 'Server' },
        { from: 'served', to: 'payment_processing', user: 'Server' },
        { from: 'payment_processing', to: 'closed', user: 'Server' }
      ];

      let currentTicket = ticket;
      for (const workflow of workflows) {
        const result = updateTicketStatus(currentTicket, workflow.to, workflow.user);
        expect(result.status).toBe(workflow.to);
        expect(result.updated).toBeDefined();
        expect(typeof result.updated).toBe('string');
        currentTicket = result;
      }
    });

    it('should prevent invalid status transitions', () => {
      const ticket = createTicket({
        table_id: 'table_001',
        server_id: global.testUser.server.id,
        customer_count: 2
      });

      // Test invalid transitions
      expect(() => updateTicketStatus(ticket, 'closed', 'Server')).toThrow('Invalid status transition');
      expect(() => updateTicketStatus(ticket, 'preparing', 'Server')).toThrow('Invalid status transition');
    });
  });

  describe('Kitchen Operations (Chef Workflow)', () => {
    it('should allow chef to view pending orders', () => {
      const pendingTickets = [
        { id: 'T001', status: 'sent_to_kitchen', table_id: 'table_001' },
        { id: 'T002', status: 'preparing', table_id: 'table_002' },
        { id: 'T003', status: 'ready', table_id: 'table_003' },
        { id: 'T004', status: 'served', table_id: 'table_004' }
      ];

      const kitchenView = getKitchenTickets(pendingTickets);
      
      expect(kitchenView).toHaveLength(3);
      expect(kitchenView.map(t => t.status)).toEqual([
        'sent_to_kitchen', 'preparing', 'ready'
      ]);
    });

    it('should allow chef to update cooking status', () => {
      const ticket = {
        id: 'T001',
        status: 'sent_to_kitchen',
        table_id: 'table_001'
      };

      const updatedTicket = updateTicketStatus(ticket, 'preparing', 'Chef');
      expect(updatedTicket.status).toBe('preparing');
    });

    it('should track cooking times for performance metrics', async () => {
      const ticket = {
        id: 'T001',
        status: 'sent_to_kitchen',
        created: new Date('2024-01-01T18:00:00Z').toISOString(),
        kitchen_start_time: null,
        kitchen_ready_time: null
      };

      // Start cooking
      const cookingTicket = updateTicketStatus(ticket, 'preparing', 'Chef');
      expect(cookingTicket.kitchen_start_time).toBeDefined();

      // Add delay to ensure measurable cooking time
      await new Promise(resolve => setTimeout(resolve, 10));

      // Mark as ready
      const readyTicket = updateTicketStatus(cookingTicket, 'ready', 'Chef');
      expect(readyTicket.kitchen_ready_time).toBeDefined();

      // Calculate cooking time
      const cookingTime = getCookingTime(readyTicket);
      expect(cookingTime).toBeGreaterThan(0);
    });
  });

  describe('Manager Reporting & Analytics', () => {
    it('should calculate daily sales summary', () => {
      const dailyTickets = [
        { total_amount: 45.67, status: 'closed', created: '2024-01-01T12:00:00Z' },
        { total_amount: 78.92, status: 'closed', created: '2024-01-01T13:30:00Z' },
        { total_amount: 123.45, status: 'closed', created: '2024-01-01T19:15:00Z' },
        { total_amount: 89.33, status: 'payment_processing', created: '2024-01-01T20:00:00Z' }
      ];

      const summary = calculateDailySales(dailyTickets);
      
      expect(summary).toMatchObject({
        total_revenue: 248.04, // Only closed tickets
        total_transactions: 3,
        average_ticket: 82.68,
        pending_amount: 89.33
      });
    });

    it('should generate staff performance metrics', () => {
      const tickets = [
        { server_id: 'server_001', total_amount: 150.00, status: 'closed' },
        { server_id: 'server_001', total_amount: 89.50, status: 'closed' },
        { server_id: 'server_002', total_amount: 200.00, status: 'closed' },
        { server_id: 'server_002', total_amount: 75.25, status: 'closed' }
      ];

      const performance = calculateStaffPerformance(tickets);
      
      expect(performance).toEqual({
        server_001: { ticket_count: 2, total_sales: 239.50, average_ticket: 119.75 },
        server_002: { ticket_count: 2, total_sales: 275.25, average_ticket: 137.63 }
      });
    });
  });

  describe('Table Management (Host Workflow)', () => {
    it('should track table availability and status', () => {
      const tables = [
        { id: 'table_001', capacity: 4, status: 'available' },
        { id: 'table_002', capacity: 2, status: 'occupied' },
        { id: 'table_003', capacity: 6, status: 'reserved' }
      ];

      const availability = getTableAvailability(tables);
      
      expect(availability).toMatchObject({
        available: 1,
        occupied: 1,
        reserved: 1,
        total_capacity: 12,
        available_capacity: 4
      });
    });

    it('should assign optimal table for party size', () => {
      const tables = [
        { id: 'table_001', capacity: 2, status: 'available' },
        { id: 'table_002', capacity: 4, status: 'available' },
        { id: 'table_003', capacity: 6, status: 'available' }
      ];

      const assignment = assignOptimalTable(tables, 3);
      expect(assignment.id).toBe('table_002'); // Best fit for party of 3
    });
  });
});

// Implementation functions (these would be in your actual business logic modules)
function createTicket(data: any) {
  return {
    id: `ticket_${Date.now()}`,
    ticket_number: `T${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    ...data,
    status: 'open',
    subtotal_amount: 0,
    tax_amount: 0,
    total_amount: 0,
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };
}

function addItemsToTicket(ticket: any, items: any[]) {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax_rate = 0.089; // 8.9% tax
  const tax_amount = subtotal * tax_rate;
  const total_amount = subtotal + tax_amount;

  return {
    ...ticket,
    subtotal_amount: subtotal,
    tax_amount: Number(tax_amount.toFixed(2)),
    total_amount: Number(total_amount.toFixed(2)),
    updated: new Date().toISOString()
  };
}

function updateTicketStatus(ticket: any, newStatus: string, userRole: string) {
  const validTransitions = {
    'open': ['sent_to_kitchen'],
    'sent_to_kitchen': ['preparing'],
    'preparing': ['ready'],
    'ready': ['served'],
    'served': ['payment_processing'],
    'payment_processing': ['closed']
  };

  if (!validTransitions[ticket.status]?.includes(newStatus)) {
    throw new Error('Invalid status transition');
  }

  const updates: any = {
    ...ticket,
    status: newStatus,
    updated: new Date().toISOString()
  };

  if (newStatus === 'preparing') {
    updates.kitchen_start_time = new Date().toISOString();
  }
  if (newStatus === 'ready') {
    updates.kitchen_ready_time = new Date().toISOString();
  }

  return updates;
}

function getKitchenTickets(tickets: any[]) {
  return tickets.filter(t => ['sent_to_kitchen', 'preparing', 'ready'].includes(t.status));
}

function getCookingTime(ticket: any) {
  if (!ticket.kitchen_start_time || !ticket.kitchen_ready_time) return 0;
  return new Date(ticket.kitchen_ready_time).getTime() - new Date(ticket.kitchen_start_time).getTime();
}

function calculateDailySales(tickets: any[]) {
  const closedTickets = tickets.filter(t => t.status === 'closed');
  const pendingTickets = tickets.filter(t => t.status === 'payment_processing');
  
  const total_revenue = closedTickets.reduce((sum, t) => sum + t.total_amount, 0);
  const pending_amount = pendingTickets.reduce((sum, t) => sum + t.total_amount, 0);
  
  return {
    total_revenue: Number(total_revenue.toFixed(2)),
    total_transactions: closedTickets.length,
    average_ticket: Number((total_revenue / closedTickets.length).toFixed(2)),
    pending_amount: Number(pending_amount.toFixed(2))
  };
}

function calculateStaffPerformance(tickets: any[]) {
  const performance: any = {};
  
  tickets.forEach(ticket => {
    if (!performance[ticket.server_id]) {
      performance[ticket.server_id] = { ticket_count: 0, total_sales: 0 };
    }
    performance[ticket.server_id].ticket_count++;
    performance[ticket.server_id].total_sales += ticket.total_amount;
  });

  Object.keys(performance).forEach(serverId => {
    const data = performance[serverId];
    data.average_ticket = Number((data.total_sales / data.ticket_count).toFixed(2));
  });

  return performance;
}

function getTableAvailability(tables: any[]) {
  const availability = {
    available: 0,
    occupied: 0, 
    reserved: 0,
    total_capacity: 0,
    available_capacity: 0
  };

  tables.forEach(table => {
    availability[table.status]++;
    availability.total_capacity += table.capacity;
    if (table.status === 'available') {
      availability.available_capacity += table.capacity;
    }
  });

  return availability;
}

function assignOptimalTable(tables: any[], partySize: number) {
  const availableTables = tables.filter(t => t.status === 'available' && t.capacity >= partySize);
  return availableTables.sort((a, b) => a.capacity - b.capacity)[0];
}
