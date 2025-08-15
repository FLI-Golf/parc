import type { RequestHandler } from '@sveltejs/kit';
import pb from '$lib/pocketbase.js';
import { env } from '$env/dynamic/private';

// Simple overlap window for reservations (in minutes)
const DEFAULT_BLOCK_MINUTES = 120;

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    const payload = await request.json();
    const debugRequested = url.searchParams.get('debug') === '1' || (env.DEBUG_RESERVATIONS === 'true');
    const debug: any = { input: payload };
    // Expected JSON (basic):
    // {
    //   reservation_date: '2025-08-20',
    //   start_time: '19:30',
    //   party_size: 4,
    //   customer_name: 'Jane Doe',
    //   customer_phone?: '...'
    //   customer_email?: '...'
    //   notes?: '...'
    //   source?: 'opentable'
    //   section?: '<sectionId>'
    // }

    const reservation_date = String(payload.reservation_date || '').slice(0, 10);
    const start_time = String(payload.start_time || '');
    const party_size = Number(payload.party_size || 0);
    const customer_name = String(payload.customer_name || '').trim();

    if (!reservation_date || !start_time || !party_size || !customer_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const rawSource = String(payload.source || '').toLowerCase();
    const source = ['opentable', 'phone', 'web'].includes(rawSource) ? rawSource : 'opentable';
    const status = 'booked';
    if (debugRequested) Object.assign(debug, { normalized: { reservation_date, start_time, party_size, customer_name, source } });

    // Idempotency: skip if a matching reservation already exists
    const existing = await pb.collection('reservations').getList(1, 1, {
      filter: `source = "${source}" && reservation_date = "${reservation_date}" && start_time = "${start_time}" && party_size = ${party_size} && lower(customer_name) = "${customer_name.toLowerCase()}"`
    }).catch(() => ({ items: [] } as any));
    if (existing?.items?.length) {
    return new Response(JSON.stringify({ ok: true, duplicate: true, reservation: existing.items[0] }), { status: 200 });
    }

    const tags: string[] = Array.isArray(payload.tags) ? payload.tags.slice() : [];

    // Fetch tables and same-day reservations to attempt auto-assignment
    const dayStart = `${reservation_date} 00:00:00`;
    const dayEndDate = new Date(reservation_date);
    dayEndDate.setDate(dayEndDate.getDate() + 1);
    const dayEnd = `${dayEndDate.getFullYear()}-${String(dayEndDate.getMonth()+1).padStart(2,'0')}-${String(dayEndDate.getDate()).padStart(2,'0')} 00:00:00`;

    const [tables, sameDayReservations] = await Promise.all([
      pb.collection('tables_collection').getFullList(),
      pb.collection('reservations').getFullList({
        filter: `reservation_date >= "${dayStart}" && reservation_date < "${dayEnd}"`,
        sort: '+start_time'
      })
    ]);
    if (debugRequested) {
      debug.tables = tables.map((t: any) => ({ id: t.id, seats: (t.seats_field ?? t.seats ?? t.capacity ?? null), section: (t.section_field ?? t.section ?? null) }));
      debug.sameDay = sameDayReservations.slice(0, 10).map((r: any) => ({ id: r.id, table_id: r.table_id, start_time: r.start_time, status: r.status }));
      debug.dayRange = { from: dayStart, to: dayEnd };
    }

    // Determine block window
    const blockMinutes = Number(payload.block_minutes || DEFAULT_BLOCK_MINUTES);
    const startMin = toMinutes(start_time);
    const endMin = startMin + blockMinutes;

    // Build candidate tables (prioritize requested section if provided)
    const targetSection: string | null = payload.section || null;
    const fits = (t: any) => Number(t.seats_field || t.seats || t.capacity || 0) >= party_size;
    const tableSectionId = (t: any) => t.section_field || t.section || null;

    const byCapacityAll = tables
    .filter(fits)
    .sort((a: any, b: any) => Number((a.seats_field ?? a.seats ?? a.capacity) || 0) - Number((b.seats_field ?? b.seats ?? b.capacity) || 0));

    const byCapacityPreferred = targetSection
    ? tables.filter((t: any) => tableSectionId(t) === targetSection).filter(fits).sort((a: any, b: any) => Number((a.seats_field ?? a.seats ?? a.capacity) || 0) - Number((b.seats_field ?? b.seats ?? b.capacity) || 0))
    : [];
    if (debugRequested) Object.assign(debug, { targetSection, candidates: { preferred: byCapacityPreferred.map((t:any)=>t.id), all: byCapacityAll.map((t:any)=>t.id) } });

    // If party too large for any single table, tag and skip assignment
    const maxSeats = Math.max(0, ...tables.map((t: any) => Number(t.seats_field ?? t.seats ?? t.capacity ?? 0)));
    let table_id: string | null = null;
    const considered: any[] = [];
    if (debugRequested) debug.capacity = { maxSeats, party_size };
    if (party_size > maxSeats) {
      tags.push('oversize');
    } else {
    // Try preferred section first, then any section
    const lists = byCapacityPreferred.length ? [byCapacityPreferred, byCapacityAll] : [byCapacityAll];
    for (const list of lists) {
    for (const t of list) {
    const conflicts = sameDayReservations.some((r: any) => {
    if (r.table_id !== t.id) return false;
    const rStart = toMinutes(r.start_time || '00:00');
    const rEnd = rStart + blockMinutes; // assume same block length
      return overlap(startMin, endMin, rStart, rEnd) && r.status !== 'canceled' && r.status !== 'completed' && r.status !== 'no_show';
    });
    considered.push({ id: t.id, conflicts });
    if (!conflicts) {
    table_id = t.id;
    // Auto-fill section from table when not explicitly provided
    if (!targetSection) {
      const sid = tableSectionId(t);
      if (sid) payload.section = sid;
    }
      if (debugRequested) debug.selected = { table_id: t.id, section: payload.section || null };
        break;
      }
      }
        if (table_id) break;
    }

      if (!table_id) {
        // Fallback to smallest-fit if no conflicts found or data quirks
        if (byCapacityAll.length) {
          table_id = byCapacityAll[0].id;
          if (debugRequested) debug.fallback = { reason: 'firstCandidate', table_id };
        } else {
          tags.push('no_table_available');
        }
      }
    }
    if (debugRequested) debug.considered = considered;


    // Create the reservation
    // PocketBase may expect a datetime for date-only fields in some deployments
    let normalizedDate = reservation_date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      normalizedDate = `${normalizedDate} 00:00:00`;
    }

    const createPayload: any = {
      reservation_date: normalizedDate,
      start_time,
      party_size: Number(party_size),
      customer_name,
      customer_phone: payload.customer_phone || '',
      customer_email: payload.customer_email || '',
      notes: payload.notes || '',
      source,
      status,
      tags: tags.length ? tags : undefined,
      section: (payload.section || targetSection || undefined),
      table_id
    };
    
    // Strip null/undefined/empty
    for (const k of Object.keys(createPayload)) {
    const v = createPayload[k];
    if (v === null || v === undefined || v === '') delete createPayload[k];
    }
    
    // Ensure server-side auth if collection requires it
    try {
      if (!pb.authStore.isValid && env.PB_ADMIN_EMAIL && env.PB_ADMIN_PASSWORD) {
        await pb.admins.authWithPassword(env.PB_ADMIN_EMAIL, env.PB_ADMIN_PASSWORD);
      }
    } catch (e) {
      console.warn('Admin auth failed (continuing without):', (e as any)?.message || e);
    }
    
    let reservation;
    try {
      reservation = await pb.collection('reservations').create(createPayload);
    } catch (e: any) {
      // Retry after admin auth if not already authed
      if (!pb.authStore.isValid && env.PB_ADMIN_EMAIL && env.PB_ADMIN_PASSWORD) {
        try {
          await pb.admins.authWithPassword(env.PB_ADMIN_EMAIL, env.PB_ADMIN_PASSWORD);
          reservation = await pb.collection('reservations').create(createPayload);
        } catch (e2: any) {
          const msg = e2?.data?.message || e2?.message || 'Failed to create record';
          const status = e2?.status || 500;
          return new Response(JSON.stringify({ error: msg, details: e2?.data || null }), { status, headers: { 'Content-Type': 'application/json' } });
        }
      } else {
        const msg = e?.data?.message || e?.message || 'Failed to create record';
        const status = e?.status || 500;
        return new Response(JSON.stringify({ error: msg, details: e?.data || null }), { status, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Staffing logic: derive role and quantity based on condition and on-call roster
    const overlappingLoad = sameDayReservations.filter((r: any) => {
      const rStart = toMinutes(r.start_time || '00:00');
      const rEnd = rStart + blockMinutes;
      return overlap(startMin, endMin, rStart, rEnd) && ['booked','seated'].includes(String(r.status || ''));
    }).length;

    const reason = tags.includes('oversize') ? 'reservation_oversize' : (tags.includes('no_table_available') ? 'no_table_available' : null);

    if (reason) {
      try {
        // default role choice
        let role: string = reason === 'reservation_oversize' ? 'host' : 'server';
        // consult on_call_roster for available role that matches date
        try {
          const roster = await pb.collection('on_call_roster').getFullList({
            filter: `roster_date = \"${reservation_date}\" && role = \"${role}\"`
          });
          if (!roster?.length) {
            const alt = role === 'host' ? 'server' : 'host';
            const altRoster = await pb.collection('on_call_roster').getFullList({
              filter: `roster_date = \"${reservation_date}\" && role = \"${alt}\"`
            });
            if (altRoster?.length) role = alt;
          }
        } catch {}

        const quantity = overlappingLoad > 5 ? 2 : 1;
        await pb.collection('work_requests').create({
          request_date: reservation_date,
          start_time,
          end_time: undefined,
          role,
          quantity,
          reason,
          status: 'open',
          section: createPayload.section || undefined,
          // tag request with reservation id for dashboard linkage
          tags: `auto,${reason},res:${reservation.id}`
        });
      } catch (e) {
        console.warn('Failed to create work request:', e);
      }
    }

    const body = debugRequested ? { ok: true, reservation, debug } : { ok: true, reservation };
    return new Response(JSON.stringify(body), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('OpenTable webhook error:', error?.data || error);
    const msg = error?.data?.message || error?.message || 'Server error';
    const details = error?.data || null;
    return new Response(JSON.stringify({ error: msg, details }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
