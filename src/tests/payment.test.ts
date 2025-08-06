import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Payment Processing System', () => {
  let mockTicket: any;
  let mockStripeCard: any;

  beforeEach(() => {
    mockTicket = {
      id: 'ticket_001',
      ticket_number: 'T001',
      table_id: 'table_005',
      server_id: 'y75ww2u9169kinb',
      subtotal_amount: 125.50,
      tax_amount: 11.17,
      total_amount: 136.67,
      status: 'served',
      customer_count: 4
    };

    mockStripeCard = {
      number: '4242424242424242',
      exp_month: 12,
      exp_year: 2025,
      cvc: '123'
    };
  });

  describe('Cash Payments', () => {
    it('should process exact cash payment successfully', () => {
      const cashPayment = {
        method: 'cash',
        amount: 136.67,
        received: 136.67
      };

      const result = processCashPayment(mockTicket, cashPayment);
      
      expect(result.success).toBe(true);
      expect(result.change_due).toBe(0);
      expect(result.payment_id).toBeDefined();
      expect(result.processed_at).toBeDefined();
      expect(result.receipt_data).toMatchObject({
        ticket_number: 'T001',
        payment_method: 'cash',
        amount_paid: 136.67,
        change: 0
      });
    });

    it('should calculate change correctly for overpayment', () => {
      const cashPayment = {
        method: 'cash',
        amount: 136.67,
        received: 150.00
      };

      const result = processCashPayment(mockTicket, cashPayment);
      
      expect(result.success).toBe(true);
      expect(result.change_due).toBe(13.33);
      expect(result.receipt_data.change).toBe(13.33);
    });

    it('should reject insufficient cash payment', () => {
      const cashPayment = {
        method: 'cash',
        amount: 136.67,
        received: 120.00
      };

      const result = processCashPayment(mockTicket, cashPayment);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient payment amount');
      expect(result.shortfall).toBe(16.67);
    });

    it('should handle cash payments with tips', () => {
      const cashPayment = {
        method: 'cash',
        amount: 136.67,
        tip_amount: 25.00,
        received: 170.00
      };

      const result = processCashPayment(mockTicket, cashPayment);
      
      expect(result.success).toBe(true);
      expect(result.total_paid).toBe(161.67); // ticket + tip
      expect(result.change_due).toBe(8.33);
      expect(result.tip_amount).toBe(25.00);
    });
  });

  describe('Card Payments', () => {
    it('should process card payment successfully', async () => {
      const cardPayment = {
        method: 'card',
        amount: 136.67,
        card_data: mockStripeCard,
        tip_amount: 20.00
      };

      const result = await processCardPayment(mockTicket, cardPayment);
      
      expect(result.success).toBe(true);
      expect(result.transaction_id).toBeDefined();
      expect(result.total_charged).toBe(156.67); // ticket + tip
      expect(result.payment_processor).toBe('stripe');
      expect(result.card_last_four).toBe('4242');
    });

    it('should handle card payment failures', async () => {
      const invalidCardPayment = {
        method: 'card',
        amount: 136.67,
        card_data: {
          ...mockStripeCard,
          number: '4000000000000002' // Declined card
        }
      };

      const result = await processCardPayment(mockTicket, invalidCardPayment);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Card declined');
      expect(result.decline_code).toBeDefined();
    });

    it('should validate card data before processing', async () => {
      const invalidCardPayment = {
        method: 'card',
        amount: 136.67,
        card_data: {
          number: '1234', // Invalid
          exp_month: 13,  // Invalid
          exp_year: 2020, // Expired
          cvc: '12'       // Too short
        }
      };

      const result = await processCardPayment(mockTicket, invalidCardPayment);
      
      expect(result.success).toBe(false);
      expect(result.validation_errors).toContain('Invalid card number');
      expect(result.validation_errors).toContain('Invalid expiry month');
      expect(result.validation_errors).toContain('Card expired');
      expect(result.validation_errors).toContain('Invalid CVC');
    });
  });

  describe('Split Payments', () => {
    it('should handle split payment between cash and card', async () => {
      const splitPayment = {
        method: 'split',
        payments: [
          { type: 'cash', amount: 80.00, received: 80.00 },
          { type: 'card', amount: 56.67, card_data: mockStripeCard, tip_amount: 15.00 }
        ]
      };

      const result = await processSplitPayment(mockTicket, splitPayment);
      
      expect(result.success).toBe(true);
      expect(result.total_paid).toBe(151.67); // 80 + 56.67 + 15 tip
      expect(result.payments).toHaveLength(2);
      expect(result.payments[0].method).toBe('cash');
      expect(result.payments[1].method).toBe('card');
    });

    it('should reject split payment if total is insufficient', async () => {
      const splitPayment = {
        method: 'split',
        payments: [
          { type: 'cash', amount: 50.00, received: 50.00 },
          { type: 'card', amount: 50.00, card_data: mockStripeCard }
        ]
      };

      const result = await processSplitPayment(mockTicket, splitPayment);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Split payment total insufficient');
      expect(result.total_provided).toBe(100.00);
      expect(result.amount_due).toBe(136.67);
    });

    it('should handle multiple card splits', async () => {
      const splitPayment = {
        method: 'split',
        payments: [
          { type: 'card', amount: 68.33, card_data: mockStripeCard },
          { type: 'card', amount: 68.34, card_data: {...mockStripeCard, number: '4111111111111111'} }
        ]
      };

      const result = await processSplitPayment(mockTicket, splitPayment);
      
      expect(result.success).toBe(true);
      expect(result.total_paid).toBeCloseTo(136.67, 2);
      expect(result.payments.every(p => p.method === 'card')).toBe(true);
    });
  });

  describe('Refunds and Returns', () => {
    it('should process full refund successfully', async () => {
      const completedPayment = {
        id: 'payment_001',
        ticket_id: 'ticket_001',
        amount: 136.67,
        method: 'card',
        transaction_id: 'ch_test_123456',
        status: 'completed'
      };

      const result = await processRefund(completedPayment, {
        type: 'full',
        reason: 'Kitchen error - wrong order',
        authorized_by: 'f191z14z2679pzf' // Manager ID
      });
      
      expect(result.success).toBe(true);
      expect(result.refund_amount).toBe(136.67);
      expect(result.refund_id).toBeDefined();
      expect(result.original_payment_id).toBe('payment_001');
      expect(result.status).toBe('refunded');
    });

    it('should process partial refund for item removal', async () => {
      const completedPayment = {
        id: 'payment_001',
        ticket_id: 'ticket_001', 
        amount: 136.67,
        method: 'card',
        status: 'completed'
      };

      const result = await processRefund(completedPayment, {
        type: 'partial',
        amount: 25.50, // Price of removed item + tax
        reason: 'Customer allergic to item',
        authorized_by: 'f191z14z2679pzf'
      });
      
      expect(result.success).toBe(true);
      expect(result.refund_amount).toBe(25.50);
      expect(result.remaining_charge).toBeCloseTo(111.17, 2);
    });

    it('should reject refund without manager authorization', async () => {
      const completedPayment = {
        id: 'payment_001',
        amount: 136.67,
        method: 'card',
        status: 'completed'
      };

      const result = await processRefund(completedPayment, {
        type: 'full',
        reason: 'Customer request',
        authorized_by: 'y75ww2u9169kinb' // Server ID (not manager)
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Refunds require manager authorization');
    });

    it('should handle refund failures gracefully', async () => {
      const completedPayment = {
        id: 'payment_001',
        amount: 136.67,
        method: 'card',
        transaction_id: 'invalid_transaction',
        status: 'completed'
      };

      const result = await processRefund(completedPayment, {
        type: 'full',
        reason: 'Kitchen error',
        authorized_by: 'f191z14z2679pzf'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Refund processing failed');
    });
  });

  describe('Payment Reconciliation', () => {
    it('should calculate daily payment summary', () => {
      const dailyPayments = [
        { method: 'cash', amount: 45.67, tip: 8.00, status: 'completed' },
        { method: 'card', amount: 89.23, tip: 15.00, status: 'completed' },
        { method: 'cash', amount: 67.89, tip: 12.00, status: 'completed' },
        { method: 'card', amount: 123.45, tip: 0, status: 'failed' }, // Should be excluded
        { method: 'split', amount: 78.90, tip: 14.00, status: 'completed' }
      ];

      const summary = calculatePaymentSummary(dailyPayments);
      
      expect(summary.total_revenue).toBeCloseTo(281.69, 2); // Excluding failed payment
      expect(summary.total_tips).toBe(49.00);
      expect(summary.cash_total).toBe(113.56); // 45.67 + 67.89
      expect(summary.card_total).toBe(89.23);
      expect(summary.split_total).toBe(78.90);
      expect(summary.transaction_count).toBe(4);
      expect(summary.failed_transactions).toBe(1);
    });

    it('should identify payment discrepancies', () => {
      const reportedCash = 245.67;
      const systemCash = 238.45;
      
      const discrepancy = checkCashDiscrepancy(reportedCash, systemCash);
      
      expect(discrepancy.has_discrepancy).toBe(true);
      expect(discrepancy.difference).toBe(7.22);
      expect(discrepancy.type).toBe('overage');
      expect(discrepancy.requires_investigation).toBe(true);
    });
  });

  describe('Receipt Generation', () => {
    it('should generate complete receipt data', () => {
      const payment = {
        ticket: mockTicket,
        payment_method: 'card',
        amount_paid: 136.67,
        tip_amount: 20.00,
        card_last_four: '4242',
        transaction_id: 'ch_test_123456'
      };

      const receipt = generateReceipt(payment);
      
      expect(receipt).toMatchObject({
        restaurant_name: 'PARC Bistro',
        ticket_number: 'T001',
        table_number: 'table_005',
        server_name: expect.any(String),

        subtotal: 125.50,
        tax: 11.17,
        tip: 20.00,
        total: 156.67,
        payment_method: 'card',
        card_info: '****4242',
        timestamp: expect.any(String)
      });
    });

    it('should generate receipt for cash payment with change', () => {
      const payment = {
        ticket: mockTicket,
        payment_method: 'cash',
        amount_paid: 136.67,
        cash_received: 150.00,
        change_given: 13.33
      };

      const receipt = generateReceipt(payment);
      
      expect(receipt.payment_method).toBe('cash');
      expect(receipt.cash_received).toBe(150.00);
      expect(receipt.change_given).toBe(13.33);
      expect(receipt.card_info).toBeUndefined();
    });
  });
});

// Implementation functions for payment processing
function processCashPayment(ticket: any, payment: any) {
  const totalDue = payment.tip_amount ? 
    ticket.total_amount + payment.tip_amount : 
    ticket.total_amount;

  if (payment.received < totalDue) {
    return {
      success: false,
      error: 'Insufficient payment amount',
      shortfall: Number((totalDue - payment.received).toFixed(2))
    };
  }

  const change = Number((payment.received - totalDue).toFixed(2));
  
  return {
    success: true,
    payment_id: `cash_${Date.now()}`,
    total_paid: totalDue,
    change_due: change,
    tip_amount: payment.tip_amount || 0,
    processed_at: new Date().toISOString(),
    receipt_data: {
      ticket_number: ticket.ticket_number,
      payment_method: 'cash',
      amount_paid: ticket.total_amount,
      tip: payment.tip_amount || 0,
      change: change
    }
  };
}

async function processCardPayment(ticket: any, payment: any) {
  // Validate card data first
  const validation = validateCardData(payment.card_data);
  if (!validation.isValid) {
    return {
      success: false,
      validation_errors: validation.errors
    };
  }

  // Simulate Stripe processing
  if (payment.card_data.number === '4000000000000002') {
    return {
      success: false,
      error: 'Card declined',
      decline_code: 'insufficient_funds'
    };
  }

  const totalCharge = ticket.total_amount + (payment.tip_amount || 0);
  
  return {
    success: true,
    transaction_id: `ch_test_${Date.now()}`,
    total_charged: totalCharge,
    payment_processor: 'stripe',
    card_last_four: payment.card_data.number.slice(-4),
    tip_amount: payment.tip_amount || 0,
    processed_at: new Date().toISOString()
  };
}

async function processSplitPayment(ticket: any, splitPayment: any) {
  const results = [];
  let totalPaid = 0;

  for (const payment of splitPayment.payments) {
    if (payment.type === 'cash') {
      // Create mock ticket for individual payment
      const mockTicketForPayment = { total_amount: payment.amount };
      const cashData = { ...payment, received: payment.amount };
      const result = processCashPayment(mockTicketForPayment, cashData);
      if (!result.success) return result;
      results.push({ method: 'cash', amount: payment.amount });
      totalPaid += payment.amount + (payment.tip_amount || 0);
    } else if (payment.type === 'card') {
      // Create mock ticket for individual payment
      const mockTicketForPayment = { total_amount: payment.amount };
      const result = await processCardPayment(mockTicketForPayment, payment);
      if (!result.success) return result;
      results.push({ method: 'card', amount: payment.amount });
      totalPaid += payment.amount + (payment.tip_amount || 0);
    }
  }

  if (totalPaid < ticket.total_amount) {
    return {
      success: false,
      error: 'Split payment total insufficient',
      total_provided: totalPaid,
      amount_due: ticket.total_amount
    };
  }

  return {
    success: true,
    total_paid: Number(totalPaid.toFixed(2)),
    payments: results
  };
}

async function processRefund(payment: any, refundRequest: any) {
  // Check authorization
  if (!isManagerRole(refundRequest.authorized_by)) {
    return {
      success: false,
      error: 'Refunds require manager authorization'
    };
  }

  // Simulate refund processing failure
  if (payment.transaction_id === 'invalid_transaction') {
    return {
      success: false,
      error: 'Refund processing failed - invalid transaction'
    };
  }

  const refundAmount = refundRequest.type === 'full' ? 
    payment.amount : 
    refundRequest.amount;

  return {
    success: true,
    refund_id: `re_${Date.now()}`,
    refund_amount: refundAmount,
    original_payment_id: payment.id,
    remaining_charge: payment.amount - refundAmount,
    status: 'refunded',
    processed_at: new Date().toISOString()
  };
}

function calculatePaymentSummary(payments: any[]) {
  const completedPayments = payments.filter(p => p.status === 'completed');
  
  const summary = completedPayments.reduce((acc, payment) => {
    acc.total_revenue += payment.amount;
    acc.total_tips += payment.tip || 0;
    
    switch (payment.method) {
      case 'cash':
        acc.cash_total += payment.amount;
        break;
      case 'card':
        acc.card_total += payment.amount;
        break;
      case 'split':
        acc.split_total += payment.amount;
        break;
    }
    
    return acc;
  }, {
    total_revenue: 0,
    total_tips: 0,
    cash_total: 0,
    card_total: 0,
    split_total: 0
  });

  return {
    ...summary,
    transaction_count: completedPayments.length,
    failed_transactions: payments.filter(p => p.status === 'failed').length
  };
}

function checkCashDiscrepancy(reported: number, system: number) {
  const difference = Number((reported - system).toFixed(2));
  const absDifference = Math.abs(difference);
  
  return {
    has_discrepancy: absDifference > 0.01,
    difference: difference,
    type: difference > 0 ? 'overage' : 'shortage',
    requires_investigation: absDifference > 5.00
  };
}

function generateReceipt(payment: any) {
  const receipt: any = {
    restaurant_name: 'PARC Bistro',
    ticket_number: payment.ticket.ticket_number,
    table_number: payment.ticket.table_id,
    server_name: 'Server Name', // Would lookup from server_id
    subtotal: payment.ticket.subtotal_amount,
    tax: payment.ticket.tax_amount,
    total: payment.ticket.total_amount,
    payment_method: payment.payment_method,
    timestamp: new Date().toISOString()
  };

  if (payment.tip_amount) {
    receipt.tip = payment.tip_amount;
    receipt.total += payment.tip_amount;
  }

  if (payment.payment_method === 'card') {
    receipt.card_info = `****${payment.card_last_four}`;
  } else if (payment.payment_method === 'cash') {
    receipt.cash_received = payment.cash_received;
    receipt.change_given = payment.change_given;
  }

  return receipt;
}

function validateCardData(cardData: any) {
  const errors: string[] = [];
  
  if (!cardData.number || !/^\d{16}$/.test(cardData.number.replace(/\s/g, ''))) {
    errors.push('Invalid card number');
  }
  
  if (!cardData.exp_month || cardData.exp_month < 1 || cardData.exp_month > 12) {
    errors.push('Invalid expiry month');
  }
  
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  if (cardData.exp_year < currentYear || 
      (cardData.exp_year === currentYear && cardData.exp_month < currentMonth)) {
    errors.push('Card expired');
  }
  
  if (!cardData.cvc || !/^\d{3,4}$/.test(cardData.cvc)) {
    errors.push('Invalid CVC');
  }
  
  return { isValid: errors.length === 0, errors };
}

function isManagerRole(userId: string) {
  // In real app, lookup user role from database
  return userId === 'f191z14z2679pzf'; // Pierre (Manager)
}
