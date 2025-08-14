<script lang="ts">
  import { onMount } from 'svelte';
  import { collections, workRequests, staff, loading } from '$lib/stores/collections.js';
  import { goto } from '$app/navigation';
  import pb from '$lib/pocketbase.js';

  let err: string | null = null;
  let showClosed = false;
  let roleFilter: string | '' = '';
  let sectionFilter: string | '' = '';

  onMount(async () => {
    try {
      await Promise.all([
        collections.getWorkRequests().catch(()=>[]),
        collections.getStaff().catch(()=>[]),
        loadOnCallRoster(onCallDate)
      ]);
    } catch (e: any) {
      err = e?.message || 'Failed to load work requests';
    }
  });

  $: filtered = ($workRequests || []).filter((wr: any) => {
    if (!showClosed && (wr.status || '').toLowerCase() !== 'open') return false;
    if (roleFilter && String(wr.role || '').toLowerCase() !== roleFilter.toLowerCase()) return false;
    if (sectionFilter && String(wr.section || '').toLowerCase() !== sectionFilter.toLowerCase()) return false;
    return true;
  });

  // On-call roster (today by default)
  let onCallDate = new Date().toISOString().slice(0,10);
  let onCall: any[] = [];

  async function loadOnCallRoster(dateStr: string) {
    try {
      const list = await pb.collection('on_call_roster').getFullList({
        filter: `roster_date = \"${dateStr}\"`,
        sort: '+role,+start_time'
      });
      onCall = list;
    } catch (e:any) {
      onCall = [];
      console.warn('on_call_roster not available:', e?.message || e);
    }
  }

  async function refresh() {
    try {
      await Promise.all([
        collections.getWorkRequests(),
        loadOnCallRoster(onCallDate)
      ]);
    } catch (e:any) {
      err = e?.message || 'Refresh failed';
    }
  }

  async function closeRequest(id: string) {
    try {
      await collections.updateWorkRequest(id, { status: 'closed' });
      await collections.getWorkRequests();
    } catch (e:any) {
      err = e?.message || 'Failed to close request';
    }
  }

  // Assign handling: store local edits for assignee per row
  let assignees: Record<string, string> = {};
  function getAssignee(id: string) { return assignees[id] ?? ''; }
  function setAssignee(id: string, v: string) { assignees = { ...assignees, [id]: v }; }
  async function assignRequest(id: string) {
    const assignee = (assignees[id] || '').trim();
    if (!assignee) return;
    try {
      await collections.updateWorkRequest(id, { assigned_to: assignee, status: 'open' });
      await collections.getWorkRequests();
    } catch (e:any) {
      err = e?.message || 'Failed to assign request';
    }
  }

  function staffDisplayName(s: any) {
    const first = s.first_name || s.expand?.user_id?.name || '';
    const last = s.last_name || '';
    const role = (s.position || s.expand?.user_id?.role || '').toLowerCase();
    const name = `${first} ${last}`.trim() || s.expand?.user_id?.email || 'Unknown';
    return `${name}${role ? ` (${role})` : ''}`;
  }

  // Create a work request targeting an on-call roster entry
  async function sendWorkRequestForOnCall(entry: any) {
    try {
      const role = (entry.role || 'server').toLowerCase();
      const start = entry.start_time || '';
      const section = entry.section || undefined;
      const assignedTo = entry.staff_id || entry.user_id || entry.id || undefined;
      await collections.createWorkRequest({
        request_date: onCallDate,
        start_time: start,
        role,
        quantity: 1,
        reason: 'on_call_request',
        status: 'open',
        section,
        assigned_to: assignedTo,
        tags: 'on_call'
      });
      await collections.getWorkRequests();
    } catch (e:any) {
      err = e?.message || 'Failed to send on-call work request';
    }
  }

  // Bulk: create requests for all on-call entries on current date
  async function bulkSendWorkRequestsForOnCall() {
    try {
      for (const oc of onCall) {
        await sendWorkRequestForOnCall(oc);
      }
    } catch (e:any) {
      err = e?.message || 'Bulk request creation failed';
    }
  }

  // Role match helper for staff filtering
  function normalizeRole(v: any) {
    return String(v || '').toLowerCase();
  }
  function matchesRole(s: any, role: string) {
    const target = normalizeRole(role);
    const staffPos = normalizeRole(s.position || s.role || s.expand?.user_id?.role);
    if (!target) return true;
    return staffPos === target;
  }
</script>

