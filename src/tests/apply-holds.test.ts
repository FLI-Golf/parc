import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock env
vi.mock('$env/dynamic/private', () => ({ env: { HOLD_APPLY_MINUTES: '120' } }));

// Test-local fakes
function makeFakePb(reservations: any[]) {
  const updates: any[] = [];
  return {
    updates,
    collection(name: string) {
      if (name === 'reservations') {
        return {
          async getFullList(opts?: any) {
            // capture filters if needed by tests reading updates array
            updates.push({ type: 'getFullList', name, opts });
            return reservations;
          },
        } as any;
      }
      if (name === 'tables') {
        return {
          async update(id: string, data: any) {
            updates.push({ type: 'update', name, id, data });
            return { id, ...data };
          },
        } as any;
      }
      if (name === 'tables_collection') {
        return {
          async update(id: string, data: any) {
            updates.push({ type: 'update', name, id, data });
            return { id, ...data };
          },
        } as any;
      }
      throw new Error(`Unknown collection ${name}`);
    },
  } as any;
}

// Mock PB. We will override the default export with our fake in each test.
vi.mock('$lib/pocketbase.js', () => ({ default: makeFakePb([]) }));

// Import after mocks are set up
import { POST } from '../routes/api/reservations/apply-holds/+server';

const date = '2025-08-17';

describe('apply-holds endpoint', () => {
  const realNow = Date.now;
  beforeEach(() => {
    vi.useFakeTimers();
    // 2025-08-17T17:00:00 local time
    const dt = new Date(2025, 7, 17, 17, 0, 0, 0);
    vi.setSystemTime(dt);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates only reservations within hold window', async () => {
    // Arrange reservations: 18:00 should update; 14:00 should not
    const reservations = [
      { id: 'r1', reservation_date: `${date} 00:00:00`, start_time: '18:00', status: 'booked', table_id: 't1' },
      { id: 'r2', reservation_date: `${date} 00:00:00`, start_time: '14:00', status: 'booked', table_id: 't2' },
      { id: 'r3', reservation_date: `${date} 00:00:00`, start_time: '18:30', status: 'seated', table_id: 't3' },
      { id: 'r4', reservation_date: `2025-08-18 00:00:00`, start_time: '18:00', status: 'booked', table_id: 't4' },
    ];

    const fake = makeFakePb(reservations);
    // Replace mocked module export value
    const mod = await import('$lib/pocketbase.js');
    (mod as any).default.collection = fake.collection.bind(fake);

    const res = await POST({ url: new URL('http://localhost/api/reservations/apply-holds?debug=1') } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Only r1 and r3 are within window and have table_id
    expect(body.applied).toBe(2);
    const updatedIds = body.results.filter((r: any) => r.updated).map((r: any) => r.id).sort();
    expect(updatedIds).toEqual(['r1', 'r3']);
  });

  it('falls back to tables_collection when tables update fails', async () => {
    const reservations = [
      { id: 'r1', reservation_date: `${date} 00:00:00`, start_time: '18:00', status: 'booked', table_id: 't1' },
    ];
    const updates: any[] = [];
    const fake = {
      updates,
      collection(name: string) {
        if (name === 'reservations') {
          return {
            async getFullList(opts?: any) {
              updates.push({ type: 'getFullList', name, opts });
              return reservations;
            },
          } as any;
        }
        if (name === 'tables') {
          return {
            async update(id: string, data: any) {
              updates.push({ type: 'update', name, id, data, willThrow: true });
              throw new Error('tables update failed');
            },
          } as any;
        }
        if (name === 'tables_collection') {
          return {
            async update(id: string, data: any) {
              updates.push({ type: 'update', name, id, data });
              return { id, ...data };
            },
          } as any;
        }
        throw new Error(`Unknown collection ${name}`);
      },
    } as any;
    const mod = await import('$lib/pocketbase.js');
    (mod as any).default.collection = fake.collection.bind(fake);

    const res = await POST({ url: new URL('http://localhost/api/reservations/apply-holds?debug=1') } as any);
    const body = await res.json();
    expect(body.applied).toBe(1);
    // Validate attempts include tables failure then tables_collection success
    expect(body.results[0].attempts[0].collection).toBe('tables');
    expect(body.results[0].attempts[0].ok).toBe(false);
    expect(body.results[0].attempts[1].collection).toBe('tables_collection');
    expect(body.results[0].attempts[1].ok).toBe(true);
  });
});
