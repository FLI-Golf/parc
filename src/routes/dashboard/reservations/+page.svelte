<script lang="ts">
  import { onMount } from 'svelte';
  import { collections, reservations, loading, sections, tables } from '$lib/stores/collections.js';
  import pb from '$lib/pocketbase.js';
  import { goto } from '$app/navigation';

  let filterDate = new Date().toISOString().slice(0,10);
  let statusFilter: string | null = null;
  let err: string | null = null;

  onMount(async () => {
    try {
      await Promise.all([
        collections.getSections().catch(()=>[]),
        collections.getTables().catch(()=>[]),
        collections.getReservations({ startDate: filterDate, endDate: filterDate }).catch(()=>[]),
        collections.getWorkRequests().catch(()=>[])
      ]);
    } catch (e:any) {
      err = e?.message || 'Failed to load reservations';
    }
  });

  function goBack() {
    // Prefer history back, fallback to dashboard
    if (typeof history !== 'undefined' && history.length > 1) {
      history.back();
    } else {
      goto('/dashboard');
    }
  }

  async function refresh() {
    await Promise.all([
      collections.getReservations({
        startDate: filterDate,
        endDate: filterDate,
        status: statusFilter || undefined
      }),
      collections.getWorkRequests()
    ]);
  }

  async function setStatus(id: string, status: string) {
    try {
      await collections.updateReservation(id, { status });
    } catch (e:any) {
      err = e?.message || 'Failed to update status';
    }
  }

  // Work request helpers
  import { workRequests } from '$lib/stores/collections.js';
  function findWorkRequestForReservation(resId: string) {
    const list = $workRequests || [];
    return list.find((wr: any) => (wr.tags || '').includes(`res:${resId}`) && wr.status === 'open');
  }
  async function createWorkRequestForReservation(r: any) {
    const reason = (r.tags || []).includes('oversize') ? 'reservation_oversize' : 'no_table_available';
    try {
      await collections.createWorkRequest({
        request_date: r.reservation_date,
        start_time: r.start_time,
        role: reason === 'reservation_oversize' ? 'host' : 'server',
        quantity: 1,
        reason,
        status: 'open',
        section: r.section || undefined,
        tags: `manual,res:${r.id}`
      });
      await collections.getWorkRequests();
    } catch (e:any) {
      err = e?.message || 'Failed to create work request';
    }
  }
  async function closeWorkRequestForReservation(resId: string) {
    try {
      const wr = findWorkRequestForReservation(resId);
      if (wr) {
        await collections.updateWorkRequest(wr.id, { status: 'closed' });
        await collections.getWorkRequests();
      }
    } catch (e:any) {
      err = e?.message || 'Failed to close work request';
    }
  }
</script>

<div class="p-6">
  <div class="flex items-center gap-3 mb-4">
    <button class="inline-flex items-center gap-2 px-3 py-2 rounded bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700" on:click={goBack} aria-label="Go back">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
        <path fill-rule="evenodd" d="M10.53 3.47a.75.75 0 0 1 0 1.06L5.06 10h15.19a.75.75 0 0 1 0 1.5H5.06l5.47 5.47a.75.75 0 1 1-1.06 1.06l-6.75-6.75a.75.75 0 0 1 0-1.06l6.75-6.75a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" />
      </svg>
      <span>Back</span>
    </button>
    <h1 class="text-2xl font-semibold text-white">Reservations</h1>
  </div>

  <div class="flex flex-wrap gap-3 items-end mb-4">
    <label class="flex flex-col gap-1">
      <span class="text-gray-300 text-sm">Date</span>
      <input type="date" bind:value={filterDate} on:change={refresh} class="bg-gray-800 text-white rounded px-3 py-2 border border-gray-700" />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-gray-300 text-sm">Status</span>
      <select bind:value={statusFilter} on:change={refresh} class="bg-gray-800 text-white rounded px-3 py-2 border border-gray-700">
        <option value="">All</option>
        <option value="booked">Booked</option>
        <option value="seated">Seated</option>
        <option value="completed">Completed</option>
        <option value="canceled">Canceled</option>
        <option value="no_show">No Show</option>
      </select>
    </label>
    <button class="inline-flex items-center px-3 py-2 rounded bg-blue-600 text-white" on:click={refresh}>Refresh</button>
  </div>

  {#if err}
    <div class="mb-4 rounded border border-red-600 text-red-200 bg-red-900/30 px-3 py-2">{err}</div>
  {/if}

  <div class="overflow-auto border border-gray-700 rounded">
    <table class="min-w-full text-left">
      <thead class="bg-gray-900 text-gray-300">
        <tr>
          <th class="px-3 py-2">When</th>
          <th class="px-3 py-2">Party</th>
          <th class="px-3 py-2">Name</th>
          <th class="px-3 py-2">Contact</th>
          <th class="px-3 py-2">Source</th>
          <th class="px-3 py-2">Section/Table</th>
          <th class="px-3 py-2">Status</th>
          <th class="px-3 py-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each $reservations as r}
          <tr class="border-t border-gray-800 text-gray-100">
            <td class="px-3 py-2">{r.reservation_date} {r.start_time}</td>
            <td class="px-3 py-2">{r.party_size}</td>
            <td class="px-3 py-2">{r.customer_name}</td>
            <td class="px-3 py-2 text-gray-300">
              {r.customer_phone}{#if r.customer_email} · {r.customer_email}{/if}
            </td>
            <td class="px-3 py-2">{r.source}
              {#if Array.isArray(r.tags) && r.tags.length}
                <div class="mt-1 flex flex-wrap gap-1">
                  {#each r.tags as t}
                    {#if t === 'oversize'}
                      <span class="text-xs px-2 py-0.5 rounded bg-orange-700 text-white">Oversize</span>
                    {:else if t === 'no_table_available'}
                      <span class="text-xs px-2 py-0.5 rounded bg-yellow-700 text-white">No Table</span>
                    {/if}
                  {/each}
                </div>
              {/if}
            </td>
            <td class="px-3 py-2">
              {#if r.expand?.section}{r.expand.section.name}{/if}
              {#if r.expand?.table_id} · Table {r.expand.table_id.table_number_field}{/if}
            </td>
            <td class="px-3 py-2 capitalize">{r.status}</td>
            <td class="px-3 py-2 flex flex-wrap gap-2">
              <button class="px-2 py-1 rounded bg-green-700" on:click={() => setStatus(r.id, 'seated')}>Seat</button>
              <button class="px-2 py-1 rounded bg-blue-700" on:click={() => setStatus(r.id, 'completed')}>Complete</button>
              <button class="px-2 py-1 rounded bg-yellow-700" on:click={() => setStatus(r.id, 'no_show')}>No Show</button>
              <button class="px-2 py-1 rounded bg-red-700" on:click={() => setStatus(r.id, 'canceled')}>Cancel</button>
              {#if (Array.isArray(r.tags) && (r.tags.includes('oversize') || r.tags.includes('no_table_available')))}
                {#if !findWorkRequestForReservation(r.id)}
                  <button class="px-2 py-1 rounded bg-purple-700" on:click={() => createWorkRequestForReservation(r)}>Create Work Req</button>
                {:else}
                  <button class="px-2 py-1 rounded bg-gray-700" on:click={() => closeWorkRequestForReservation(r.id)}>Resolve Work Req</button>
                {/if}
              {/if}
            </td>
          </tr>
        {/each}
        {#if !$reservations.length}
          <tr><td colspan="8" class="px-3 py-6 text-center text-gray-400">No reservations</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>
