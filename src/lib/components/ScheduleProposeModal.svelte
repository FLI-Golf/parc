<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let open = false;

  let week_start = '';
  let roles = { server: 4, bartender: 1 } as Record<string, number>;
  let max_hours = 36;
  let min_rest_hours = 10;
  let avoid_back_to_back = true;

  let loading = false;
  let error = '';
  let proposal: any = null;

  async function propose() {
    error = '';
    proposal = null;
    if (!week_start) { error = 'Please select week start (YYYY-MM-DD)'; return; }
    loading = true;
    try {
      const res = await fetch('/api/schedule/propose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start,
          constraints: { roles, max_hours, min_rest_hours, avoid_back_to_back }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to propose schedule');
      proposal = data;
    } catch (e: any) {
      error = e?.message || 'Failed to propose schedule';
    } finally { loading = false; }
  }

  async function approve() {
    if (!proposal?.proposal?.shifts?.length) { error = 'No shifts to approve'; return; }
    loading = true; error = '';
    try {
      const res = await fetch('/api/schedule/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposal.proposal_id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to approve');
      dispatch('approved', data);
      close();
    } catch (e: any) {
      error = e?.message || 'Failed to approve';
    } finally { loading = false; }
  }

  function close() {
    open = false; proposal = null; error = ''; loading = false;
    dispatch('close');
  }
</script>

{#if open}
  <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
    <div class="bg-gray-900 text-gray-100 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
      <div class="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 class="text-lg font-semibold">Propose Weekly Schedule</h3>
        <button class="px-2 py-1 bg-gray-700 rounded" on:click={close}>✕</button>
      </div>

      <div class="p-4 space-y-4">
        {#if error}
          <div class="p-2 bg-red-900/40 border border-red-700 rounded text-red-200 text-sm">{error}</div>
        {/if}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Week start (YYYY-MM-DD)</label>
            <input class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2" type="date" bind:value={week_start} />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Max hours per staff</label>
            <input class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2" type="number" bind:value={max_hours} />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Min rest hours</label>
            <input class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2" type="number" bind:value={min_rest_hours} />
          </div>
          <div class="flex items-center gap-2 mt-6">
            <input id="abb" type="checkbox" bind:checked={avoid_back_to_back} class="accent-teal-600" />
            <label for="abb" class="text-sm text-gray-300">Avoid back-to-back shifts</label>
          </div>
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Role targets</label>
          <div class="flex flex-wrap gap-2">
            {#each Object.entries(roles) as [role, count]}
              <div class="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-2 py-1">
                <span class="text-sm">{role}</span>
                <input class="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1" type="number" min="0" bind:value={roles[role]} />
                <button class="text-xs text-red-300" on:click={() => { delete roles[role]; roles = { ...roles }; }}>Remove</button>
              </div>
            {/each}
            <button class="px-2 py-1 bg-gray-700 rounded text-sm" on:click={() => { roles[`role_${Object.keys(roles).length+1}`] = 1; roles = { ...roles }; }}>+ Add role</button>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button class="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded" on:click={propose} disabled={loading}>{loading ? 'Generating…' : 'Generate proposal'}</button>
          <button class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded" on:click={close} disabled={loading}>Cancel</button>
        </div>

        {#if proposal?.proposal?.shifts}
          <div class="mt-4">
            <h4 class="font-semibold mb-2">Proposed shifts</h4>
            <div class="overflow-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-gray-800 text-gray-300">
                  <tr>
                    <th class="px-2 py-1 text-left">Staff</th>
                    <th class="px-2 py-1 text-left">Date</th>
                    <th class="px-2 py-1 text-left">Start</th>
                    <th class="px-2 py-1 text-left">End</th>
                    <th class="px-2 py-1 text-left">Position</th>
                    <th class="px-2 py-1 text-left">Section</th>
                    <th class="px-2 py-1 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {#each proposal.proposal.shifts as s}
                    <tr class="border-b border-gray-800">
                      <td class="px-2 py-1">{s.staff_id}</td>
                      <td class="px-2 py-1">{s.shift_date}</td>
                      <td class="px-2 py-1">{s.start_time}</td>
                      <td class="px-2 py-1">{s.end_time}</td>
                      <td class="px-2 py-1">{s.position}</td>
                      <td class="px-2 py-1">{s.section_code}</td>
                      <td class="px-2 py-1">{s.notes}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            <div class="mt-3 flex items-center gap-2">
              <button class="px-3 py-2 bg-green-600 hover:bg-green-700 rounded" on:click={approve} disabled={loading}>Approve & apply</button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  :global(.accent-teal-600) { accent-color: #0d9488; }
</style>
