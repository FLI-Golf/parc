import { describe, it, expect, vi } from 'vitest';

// We will intercept pb.collection('reservations').getFullList calls to capture filters
const calls: any[] = [];

vi.mock('$lib/pocketbase.js', () => ({
  default: {
    collection(name: string) {
      if (name !== 'reservations') throw new Error('Only reservations used in this test');
      return {
        async getFullList(opts?: any) {
          calls.push(opts?.filter || '');
          // Simulate: first range call returns empty to trigger fallback,
          // equality fallback returns records
          const f: string = opts?.filter || '';
          if (f.includes('>=') && f.includes('<')) return [];
          if (f.includes('=') && !f.includes('<') && !f.includes('>')) return [{ id: 'r1' }];
          return [];
        }
      } as any;
    }
  }
}));

import { collections } from '$lib/stores/collections.js';

describe('getReservations filter building and fallbacks', () => {
  it('builds day-range filter and falls back to equality when empty', async () => {
    calls.length = 0;
    const startDate = '2025-08-17';
    const recs = await collections.getReservations({ startDate });
    expect(Array.isArray(recs)).toBe(true);
    // First call: range filter [day, next day)
    expect(calls[0]).toMatch(/reservation_date >= "2025-08-17 00:00:00" && reservation_date < "2025-08-18 00:00:00"/);
    // Second call: equality fallback
    expect(calls[1]).toMatch(/reservation_date = "2025-08-17"/);
  });

  it('includes status in filters when provided', async () => {
    calls.length = 0;
    const startDate = '2025-08-17';
    await collections.getReservations({ startDate, status: 'booked' });
    expect(calls[0]).toMatch(/status = "booked"/);
  });
});
