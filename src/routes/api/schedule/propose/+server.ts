import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';
import pb from '$lib/pocketbase';

// Simple guard to ensure server has the API key configured
function assertKeyOrReturn401() {
  if (!OPENAI_API_KEY) {
    // Throw a typed object the POST handler will map to a 401
    throw { status: 401, message: 'OPENAI_API_KEY is missing on the server. Set it in the server environment.' } as any;
  }
}

// Build a compact prompt from inputs and PocketBase context
async function buildPrompt(params: any) {
  const { week_start, constraints } = params;

  // Pull minimal PB context; expand as needed later
  const [staff, sections] = await Promise.all([
    pb.collection('staff_collection').getFullList({ sort: 'first_name' }).catch(() => []),
    pb.collection('sections_collection').getFullList({ sort: 'section_code' }).catch(() => [])
  ]);

  const staffSummary = staff.map((s: any) => ({ id: s.id, name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(), role: s.position ?? s.role ?? 'staff' }));
  const sectionSummary = sections.map((sec: any) => ({ id: sec.id, code: sec.section_code ?? '', area: sec.area_type ?? '' }));

  const sys = 'You are a restaurant scheduling assistant. Output strict JSON only, no prose.';
  const usr = {
    instruction: 'Propose a one-week schedule. Avoid overlaps. Respect roles. Balance coverage.',
    week_start,
    constraints: constraints ?? {},
    staff: staffSummary,
    sections: sectionSummary,
    output_schema: {
      shifts: [
        {
          staff_id: 'string',
          shift_date: 'YYYY-MM-DD',
          start_time: 'HH:MM',
          end_time: 'HH:MM',
          position: 'string',
          section_code: 'string',
          notes: 'string?'
        }
      ]
    }
  };

  return { sys, usr: JSON.stringify(usr) };
}

async function callOpenAI(prompt: { sys: string; usr: string }) {
  assertKeyOrReturn401();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt.sys },
        { role: 'user', content: prompt.usr }
      ],
      temperature: 0.2,
      max_tokens: 2000
    })
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      throw { status: 401, message: `OpenAI unauthorized: ${text}` } as any;
    }
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  return content;
}

function safeParseJSON<T>(s: string): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    throw new Error('Model output was not valid JSON');
  }
}

export async function POST({ request }) {
  try {
    const params = await request.json().catch(() => ({}));
    const { week_start } = params ?? {};
    if (!week_start) return json({ error: 'week_start is required (YYYY-MM-DD)' }, { status: 400 });

    const prompt = await buildPrompt(params);
    const content = await callOpenAI(prompt);
    const proposal = safeParseJSON<{ shifts: any[] }>(content);

    // Basic validation: ensure no empty
    if (!proposal?.shifts || !Array.isArray(proposal.shifts)) {
      return json({ error: 'Invalid proposal format from model' }, { status: 422 });
    }

    // Save proposal for review
    let record: any = null;
    try {
      record = await pb.collection('schedule_proposals').create({
        week_start,
        status: 'proposed',
        params,
        proposal
      });
    } catch (e) {
      // If proposals collection not ready, still return the proposal
      record = { id: null, proposal };
    }

    return json({ proposal: record.proposal, proposal_id: record.id ?? null });
  } catch (e: any) {
    if (e?.status === 401) {
      return json({ error: e?.message ?? 'Unauthorized' }, { status: 401 });
    }
    return json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}
