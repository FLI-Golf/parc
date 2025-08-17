import { describe, it, expect } from 'vitest';

const RES_BLOCK_MINUTES = 120;

function toMinutes(t: string) {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function overlapsWindow(resStart: string, windowStartMin: number, windowEndMin: number, block = RES_BLOCK_MINUTES) {
  const rs = toMinutes(resStart || '00:00');
  const re = rs + block;
  return Math.max(rs, windowStartMin) < Math.min(re, windowEndMin);
}
function parseLocalDateTime(dateStr: string, timeStr: string) {
  const [y, m, d] = String(dateStr).slice(0,10).split('-').map(Number);
  const [hh, mm] = String(timeStr || '00:00').split(':').map(Number);
  return new Date(y, (m || 1)-1, d || 1, hh || 0, mm || 0, 0, 0);
}

describe('reservations overlay window logic', () => {
  it('includes reservation when window overlaps start_time', () => {
    const startTime = '18:00';
    const windowStart = toMinutes('18:00');
    const windowEnd = windowStart + RES_BLOCK_MINUTES;
    expect(overlapsWindow(startTime, windowStart, windowEnd)).toBe(true);
  });

  it('excludes reservation when window is far before', () => {
    const startTime = '18:00';
    const windowStart = toMinutes('12:00');
    const windowEnd = windowStart + RES_BLOCK_MINUTES; // 12:00-14:00
    expect(overlapsWindow(startTime, windowStart, windowEnd)).toBe(false);
  });

  it('excludes reservation when window is far after', () => {
    const startTime = '12:00';
    const windowStart = toMinutes('18:00');
    const windowEnd = windowStart + RES_BLOCK_MINUTES; // 18:00-20:00
    expect(overlapsWindow(startTime, windowStart, windowEnd)).toBe(false);
  });
});

describe('holds apply window logic', () => {
  const BLOCK = 120; // minutes

  it('applies hold when now within HOLD_APPLY_MINUTES before start', () => {
    const HOLD = 120;
    const date = '2025-08-17';
    const start = '18:00';
    const startAt = parseLocalDateTime(date, start);
    const windowStart = new Date(startAt.getTime() - HOLD * 60000);
    const windowEnd = new Date(startAt.getTime() + BLOCK * 60000);
    const within = (now: Date) => now >= windowStart && now <= windowEnd;

    const at1700 = parseLocalDateTime(date, '17:00');
    expect(within(at1700)).toBe(true);

    const at1600 = parseLocalDateTime(date, '16:00');
    expect(within(at1600)).toBe(false);

    const at2000 = parseLocalDateTime(date, '20:00');
    expect(within(at2000)).toBe(true); // still within block window

    const at2101 = parseLocalDateTime(date, '21:01');
    expect(within(at2101)).toBe(false);
  });

  it('does not apply hold on previous or future days', () => {
    const HOLD = 120;
    const date = '2025-08-17';
    const start = '18:00';
    const startAt = parseLocalDateTime(date, start);
    const windowStart = new Date(startAt.getTime() - HOLD * 60000);
    const windowEnd = new Date(startAt.getTime() + BLOCK * 60000);
    const within = (now: Date) => now >= windowStart && now <= windowEnd;

    const prevDay = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate() - 1, 18, 0, 0, 0);
    expect(within(prevDay)).toBe(false);

    const nextDay = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate() + 1, 18, 0, 0, 0);
    expect(within(nextDay)).toBe(false);
  });
});
