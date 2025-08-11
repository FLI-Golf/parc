import { describe, it, expect } from 'vitest';

describe('Business Logic & Data Validation', () => {
  
  describe('Ticket Validation', () => {
    it('should validate ticket data before creation', () => {
      const validTicketData = {
        table_id: 'table_001',
        server_id: 'y75ww2u9169kinb',
        customer_count: 4
      };

      const result = validateTicketData(validTicketData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid ticket data', () => {
      const invalidTicketData = {
        table_id: '',
        server_id: 'invalid_server',
        customer_count: 0
      };

      const result = validateTicketData(invalidTicketData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Table ID is required');
      expect(result.errors).toContain('Customer count must be greater than 0');
    });

    it('should validate menu item additions', () => {
      const validItem = {
        menu_item_id: 'item_001',
        quantity: 2,
        special_instructions: 'No onions'
      };

      const result = validateTicketItem(validItem);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid menu item data', () => {
      const invalidItem = {
        menu_item_id: '',
        quantity: -1,
        special_instructions: 'a'.repeat(501) // Too long
      };

      const result = validateTicketItem(invalidItem);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Menu item ID is required');
      expect(result.errors).toContain('Quantity must be greater than 0');
      expect(result.errors).toContain('Special instructions too long');
    });
  });

  describe('Business Rules', () => {
    it('should enforce table capacity limits', () => {
      const table = { id: 'table_001', capacity: 4, status: 'available' };
      
      expect(canSeatParty(table, 3)).toBe(true);
      expect(canSeatParty(table, 4)).toBe(true);
      expect(canSeatParty(table, 5)).toBe(false);
      expect(canSeatParty({ ...table, status: 'occupied' }, 2)).toBe(false);
    });

    it('should calculate accurate pricing with tax and tips', () => {
      const orderItems = [
        { price: 25.00, quantity: 2 }, // $50.00
        { price: 15.50, quantity: 1 }  // $15.50
      ];

      const pricing = calculateOrderPricing(orderItems, {
        tax_rate: 0.089,
        suggested_tip_rates: [0.15, 0.18, 0.20]
      });

      expect(pricing.subtotal).toBe(65.50);
      expect(pricing.tax_amount).toBeCloseTo(5.83, 2);
      expect(pricing.total_before_tip).toBeCloseTo(71.33, 2);
      expect(pricing.suggested_tips).toEqual([
        { rate: 0.15, amount: 9.82 },
        { rate: 0.18, amount: 11.79 },
        { rate: 0.20, amount: 13.1 }
      ]);
    });

    it('should enforce shift scheduling rules', () => {
      const staff = { id: 'staff_001', role: 'Server', max_hours_per_week: 40 };
      const currentWeekHours = 35;
      const proposedShift = { duration: 8, date: '2024-01-15' };

      const result = validateShiftScheduling(staff, currentWeekHours, proposedShift);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('would exceed maximum hours');
    });

    it('should validate inventory minimum levels', () => {
      const inventoryItem = {
        id: 'inv_001',
        name: 'Beef Tenderloin',
        current_quantity: 5,
        minimum_level: 10,
        unit: 'lbs'
      };

      const alert = checkInventoryLevel(inventoryItem);
      expect(alert.needs_reorder).toBe(true);
      expect(alert.severity).toBe('warning');
      expect(alert.message).toContain('below minimum level');
    });
  });

  describe('Payment Processing', () => {
    it('should validate payment amounts', () => {
      const ticket = { total_amount: 85.47 };
      
      expect(validatePaymentAmount(100.00, ticket.total_amount)).toBe(true);
      expect(validatePaymentAmount(85.47, ticket.total_amount)).toBe(true);
      expect(validatePaymentAmount(80.00, ticket.total_amount)).toBe(false);
    });

    it('should calculate change correctly', () => {
      const ticket = { total_amount: 85.47 };
      const payment = 100.00;
      
      const change = calculateChange(payment, ticket.total_amount);
      expect(change).toBeCloseTo(14.53, 2);
    });

    it('should validate card payment data', () => {
      const validCard = {
        number: '4111111111111111',
        expiry: '12/25',
        cvv: '123',
        amount: 85.47
      };

      const result = validateCardPayment(validCard);
      expect(result.isValid).toBe(true);
    });
  });
});

// Implementation functions for business logic
function validateTicketData(data: any) {
  const errors: string[] = [];
  
  if (!data.table_id || data.table_id.trim() === '') {
    errors.push('Table ID is required');
  }
  if (!data.server_id || data.server_id.trim() === '') {
    errors.push('Server ID is required');
  }
  if (!data.customer_count || data.customer_count <= 0) {
    errors.push('Customer count must be greater than 0');
  }
  
  return { isValid: errors.length === 0, errors };
}

function validateTicketItem(item: any) {
  const errors: string[] = [];
  
  if (!item.menu_item_id || item.menu_item_id.trim() === '') {
    errors.push('Menu item ID is required');
  }
  if (!item.quantity || item.quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  }
  if (item.special_instructions && item.special_instructions.length > 500) {
    errors.push('Special instructions too long');
  }
  
  return { isValid: errors.length === 0, errors };
}

function canSeatParty(table: any, partySize: number) {
  return table.status === 'available' && table.capacity >= partySize;
}

function calculateOrderPricing(items: any[], options: any) {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax_amount = subtotal * options.tax_rate;
  const total_before_tip = subtotal + tax_amount;
  
  const suggested_tips = options.suggested_tip_rates.map((rate: number) => ({
    rate,
    amount: Number((subtotal * rate).toFixed(2))
  }));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    tax_amount: Number(tax_amount.toFixed(2)),
    total_before_tip: Number(total_before_tip.toFixed(2)),
    suggested_tips
  };
}

function validateShiftScheduling(staff: any, currentHours: number, shift: any) {
  if (currentHours + shift.duration > staff.max_hours_per_week) {
    return {
      isValid: false,
      reason: `Shift would exceed maximum hours per week (${staff.max_hours_per_week})`
    };
  }
  return { isValid: true };
}

function checkInventoryLevel(item: any) {
  const needs_reorder = item.current_quantity < item.minimum_level;
  return {
    needs_reorder,
    severity: needs_reorder ? 'warning' : 'normal',
    message: needs_reorder ? 
      `${item.name} is below minimum level (${item.current_quantity}/${item.minimum_level} ${item.unit})` :
      'Inventory level adequate'
  };
}

function validatePaymentAmount(payment: number, total: number) {
  return payment >= total;
}

function calculateChange(payment: number, total: number) {
  return Number((payment - total).toFixed(2));
}

function validateCardPayment(card: any) {
  const errors: string[] = [];
  
  // Basic card validation (in real app, use proper validation library)
  if (!card.number || !/^\d{16}$/.test(card.number.replace(/\s/g, ''))) {
    errors.push('Invalid card number');
  }
  if (!card.expiry || !/^\d{2}\/\d{2}$/.test(card.expiry)) {
    errors.push('Invalid expiry date');
  }
  if (!card.cvv || !/^\d{3,4}$/.test(card.cvv)) {
    errors.push('Invalid CVV');
  }
  if (!card.amount || card.amount <= 0) {
    errors.push('Invalid amount');
  }
  
  return { isValid: errors.length === 0, errors };
}
