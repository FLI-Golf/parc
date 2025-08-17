import { describe, it, expect } from 'vitest';
import { reservationsInWindow, overlapsWindow, toMinutes } from '$lib/utils/reservations';

const BLOCK = 120;

describe('reservationsInWindow derivation', () => {
  const date = '2025-08-17';
  const list = [
    { id: 'r1', reservation_date: `${date} 00:00:00`, start_time: '18:00', status: 'booked', table_id: 't1' },
    { id: 'r2', reservation_date: `${date} 00:00:00`, start_time: '14:00', status: 'booked', table_id: 't2' },
    { id: 'r3', reservation_date: `${date} 00:00:00`, start_time: '17:30', status: 'seated', table_id: null },
    { id: 'r4', reservation_date: `${date} 00:00:00`, start_time: '19:45', status: 'canceled', table_id: 't3' },
    { id: 'r5', reservation_date: `2025-08-18 00:00:00`, start_time: '18:00', status: 'booked', table_id: 't4' },
  ];

  it('lists only same-day active reservations overlapping the window', () => {
    const time = '17:00';
    const res = reservationsInWindow(list as any, date, time, BLOCK);
    // expect r1 (18:00) and r3 (17:30) to be included; r2 (14:00) is out of window; r4 canceled; r5 different day
    const ids = res.map(r => r.id).sort();
    expect(ids).toEqual(['r1','r3']);
  });

  it('overlapsWindow helper aligns with derivation math', () => {
    const start = toMinutes('17:00');
    const end = start + BLOCK;
    expect(overlapsWindow('18:00', start, end, BLOCK)).toBe(true);
    expect(overlapsWindow('14:00', start, end, BLOCK)).toBe(false);
  });
});
