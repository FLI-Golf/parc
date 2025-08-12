<script>
  // @ts-nocheck
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { collections, staff as staffStore } from '$lib/stores/collections.js';
  import { get } from 'svelte/store';

  // AI status chip
  let aiReady = false; // flips true after a successful propose call

  // Form state
  let range = 'week'; // 'week' | 'month'
  let week_start = toISODate(new Date());
  let constraints = {
    max_hours: 36,
    min_rest_hours: 10,
    avoid_back_to_back: true,
    role_targets: [{ role: 'server', count: 4 }, { role: 'bartender', count: 1 }]
  };

  // Generation options (Local generator)
  let includeDays = {
    sun: true,
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: true
  };
  let brunchOnSunday = true;
  // Positions (tabs) — ordered as requested
  const positions = [
    'manager', 'server', 'chef', 'bartender', 'host', 'busser', 'dishwasher', 'kitchen_prep', 'owner'
  ];
  let activePosition = 'server';

  // Per-position configuration
  // Weekday toggles (Mon–Thu) + counts; Weekend counts (Fri–Sun)
  // Special bartender settings include bar nights
  let roleConfigs = {
    manager: {
      weekdayLunchEnabled: false, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
    },
    server: {
      weekdayLunchEnabled: false, weekdayLunchCount: 1,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 2,
      weekendLunchCount: 1, weekendDinnerCount: 3,
    },
    chef: {
      weekdayLunchEnabled: false, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
    },
    bartender: {
      weekdayLunchEnabled: false, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
      barNights: { fri: true, sat: true, sun: true, start: '18:00', end: '24:00', bartenders: 1 }
    },
    host: {
      weekdayLunchEnabled: false, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
    },
    busser: {
      weekdayLunchEnabled: false, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
    },
    dishwasher: {
      weekdayLunchEnabled: false, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
    },
    kitchen_prep: {
      weekdayLunchEnabled: false, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
    },
    owner: {
      weekdayLunchEnabled: false, weekdayLunchCount: 0,
      weekdayDinnerEnabled: false, weekdayDinnerCount: 0,
      weekendLunchCount: 0, weekendDinnerCount: 0,
    }
  };

  // Generator: 'local' (no POST) or 'ai' (calls /api/schedule/propose)
  let generator = 'local';

  // Proposal state
  let proposal = null; // { shifts: [...] }
  let error = '';
  let viewMode = 'calendar'; // 'list' | 'calendar'

  // Helpers: dates and brunch/Sunday logic
  function getWeekSunday(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const day = dt.getDay(); // 0 = Sun
    const sunday = new Date(dt);
    sunday.setDate(dt.getDate() - day);
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  }
  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function isSunday(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d).getDay() === 0;
  }

  async function generateProposal() {
    error = '';
    proposal = null;

    // Load staff from PocketBase and log them for debugging
    try {
    await collections.getStaff();
    const staffList = get(staffStore);
    console.log('👥 Staff records loaded for proposal:', staffList);
    } catch (e) {
         console.warn('Could not load staff records:', e?.message || e);
    }
    
    // Local generator: no POST, pure client-side mock
    if (generator === 'local') {
      const staffList = get(staffStore);
      proposal = mockProposal(week_start, staffList);
      aiReady = false;
      return;
    }
 
    try {
      const res = await fetch('/api/schedule/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start, constraints })
      });
      if (res.status === 401) {
        // mock fallback
        proposal = mockProposal(week_start);
        aiReady = false;
        return;
      }
      if (!res.ok) {
        // Friendly fallback: switch to mock silently
        proposal = mockProposal(week_start);
        aiReady = false;
        error = 'AI unavailable. Using mock proposal.';
        return;
      }
      const data = await res.json();
      proposal = data?.proposal ?? null;
      aiReady = true;
    } catch (e) {
      console.error('Propose error:', e);
      // Friendly fallback
      proposal = mockProposal(week_start);
      aiReady = false;
      error = 'AI unavailable. Using mock proposal.';
    }
  }

  function getWeekDates(sunday) {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return toISODate(d);
    });
  }

  function pickStaff(staffList, position, index) {
    const pool = (staffList || []).filter(s => (s.position || s.role || '').toLowerCase().includes(position));
    if (pool.length === 0) return { id: `mock-${position}-${index+1}`, name: `Mock ${position} ${index+1}` };
    const s = pool[index % pool.length];
    const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.name || s.email || s.id;
    return { id: s.id, name };
  }

  function mockProposal(startIso, staffList = []) {
    const sunday = getWeekSunday(startIso);
    const week = getWeekDates(sunday);
    const dayFlags = [includeDays.sun, includeDays.mon, includeDays.tue, includeDays.wed, includeDays.thu, includeDays.fri, includeDays.sat];

    const shifts = [];

    // Sunday brunch (servers)
    if (dayFlags[0] && brunchOnSunday) {
      const st = pickStaff(staffList, 'server', 0);
      shifts.push({
        staff_id: st.id, staff_name: st.name, shift_date: week[0], start_time: '08:00', end_time: '13:00',
        position: 'server', section_code: 'A', shift_type: 'brunch', notes: 'Brunch service'
      });
    }

    // Generate per position
    for (const pos of positions) {
      const cfg = roleConfigs[pos] || {};

      // Weekdays: Mon(1)-Thu(4)
      for (let i = 1; i <= 4; i++) {
        if (!dayFlags[i]) continue;
        if (cfg.weekdayLunchEnabled && (cfg.weekdayLunchCount || 0) > 0) {
          for (let c = 0; c < (cfg.weekdayLunchCount || 0); c++) {
            const st = pickStaff(staffList, pos, i * 10 + c);
            shifts.push({
              staff_id: st.id, staff_name: st.name, shift_date: week[i], start_time: '11:00', end_time: '17:00',
              position: pos, section_code: c % 2 ? 'B' : (pos === 'bartender' ? 'BAR' : 'A'), shift_type: 'regular', notes: 'Lunch (weekday)'
            });
          }
        }
        if (cfg.weekdayDinnerEnabled && (cfg.weekdayDinnerCount || 0) > 0) {
          for (let c = 0; c < (cfg.weekdayDinnerCount || 0); c++) {
            const st = pickStaff(staffList, pos, i * 100 + c);
            shifts.push({
              staff_id: st.id, staff_name: st.name, shift_date: week[i], start_time: '14:00', end_time: '23:00',
              position: pos, section_code: c % 2 ? 'B' : (pos === 'bartender' ? 'BAR' : 'A'), shift_type: 'regular', notes: 'Dinner (weekday)'
            });
          }
        }
      }

      // Weekend: Fri(5), Sat(6), Sun(0)
      const weekendIdx = [5, 6, 0];
      for (const i of weekendIdx) {
        if (!dayFlags[i]) continue;
        if ((cfg.weekendLunchCount || 0) > 0) {
          for (let c = 0; c < (cfg.weekendLunchCount || 0); c++) {
            const st = pickStaff(staffList, pos, i * 20 + c);
            shifts.push({
              staff_id: st.id, staff_name: st.name, shift_date: week[i], start_time: '11:00', end_time: '17:00',
              position: pos, section_code: c % 2 ? 'B' : (pos === 'bartender' ? 'BAR' : 'A'), shift_type: 'regular', notes: 'Lunch (weekend)'
            });
          }
        }
        if ((cfg.weekendDinnerCount || 0) > 0) {
          for (let c = 0; c < (cfg.weekendDinnerCount || 0); c++) {
            const st = pickStaff(staffList, pos, i * 200 + c);
            shifts.push({
              staff_id: st.id, staff_name: st.name, shift_date: week[i], start_time: '14:00', end_time: '23:00',
              position: pos, section_code: c % 2 ? 'B' : (pos === 'bartender' ? 'BAR' : 'A'), shift_type: 'regular', notes: 'Dinner (weekend)'
            });
          }
        }
      }

      // Bartender bar nights (Fri/Sat/Sun)
      if (pos === 'bartender' && cfg.barNights) {
        const barMap = { 0: 'sun', 5: 'fri', 6: 'sat' };
        for (const idx of [0, 5, 6]) {
          const key = barMap[idx];
          if (!dayFlags[idx]) continue;
          if (!cfg.barNights[key]) continue;
          for (let b = 0; b < (cfg.barNights.bartenders || 0); b++) {
            const st = pickStaff(staffList, 'bartender', idx * 1000 + b);
            shifts.push({
              staff_id: st.id, staff_name: st.name, shift_date: week[idx], start_time: cfg.barNights.start || '18:00', end_time: cfg.barNights.end || '24:00',
              position: 'bartender', section_code: 'BAR', shift_type: 'regular', notes: 'Bar night'
            });
          }
        }
      }
    }

    return { shifts };
  }

  async function approveSelected() {
    // Approvals allowed any day; retain brunch validation
    if (!proposal?.shifts?.length) return;

    // Simple brunch validation
    for (const row of proposal.shifts) {
      if (row.shift_type === 'brunch' && !isSunday(row.shift_date)) {
        alert('Brunch shifts must be on Sunday. Fix dates before approval.');
        return;
      }
    }

    try {
      for (const row of proposal.shifts) {
        // Map to backend shape; omit UI-only fields
        const payload = {
          staff_member: row.staff_id,
          shift_date: row.shift_date,
          start_time: row.start_time,
          end_time: row.end_time,
          break_duration: row.break_duration ?? 0,
          position: row.position || 'server',
          status: row.status || 'scheduled',
          notes: row.notes || '',
          assigned_section: row.assigned_section || undefined,
          shift_type: row.shift_type || 'regular',
          section_code: row.section_code || undefined // for helper mapping in collections
        };
        await collections.createShift(payload);
      }
      await collections.getShifts();
      alert('Shifts created.');
      goto('/dashboard/manager');
    } catch (e) {
      console.error('Approval error:', e);
      const detail = e?.data?.message || e?.message || e;
      alert(detail || 'Failed to create some shifts');
    }
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100 p-6">
  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-3">
      <button on:click={() => goto('/dashboard/manager')} class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">← Back</button>
      <div>
        <h1 class="text-2xl font-bold">AI Schedule Proposal</h1>
        <p class="text-gray-400">Generate a weekly or monthly schedule, review, then approve to create shifts.</p>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <div class="text-xs bg-gray-700 px-2 py-1 rounded">
        <span class="opacity-75 mr-2">Generator:</span>
        <label class="mr-2"><input type="radio" name="gen" value="local" bind:group={generator} /> Local</label>
        <label><input type="radio" name="gen" value="ai" bind:group={generator} /> AI</label>
      </div>
      <div class="text-xs px-2 py-1 rounded bg-gray-700">
        <span class={aiReady ? 'text-green-300' : 'text-yellow-300'}>
          {aiReady ? 'AI Ready' : 'Mock Mode'}
        </span>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Left: parameters -->
    <div class="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
      <div class="text-xs text-gray-400 bg-gray-800/70 border border-gray-700 rounded p-2">
        Nothing is created or saved until you click <strong>Approve and Create</strong>.
        You can generate and edit locally as many times as you want.
      </div>
      <div>
        <label class="block text-sm text-gray-300 mb-1">Generate for (range)</label>
        <select bind:value={range} class="w-full bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm">
          <option value="week">Week (defaults to current week)</option>
          <option value="month">Month (all days in the month)</option>
        </select>
      </div>
      <div>
        <label class="block text-sm text-gray-300 mb-1">Week start (YYYY-MM-DD)</label>
        <input type="date" bind:value={week_start} class="w-full bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-400 mb-1">Max hours per staff (weekly)</label>
          <input type="number" bind:value={constraints.max_hours} class="w-full bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Minimum rest between shifts (hours)</label>
          <input type="number" bind:value={constraints.min_rest_hours} class="w-full bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm" />
        </div>
      </div>
      <label class="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" bind:checked={constraints.avoid_back_to_back} />
        <span>Avoid back-to-back shifts (reduce fatigue)</span>
      </label>

      <div class="mt-4 border-t border-gray-700 pt-4 space-y-3">
        <div class="text-sm font-semibold">By position</div>
        <!-- Tabs -->
        <div class="flex flex-wrap gap-2 mb-2">
          {#each positions as p}
            <button type="button"
              class={`px-2 py-1 text-xs rounded border ${activePosition === p ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`}
              on:click={() => activePosition = p}
            >{p}</button>
          {/each}
        </div>
        <!-- Active tab content -->
        {#if roleConfigs[activePosition]}
          <div class="space-y-2 text-xs">
            <div class="text-gray-300">Weekday (Mon–Thu)</div>
            <label class="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" bind:checked={roleConfigs[activePosition].weekdayLunchEnabled} /> Lunch
            </label>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <label class="inline-flex items-center gap-2">
                Staff at lunch <input type="number" min="0" bind:value={roleConfigs[activePosition].weekdayLunchCount} class="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1" />
              </label>
            </div>
            <label class="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" bind:checked={roleConfigs[activePosition].weekdayDinnerEnabled} /> Dinner
            </label>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <label class="inline-flex items-center gap-2">
                Staff at dinner <input type="number" min="0" bind:value={roleConfigs[activePosition].weekdayDinnerCount} class="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1" />
              </label>
            </div>

            <div class="text-gray-300 mt-2">Weekend (Fri–Sun)</div>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <label class="inline-flex items-center gap-2">
                Staff at lunch <input type="number" min="0" bind:value={roleConfigs[activePosition].weekendLunchCount} class="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1" />
              </label>
              <label class="inline-flex items-center gap-2">
                Staff at dinner <input type="number" min="0" bind:value={roleConfigs[activePosition].weekendDinnerCount} class="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1" />
              </label>
            </div>

            {#if activePosition === 'bartender'}
              <div class="text-gray-300 mt-2">Bar nights</div>
              <div class="grid grid-cols-3 gap-2 text-xs">
                <label class="inline-flex items-center gap-1"><input type="checkbox" bind:checked={roleConfigs.bartender.barNights.fri} />Fri</label>
                <label class="inline-flex items-center gap-1"><input type="checkbox" bind:checked={roleConfigs.bartender.barNights.sat} />Sat</label>
                <label class="inline-flex items-center gap-1"><input type="checkbox" bind:checked={roleConfigs.bartender.barNights.sun} />Sun</label>
              </div>
              <div class="grid grid-cols-3 gap-3 text-xs items-center">
                <label class="inline-flex items-center gap-2">Start <input type="time" bind:value={roleConfigs.bartender.barNights.start} class="bg-gray-700 border border-gray-600 rounded px-2 py-1" /></label>
                <label class="inline-flex items-center gap-2">End <input type="time" bind:value={roleConfigs.bartender.barNights.end} class="bg-gray-700 border border-gray-600 rounded px-2 py-1" /></label>
                <label class="inline-flex items-center gap-2">Bartenders <input type="number" min="0" bind:value={roleConfigs.bartender.barNights.bartenders} class="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1" /></label>
              </div>
            {/if}
          </div>
        {/if}

        <div class="text-sm font-semibold mt-4">Days to include</div>
        <div class="grid grid-cols-7 gap-2 text-xs">
          <label class="inline-flex items-center gap-1"><input type="checkbox" bind:checked={includeDays.sun} />Sun</label>
          <label class="inline-flex items-center gap-1"><input type="checkbox" bind:checked={includeDays.mon} />Mon</label>
          <label class="inline-flex items-center gap-1"><input type="checkbox" bind:checked={includeDays.tue} />Tue</label>
          <label class="inline-flex items-center gap-1"><input type="checkbox" bind:checked={includeDays.wed} />Wed</label>
          <label class="inline-flex items-center gap-1"><input type="checkbox" bind:checked={includeDays.thu} />Thu</label>
          <label class="inline-flex items-center gap-1"><input type="checkbox" bind:checked={includeDays.fri} />Fri</label>
          <label class="inline-flex items-center gap-1"><input type="checkbox" bind:checked={includeDays.sat} />Sat</label>
        </div>
        <label class="inline-flex items-center gap-2 text-sm mt-2"><input type="checkbox" bind:checked={brunchOnSunday} /> Include Sunday brunch</label>
      </div>

      <button on:click={generateProposal} class="w-full mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium">Generate proposal</button>
      {#if error}
        <div class="text-sm text-yellow-300">{error}</div>
      {/if}
    </div>

    <!-- Right: review list / calendar -->
    <div class="lg:col-span-2 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold">Review</h2>
        <div class="text-xs bg-gray-700 rounded px-2 py-1">
          <label class="mr-2"><input type="radio" name="view" value="list" bind:group={viewMode} /> List</label>
          <label><input type="radio" name="view" value="calendar" bind:group={viewMode} /> Calendar</label>
        </div>
      </div>
      {#if proposal?.shifts?.length}
        {#if viewMode === 'list'}
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="text-gray-300">
                <tr>
                  <th class="text-left p-2">Staff</th>
                  <th class="text-left p-2">Date</th>
                  <th class="text-left p-2">Start</th>
                  <th class="text-left p-2">End</th>
                  <th class="text-left p-2">Position</th>
                  <th class="text-left p-2">Section</th>
                  <th class="text-left p-2">Type</th>
                  <th class="text-left p-2">Notes</th>
                </tr>
              </thead>
              <tbody class="text-gray-200">
                {#each proposal.shifts as s}
                  <tr class="border-t border-gray-700">
                    <td class="p-2">{(s.staff_name || s.staff_id) + ' • ' + (s.position || (s.shift_type === 'brunch' ? 'server' : ''))}</td>
                    <td class="p-2">
                      <input type="date" bind:value={s.shift_date} class="bg-gray-700 border border-gray-600 rounded px-2 py-1" />
                      {#if s.shift_type === 'brunch' && !isSunday(s.shift_date)}
                        <div class="text-xs text-yellow-300">Brunch must be on Sunday</div>
                      {/if}
                    </td>
                    <td class="p-2"><input type="time" bind:value={s.start_time} class="bg-gray-700 border border-gray-600 rounded px-2 py-1" /></td>
                    <td class="p-2"><input type="time" bind:value={s.end_time} class="bg-gray-700 border border-gray-600 rounded px-2 py-1" /></td>
                    <td class="p-2"><input type="text" bind:value={s.position} class="bg-gray-700 border border-gray-600 rounded px-2 py-1" /></td>
                    <td class="p-2"><input type="text" bind:value={s.section_code} class="bg-gray-700 border border-gray-600 rounded px-2 py-1" /></td>
                    <td class="p-2"><input type="text" bind:value={s.shift_type} class="bg-gray-700 border border-gray-600 rounded px-2 py-1" /></td>
                    <td class="p-2"><input type="text" bind:value={s.notes} class="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-full" /></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="grid grid-cols-7 gap-2">
            {#each getWeekDates(getWeekSunday(week_start)) as day}
              <div class="border border-gray-700 rounded p-2 min-h-[120px]">
                <div class="text-xs text-gray-400 mb-2">{day}</div>
                {#each proposal.shifts.filter(s => s.shift_date === day) as s}
                  <div class="mb-2 bg-gray-700 rounded p-2">
                    <div class="text-xs text-gray-300 truncate">{s.staff_name || s.staff_id} • {s.position || (s.shift_type === 'brunch' ? 'server' : '')}</div>
                    <div class="text-xs">{s.start_time}–{s.end_time} • {s.section_code}</div>
                    {#if s.shift_type === 'brunch'}
                      <div class="text-[10px] text-yellow-300">Brunch</div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
        <div class="mt-4 flex justify-end">
          <button on:click={approveSelected} class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium">Approve and Create</button>
        </div>
      {:else}
        <div class="text-gray-400">No proposal yet. Generate to preview shifts.</div>
      {/if}
    </div>
  </div>
</div>
