import type { RequestHandler } from '@sveltejs/kit';
import PocketBase from 'pocketbase';

const PB_URL = 'https://pocketbase-production-7050.up.railway.app';

const ALLOWED_ROLES = new Set(['manager', 'general_manager', 'owner']);

export const GET: RequestHandler = async ({ url, cookies, request }) => {
  try {
    const pb = new PocketBase(PB_URL);

    // Load auth from cookie (client session)
    const authCookie = cookies.get('pb_auth');
    if (authCookie) {
      pb.authStore.loadFromCookie(`pb_auth=${authCookie}`);
    }

    // Fallback: allow passing PB token via Authorization header
    // Client should send: Authorization: Bearer <pb_auth_token>
    if (!pb.authStore.isValid) {
      const authHeader = request.headers.get('authorization') || '';
      const m = authHeader.match(/^Bearer\s+(.+)$/i);
      if (m) {
        const token = m[1];
        // Load token into PB client authStore; rely on PB rules to authorize
        pb.authStore.save(token, null as any);
      }
    }

    if (!pb.authStore.isValid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const q = (url.searchParams.get('q') || '').trim();
    const filterRole = (url.searchParams.get('role') || '').trim();
    const page = Number(url.searchParams.get('page') || '1');
    const perPage = Math.min(50, Number(url.searchParams.get('perPage') || '20'));

    const parts: string[] = [];
    if (filterRole) parts.push(`role = "${filterRole}"`);
    if (q) {
      const safe = q.replace(/"/g, '\\"');
      parts.push(`(name ~ "%${safe}%" || email ~ "%${safe}%")`);
    }
    const filter = parts.join(' && ');

    let res;
    try {
      res = await pb.collection('users').getList(page, perPage, {
        filter: filter || undefined,
        // Avoid fields trimming for auth collections; some PB setups 400 on fields
        sort: q ? undefined : '+name'
      });
    } catch (err: any) {
      // Fallback: retry without filter/sort if server complained with a 400
      if (err?.status === 400) {
        res = await pb.collection('users').getList(page, perPage);
      } else {
        throw err;
      }
    }

    // Try to enrich with staff info (name/email) when email is hidden
    const userIds: string[] = (res.items || []).map((u: any) => u.id);
    let staffByUser: Record<string, any> = {};
    if (userIds.length > 0) {
      const listFilter = userIds.map(id => `user_id = "${id}"`).join(' || ');
      try {
        const staffRes = await pb.collection('staff_collection').getFullList({ filter: listFilter });
        staffByUser = Object.fromEntries(staffRes.map((s: any) => [s.user_id, s]));
      } catch (e1) {
        try {
          const staffRes = await pb.collection('staff').getFullList({ filter: listFilter });
          staffByUser = Object.fromEntries(staffRes.map((s: any) => [s.user_id, s]));
        } catch (e2) {
          // ignore - no staff collection available
        }
      }
    }

    const items = (res.items || []).map((u: any) => {
      const staff = staffByUser[u.id];
      const fullName = staff ? [staff.first_name, staff.last_name].filter(Boolean).join(' ').trim() : '';
      const name = (u.name ?? u.username ?? fullName ?? '').trim();
      const email = (u.email ?? staff?.email ?? '').trim();
      const phone = (u.phone ?? staff?.phone ?? '').trim();
      return {
        id: u.id,
        name,
        email,
        role: u.role ?? '',
        phone
      };
    });

    return new Response(
      JSON.stringify({
        items,
        page: res.page,
        perPage: res.perPage,
        totalItems: res.totalItems,
        totalPages: res.totalPages
      }),
      { status: 200 }
    );
  } catch (e: any) {
    try { console.error('users/search error', e?.data || e); } catch {}
    const status = e?.status && Number.isInteger(e.status) ? e.status : 500;
    const message = e?.data?.message || e?.message || (status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Server error');
    return new Response(JSON.stringify({ error: message }), { status });
  }
};
