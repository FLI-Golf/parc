import type { RequestHandler } from '@sveltejs/kit';
import pb from '$lib/pocketbase.js';
import { env } from '$env/dynamic/private';

const DEFAULT_BLOCK_MINUTES = 120;

function parseLocalDateTime(dateStr: string, timeStr: string) {
  const [y, m, d0] = String(dateStr).slice(0,10).split('-').map(Number);
  const [hh, mm] = String(timeStr || '00:00').split(':').map(Number);
  return new Date(y, (m || 1)-1, d0 || 1, hh || 0, mm || 0, 0, 0);
}

export const POST: RequestHandler = async ({ url }) => {
  try {
    const holdMinutes = Number(env.HOLD_APPLY_MINUTES || 120);
    const debug = url.searchParams.get('debug') === '1';

    // day window [today, tomorrow)
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2,'0');
    const d = String(today.getDate()).padStart(2,'0');
    const dayStart = `${y}-${m}-${d} 00:00:00`;
    const day2 = new Date(today.getTime()); day2.setDate(today.getDate()+1);
    const y2 = day2.getFullYear();
    const m2 = String(day2.getMonth() + 1).padStart(2,'0');
    const d2 = String(day2.getDate()).padStart(2,'0');
    const dayEnd = `${y2}-${m2}-${d2} 00:00:00`;

    // fetch today's reservations
    const reservations = await pb.collection('reservations').getFullList({
      filter: `reservation_date >= "${dayStart}" && reservation_date < "${dayEnd}"`,
      sort: '+start_time'
    }).catch(() => [] as any[]);

    const now = new Date();
    const results: any[] = [];

    for (const r of reservations) {
      const status = String(r.status || '').toLowerCase();
      if (!['booked','seated'].includes(status)) continue;
      if (!r.table_id) continue;
      const dateOnly = String(r.reservation_date).slice(0,10);
      const startAt = parseLocalDateTime(dateOnly, r.start_time || '00:00');
      const windowStart = new Date(startAt.getTime() - holdMinutes * 60000);
      const windowEnd = new Date(startAt.getTime() + DEFAULT_BLOCK_MINUTES * 60000);
      const withinWindow = now >= windowStart && now <= windowEnd;

      if (!withinWindow) continue;

      let updated = false; const attempts: any[] = [];
      try {
        await pb.collection('tables').update(r.table_id, { status: 'reserved' });
        attempts.push({ collection: 'tables', field: 'status', ok: true });
        updated = true;
      } catch (e0: any) {
        attempts.push({ collection: 'tables', field: 'status', ok: false, error: e0?.message || String(e0) });
        try {
          await pb.collection('tables_collection').update(r.table_id, { status: 'reserved' });
          attempts.push({ collection: 'tables_collection', field: 'status', ok: true });
          updated = true;
        } catch (e1: any) {
          attempts.push({ collection: 'tables_collection', field: 'status', ok: false, error: e1?.message || String(e1) });
        }
      }
      results.push({ id: r.id, table_id: r.table_id, updated, attempts, startAt: startAt.toISOString() });
    }

    const body = debug ? { ok: true, applied: results.length, results } : { ok: true, applied: results.length };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'apply-holds failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