<div class="p-6 space-y-6">
  <div class="flex items-center justify-between">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold text-white">Staff Requests</h1>
      <p class="text-gray-400 text-sm">Open work requests that need attention</p>
    </div>
    <div class="flex gap-2">
      <button class="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600" on:click={() => goto('/dashboard/manager')}>Back to Manager</button>
      <button class="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white" on:click={refresh}>Refresh</button>
    </div>
  </div>

  {#if err}
    <div class="rounded border border-red-600 text-red-200 bg-red-900/30 px-3 py-2">{err}</div>
  {/if}

  <div class="flex flex-wrap gap-3 items-end">
    <label class="flex flex-col gap-1">
      <span class="text-gray-300 text-sm">Role</span>
      <select bind:value={roleFilter} class="bg-gray-800 text-white rounded px-3 py-2 border border-gray-700">
        <option value="">All</option>
        <option value="server">Server</option>
        <option value="host">Host</option>
        <option value="bartender">Bartender</option>
      </select>
    </label>
    <label class="flex items-center gap-2">
      <input type="checkbox" bind:checked={showClosed} class="w-4 h-4" />
      <span class="text-gray-300 text-sm">Show closed</span>
    </label>
  </div>

  <div class="overflow-auto border border-gray-700 rounded">
    <table class="min-w-full text-left">
      <thead class="bg-gray-900 text-gray-300">
        <tr>
          <th class="px-3 py-2">Date</th>
          <th class="px-3 py-2">Time</th>
          <th class="px-3 py-2">Role</th>
          <th class="px-3 py-2">Qty</th>
          <th class="px-3 py-2">Reason</th>
          <th class="px-3 py-2">Section</th>
          <th class="px-3 py-2">Assignee</th>
          <th class="px-3 py-2">Status</th>
          <th class="px-3 py-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as wr}
          <tr class="border-t border-gray-800 text-gray-100">
            <td class="px-3 py-2">{wr.request_date}</td>
            <td class="px-3 py-2">{wr.start_time}{#if wr.end_time} – {wr.end_time}{/if}</td>
            <td class="px-3 py-2 capitalize">{wr.role}</td>
            <td class="px-3 py-2">{wr.quantity}</td>
            <td class="px-3 py-2 text-gray-300">{wr.reason}</td>
            <td class="px-3 py-2">{wr.section}</td>
            <td class="px-3 py-2">
              <div class="flex gap-2 items-center">
                <select class="bg-gray-800 text-white rounded px-2 py-1 border border-gray-700 w-56"
                        bind:value={assignees[wr.id]}
                        on:change={(e:any)=>setAssignee(wr.id, e.target.value)}>
                  <option value="">— Select staff —</option>
                  {#each ($staff || []).filter((s)=> matchesRole(s, wr.role)) as s}
                    <option value={s.id}>{staffDisplayName(s)}</option>
                  {/each}
                </select>
                <button class="px-2 py-1 rounded bg-purple-700 hover:bg-purple-600" on:click={() => assignRequest(wr.id)}>Assign</button>
              </div>
              {#if wr.assigned_to}
                <div class="text-xs text-gray-400 mt-1">Assigned to: {wr.assigned_to}</div>
              {/if}
            </td>
            <td class="px-3 py-2 capitalize">{wr.status}</td>
            <td class="px-3 py-2">
              {#if (wr.status || '').toLowerCase() === 'open'}
                <button class="px-2 py-1 rounded bg-green-700 hover:bg-green-600" on:click={() => closeRequest(wr.id)}>Close</button>
              {:else}
                <span class="text-gray-400">—</span>
              {/if}
            </td>
          </tr>
        {/each}
        {#if !filtered.length}
          <tr><td colspan="9" class="px-3 py-6 text-center text-gray-400">No requests</td></tr>
        {/if}
      </tbody>
    </table>
  </div>

  <!-- On-call roster -->
  <div class="space-y-3">
    <div class="flex items-end gap-3">
      <div class="text-lg font-semibold text-white">On-call Roster</div>
      <label class="flex flex-col gap-1">
        <span class="text-gray-300 text-xs">Date</span>
        <input type="date" bind:value={onCallDate} on:change={() => loadOnCallRoster(onCallDate)} class="bg-gray-800 text-white rounded px-3 py-2 border border-gray-700" />
      </label>
      <button class="ml-auto px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white" on:click={() => { if (confirm('Create a work request for each on-call entry for this date?')) bulkSendWorkRequestsForOnCall(); }} title="Create a work request for each on-call entry on this date">
        Create requests for all on-call
      </button>
    </div>

    <div class="overflow-auto border border-gray-700 rounded">
      <table class="min-w-full text-left">
        <thead class="bg-gray-900 text-gray-300">
          <tr>
            <th class="px-3 py-2">Role</th>
            <th class="px-3 py-2">Name</th>
            <th class="px-3 py-2">Start</th>
            <th class="px-3 py-2">Contact</th>
            <th class="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each onCall as oc}
            <tr class="border-t border-gray-800 text-gray-100">
              <td class="px-3 py-2 capitalize">{oc.role}</td>
              <td class="px-3 py-2">{oc.name || oc.staff_name || oc.expand?.user_id?.name || (oc.expand?.staff_id ? `${oc.expand?.staff_id?.first_name || ''} ${oc.expand?.staff_id?.last_name || ''}`.trim() : '—')}</td>
              <td class="px-3 py-2">{oc.start_time || '—'}</td>
              <td class="px-3 py-2 text-gray-300">{oc.contact || oc.phone || oc.expand?.user_id?.email || '—'}</td>
              <td class="px-3 py-2">
                <button class="px-2 py-1 rounded bg-blue-700 hover:bg-blue-600" on:click={() => sendWorkRequestForOnCall(oc)}>Send Work Request</button>
              </td>
            </tr>
          {/each}
          {#if !onCall.length}
            <tr><td colspan="5" class="px-3 py-6 text-center text-gray-400">No on-call entries for selected date</td></tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
