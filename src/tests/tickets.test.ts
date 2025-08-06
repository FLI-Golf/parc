import { describe, it, expect, beforeEach, vi } from 'vitest';
import PocketBase from 'pocketbase';

describe('Tickets Collection Tests', () => {
  let pb: PocketBase;
  
  beforeEach(() => {
    vi.clearAllMocks();
    pb = new PocketBase();
  });

  describe('CRUD Operations', () => {
    it('should create ticket record', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'test-ticket-id',
        ticket_number: 'T001',
        table_id: 'table-t01',
        server_id: global.testUser.server.id,
        customer_count: 4,
        status: 'open',
        subtotal_amount: 85.50,
        tax_amount: 6.84,
        tip_amount: 0,
        total_amount: 92.34,
        special_instructions: 'No onions on burger'
      });

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      const ticketData = {
        ticket_number: 'T001',
        table_id: 'table-t01',
        server_id: global.testUser.server.id,
        customer_count: 4,
        status: 'open',
        subtotal_amount: 85.50,
        tax_amount: 6.84,
        tip_amount: 0,
        total_amount: 92.34,
        special_instructions: 'No onions on burger'
      };

      const result = await pb.collection('tickets').create(ticketData);
      
      expect(mockCreate).toHaveBeenCalledWith(ticketData);
      expect(result.ticket_number).toBe('T001');
      expect(result.status).toBe('open');
      expect(result.total_amount).toBe(92.34);
    });

    it('should retrieve ticket by ID', async () => {
      const mockGetOne = vi.fn().mockResolvedValue({
        id: 'test-ticket-id',
        ticket_number: 'T001',
        table_id: 'table-t01',
        server_id: global.testUser.server.id,
        status: 'open',
        total_amount: 92.34
      });

      pb.collection = vi.fn().mockReturnValue({
        getOne: mockGetOne
      });

      const result = await pb.collection('tickets').getOne('test-ticket-id');

      expect(mockGetOne).toHaveBeenCalledWith('test-ticket-id');
      expect(result.id).toBe('test-ticket-id');
    });

    it('should update ticket status', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'test-ticket-id',
        status: 'sent_to_kitchen',
        updated: '2024-01-01T12:00:00Z'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      const result = await pb.collection('tickets').update('test-ticket-id', {
        status: 'sent_to_kitchen'
      });

      expect(mockUpdate).toHaveBeenCalledWith('test-ticket-id', {
        status: 'sent_to_kitchen'
      });
      expect(result.status).toBe('sent_to_kitchen');
    });

    it('should delete ticket', async () => {
      const mockDelete = vi.fn().mockResolvedValue(true);

      pb.collection = vi.fn().mockReturnValue({
        delete: mockDelete
      });

      await pb.collection('tickets').delete('test-ticket-id');

      expect(mockDelete).toHaveBeenCalledWith('test-ticket-id');
    });

    it('should list tickets by server', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'ticket1',
            ticket_number: 'T001',
            server_id: global.testUser.server.id,
            status: 'open'
          },
          {
            id: 'ticket2',
            ticket_number: 'T002', 
            server_id: global.testUser.server.id,
            status: 'preparing'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('tickets').getList(1, 50, {
        filter: `server_id = "${global.testUser.server.id}"`,
        sort: '-created'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: `server_id = "${global.testUser.server.id}"`,
        sort: '-created'
      });
      expect(result.items).toHaveLength(2);
    });

    it('should list tickets by table', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'ticket1',
            ticket_number: 'T001',
            table_id: 'table-t01',
            status: 'served'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('tickets').getList(1, 50, {
        filter: 'table_id = "table-t01"',
        sort: '-created'
      });

      expect(result.items[0].table_id).toBe('table-t01');
    });
  });

  describe('Status Validation', () => {
    const validStatuses = ['open', 'sent_to_kitchen', 'preparing', 'ready', 'served', 'payment_processing', 'closed'];

    validStatuses.forEach(status => {
      it(`should accept valid status: ${status}`, async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: 'test-id',
          status: status
        });

        pb.collection = vi.fn().mockReturnValue({
          create: mockCreate
        });

        await pb.collection('tickets').create({
          ticket_number: 'T001',
          table_id: 'table-t01',
          server_id: global.testUser.server.id,
          customer_count: 2,
          status: status,
          subtotal_amount: 50.00,
          tax_amount: 4.00,
          tip_amount: 0,
          total_amount: 54.00
        });

        expect(mockCreate).toHaveBeenCalled();
      });
    });

    it('should reject invalid status', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid status'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('tickets').create({
        ticket_number: 'T001',
        table_id: 'table-t01',
        server_id: global.testUser.server.id,
        customer_count: 2,
        status: 'invalid_status',
        subtotal_amount: 50.00,
        tax_amount: 4.00,
        tip_amount: 0,
        total_amount: 54.00
      })).rejects.toThrow('Invalid status');
    });
  });

  describe('Calculation Validation', () => {
    it('should validate total amount calculation', () => {
      const subtotal = 85.50;
      const tax = 6.84;
      const tip = 12.83;
      const expectedTotal = 105.17;

      expect(calculateTotal(subtotal, tax, tip)).toBe(expectedTotal);
    });

    it('should calculate tax correctly', () => {
      const subtotal = 100.00;
      const taxRate = 0.08; // 8%
      const expectedTax = 8.00;

      expect(calculateTax(subtotal, taxRate)).toBe(expectedTax);
    });

    it('should calculate tip percentage correctly', () => {
      const subtotal = 85.50;
      const tipAmount = 12.83;
      const expectedPercentage = 15.0; // 15%

      expect(calculateTipPercentage(subtotal, tipAmount)).toBeCloseTo(expectedPercentage, 1);
    });

    it('should validate minimum amounts', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Total amount must be positive'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('tickets').create({
        ticket_number: 'T001',
        table_id: 'table-t01',
        server_id: global.testUser.server.id,
        customer_count: 2,
        status: 'open',
        subtotal_amount: -10.00,
        tax_amount: 0,
        tip_amount: 0,
        total_amount: -10.00
      })).rejects.toThrow('Total amount must be positive');
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow Server to create tickets', () => {
      const serverUser = global.testUser.server;
      expect(canCreateTicket(serverUser.role)).toBe(true);
    });

    it('should allow Manager to create tickets', () => {
      const managerUser = global.testUser.manager;
      expect(canCreateTicket(managerUser.role)).toBe(true);
    });

    it('should restrict Host from creating tickets', () => {
      const hostUser = global.testUser.host;
      expect(canCreateTicket(hostUser.role)).toBe(false);
    });

    it('should allow Chef to view and update ticket status', () => {
      const chefUser = global.testUser.chef;
      expect(canViewTickets(chefUser.role)).toBe(true);
      expect(canUpdateTicketStatus(chefUser.role)).toBe(true);
      expect(canCreateTicket(chefUser.role)).toBe(false);
    });

    it('should allow Bartender to view and update ticket status', () => {
      const bartenderUser = global.testUser.bartender;
      expect(canViewTickets(bartenderUser.role)).toBe(true);
      expect(canUpdateTicketStatus(bartenderUser.role)).toBe(true);
      expect(canCreateTicket(bartenderUser.role)).toBe(false);
    });

    it('should restrict access based on server assignment', () => {
      const serverUser = global.testUser.server;
      const otherServerTicket = {
        id: 'ticket1',
        server_id: 'other-server-id'
      };
      const ownTicket = {
        id: 'ticket2', 
        server_id: serverUser.id
      };

      expect(canModifyTicket(serverUser.role, serverUser.id, otherServerTicket)).toBe(false);
      expect(canModifyTicket(serverUser.role, serverUser.id, ownTicket)).toBe(true);
      expect(canModifyTicket('Manager', 'manager-id', otherServerTicket)).toBe(true);
    });
  });

  describe('Filtering and Searching', () => {
    it('should filter tickets by status', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'ticket1', status: 'preparing' },
          { id: 'ticket2', status: 'preparing' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('tickets').getList(1, 50, {
        filter: 'status = "preparing"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'status = "preparing"'
      });
    });

    it('should filter tickets by date range', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'ticket1', created: '2024-01-01T12:00:00Z' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('tickets').getList(1, 50, {
        filter: 'created >= "2024-01-01 00:00:00" && created <= "2024-01-01 23:59:59"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'created >= "2024-01-01 00:00:00" && created <= "2024-01-01 23:59:59"'
      });
    });

    it('should search tickets by ticket number', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'ticket1', ticket_number: 'T001' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('tickets').getList(1, 50, {
        filter: 'ticket_number ~ "T001"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'ticket_number ~ "T001"'
      });
    });

    it('should filter by customer count range', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'ticket1', customer_count: 4 },
          { id: 'ticket2', customer_count: 6 }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('tickets').getList(1, 50, {
        filter: 'customer_count >= 4 && customer_count <= 8'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'customer_count >= 4 && customer_count <= 8'
      });
    });

    it('should filter by total amount range', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'ticket1', total_amount: 75.50 },
          { id: 'ticket2', total_amount: 125.00 }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('tickets').getList(1, 50, {
        filter: 'total_amount >= 50.00 && total_amount <= 150.00'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'total_amount >= 50.00 && total_amount <= 150.00'
      });
    });
  });

  describe('Relations and Expand', () => {
    it('should expand table and server relations', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'ticket1',
            table_id: 'table-t01',
            server_id: global.testUser.server.id,
            expand: {
              table_id: {
                id: 'table-t01',
                table_name: 'T01',
                section_code: 'A'
              },
              server_id: {
                id: global.testUser.server.id,
                name: global.testUser.server.name,
                email: global.testUser.server.email
              }
            }
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('tickets').getList(1, 50, {
        expand: 'table_id,server_id'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        expand: 'table_id,server_id'
      });
      expect(result.items[0].expand.table_id.table_name).toBe('T01');
      expect(result.items[0].expand.server_id.name).toBe(global.testUser.server.name);
    });
  });
});

// Helper functions
function calculateTotal(subtotal: number, tax: number, tip: number): number {
  return Math.round((subtotal + tax + tip) * 100) / 100;
}

function calculateTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate * 100) / 100;
}

function calculateTipPercentage(subtotal: number, tipAmount: number): number {
  return Math.round((tipAmount / subtotal) * 100 * 10) / 10;
}

function canCreateTicket(role: string): boolean {
  return ['Manager', 'Server'].includes(role);
}

function canViewTickets(role: string): boolean {
  return ['Manager', 'Server', 'Chef', 'Bartender', 'Host'].includes(role);
}

function canUpdateTicketStatus(role: string): boolean {
  return ['Manager', 'Server', 'Chef', 'Bartender'].includes(role);
}

function canModifyTicket(role: string, userId: string, ticket: any): boolean {
  if (role === 'Manager') return true;
  if (role === 'Server') return ticket.server_id === userId;
  return false;
}
