import { json } from '@sveltejs/kit';
import pb from '$lib/pocketbase';

export async function POST({ request }) {
  try {
    const { proposal_id, shifts } = await request.json();
    let proposal = null;
    try {
      if (proposal_id) proposal = await pb.collection('schedule_proposals').getOne(proposal_id);
    } catch {}

    const toApply = shifts ?? proposal?.proposal?.shifts ?? [];
    if (!Array.isArray(toApply) || toApply.length === 0) {
      return json({ error: 'No shifts to approve' }, { status: 400 });
    }

    // Create shifts in PocketBase
    const results: any[] = [];
    for (const s of toApply) {
      try {
        const rec = await pb.collection('shifts_collection').create({
          staff_member: s.staff_id,
          shift_date: s.shift_date,
          start_time: s.start_time,
          end_time: s.end_time,
          position: s.position,
          notes: s.notes ?? ''
        });
        results.push({ ok: true, id: rec.id });
      } catch (e: any) {
        results.push({ ok: false, error: e?.message ?? 'create failed', shift: s });
      }
    }

    // Mark proposal approved if present
    if (proposal?.id) {
      try { await pb.collection('schedule_proposals').update(proposal.id, { status: 'approved' }); } catch {}
    }

    return json({ created: results.filter(r => r.ok).length, results });
  } catch (e: any) {
    return json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}
