export const RES_BLOCK_MINUTES_DEFAULT = 120;

export function toMinutes(t: string | null | undefined): number {
  if (!t) return 0;
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function overlapsWindow(
  resStart: string | null | undefined,
  windowStartMin: number,
  windowEndMin: number,
  blockMinutes: number = RES_BLOCK_MINUTES_DEFAULT
): boolean {
  const rs = toMinutes(resStart || "00:00");
  const re = rs + blockMinutes;
  return Math.max(rs, windowStartMin) < Math.min(re, windowEndMin);
}

export function parseLocalDateTime(dateStr: string, timeStr: string) {
  const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number);
  const [hh, mm] = String(timeStr || "00:00").split(":").map(Number);
  return new Date(y || 0, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

export type ReservationRecord = {
  id?: string;
  reservation_date: string; // ISO date or datetime string (first 10 chars = YYYY-MM-DD)
  start_time: string;       // HH:MM
  status?: string;          // booked | seated | ...
  table_id?: string | null;
  [key: string]: any;
};

export function reservationsInWindow(
  list: ReservationRecord[] | null | undefined,
  dateISO: string,             // YYYY-MM-DD
  timeHHMM: string,            // HH:MM
  blockMinutes: number = RES_BLOCK_MINUTES_DEFAULT,
  activeStatuses: Set<string> = new Set(["booked", "seated"]) // case-insensitive
): ReservationRecord[] {
  try {
    const day = String(dateISO).slice(0, 10);
    const start = toMinutes(timeHHMM);
    const end = start + blockMinutes;
    const active = new Set(Array.from(activeStatuses).map(s => String(s).toLowerCase()));
    return (list || []).filter((r) =>
      String(r.reservation_date).slice(0, 10) === day &&
      active.has(String(r.status || "").toLowerCase()) &&
      overlapsWindow(r.start_time, start, end, blockMinutes)
    );
  } catch {
    return [];
  }
}
