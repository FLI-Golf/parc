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
  // Positions — align with Staff/Shift position values
  const positions = [
    'manager',
    'general_manager',
    'owner',
    'server',
    'host',
    'bartender',
    'barback',
    'busser',
    'chef',
    'kitchen_prep',
    'kitchen',
    'dishwasher',
    'security'
  ];
  let activePosition = 'server';

  // Per-position configuration
  // Weekday toggles (Mon–Thu) + counts; Weekend counts (Fri–Sun)
  // Special bartender settings include bar nights
  let roleConfigs = {
    manager: {
      weekdayLunchEnabled: true, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
    },
    server: {
      weekdayLunchEnabled: true, weekdayLunchCount: 1,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 2,
      weekendLunchCount: 1, weekendDinnerCount: 3,
    },
    chef: {
      weekdayLunchEnabled: true, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
    },
    bartender: {
      weekdayLunchEnabled: true, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
      barNights: { fri: true, sat: true, sun: true, start: '18:00', end: '24:00', bartenders: 1 }
    },
    barback: {
      weekdayLunchEnabled: true, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
    },
    host: {
      weekdayLunchEnabled: true, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
    },
    busser: {
      weekdayLunchEnabled: true, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
    },
    dishwasher: {
      weekdayLunchEnabled: true, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
    },
    kitchen_prep: {
      weekdayLunchEnabled: true, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
    },
    kitchen: {
      weekdayLunchEnabled: true, weekdayLunchCount: 0,
      weekdayDinnerEnabled: true,  weekdayDinnerCount: 1,
      weekendLunchCount: 0, weekendDinnerCount: 1,
    },
    security: {
      weekdayLunchEnabled: true, weekdayLunchCount: 0,
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

  // Per-day position filter: { [isoDate]: position | '' }
  let dayFilter = {};

   // Role icon/color meta for chips
   const positionMeta = {
     manager:           { icon: '👔', chip: 'bg-blue-900/30 text-blue-300 border-blue-600', chipActive: 'bg-blue-700 text-white border-blue-300' },
     general_manager:   { icon: '👔', chip: 'bg-blue-900/30 text-blue-300 border-blue-600', chipActive: 'bg-blue-700 text-white border-blue-300' },
     owner:             { icon: '🧑‍💼', chip: 'bg-indigo-900/30 text-indigo-300 border-indigo-600', chipActive: 'bg-indigo-700 text-white border-indigo-300' },
     server:            { icon: '🧑‍🍽️', chip: 'bg-green-900/30 text-green-300 border-green-600', chipActive: 'bg-green-700 text-white border-green-300' },
     host:              { icon: '🛎️', chip: 'bg-purple-900/30 text-purple-300 border-purple-600', chipActive: 'bg-purple-700 text-white border-purple-300' },
     bartender:         { icon: '🍸', chip: 'bg-sky-900/30 text-sky-300 border-sky-600', chipActive: 'bg-sky-700 text-white border-sky-300' },
     barback:           { icon: '🍹', chip: 'bg-cyan-900/30 text-cyan-300 border-cyan-600', chipActive: 'bg-cyan-700 text-white border-cyan-300' },
     busser:            { icon: '🧽', chip: 'bg-emerald-900/30 text-emerald-300 border-emerald-600', chipActive: 'bg-emerald-700 text-white border-emerald-300' },
     chef:              { icon: '👨‍🍳', chip: 'bg-amber-900/30 text-amber-300 border-amber-600', chipActive: 'bg-amber-700 text-white border-amber-300' },
     kitchen_prep:      { icon: '🔪', chip: 'bg-orange-900/30 text-orange-300 border-orange-600', chipActive: 'bg-orange-700 text-white border-orange-300' },
     kitchen:           { icon: '🍳', chip: 'bg-yellow-900/30 text-yellow-300 border-yellow-600', chipActive: 'bg-yellow-700 text-white border-yellow-300' },
     dishwasher:        { icon: '🧼', chip: 'bg-zinc-800 text-zinc-300 border-zinc-600', chipActive: 'bg-zinc-600 text-white border-zinc-300' },
     security:          { icon: '🛡️', chip: 'bg-red-900/30 text-red-300 border-red-600', chipActive: 'bg-red-700 text-white border-red-300' },
   };
   const defaultMeta = { icon: '👤', chip: 'bg-gray-800 text-gray-300 border-gray-600', chipActive: 'bg-gray-600 text-white border-gray-300' };
   const getPosMeta = (p) => positionMeta[p] || defaultMeta;

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

  // Weekday label helper (e.g., Thu)
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function getWeekdayLabel(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return WEEKDAYS[dow] || '';
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
              position: pos, section_code: c % 2 ? 'B' : (pos === 'bartender' ? 'BAR' : 'A'), shift_type: 'lunch', notes: 'Lunch (weekday)'

            });
          }
        }
        if (cfg.weekdayDinnerEnabled && (cfg.weekdayDinnerCount || 0) > 0) {
          for (let c = 0; c < (cfg.weekdayDinnerCount || 0); c++) {
            const st = pickStaff(staffList, pos, i * 100 + c);
            shifts.push({
              staff_id: st.id, staff_name: st.name, shift_date: week[i], start_time: '14:00', end_time: '23:00',
              position: pos, section_code: c % 2 ? 'B' : (pos === 'bartender' ? 'BAR' : 'A'), shift_type: 'dinner', notes: 'Dinner (weekday)'
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
              position: pos, section_code: c % 2 ? 'B' : (pos === 'bartender' ? 'BAR' : 'A'), shift_type: 'lunch', notes: 'Lunch (weekend)'
            });
          }
        }
        if ((cfg.weekendDinnerCount || 0) > 0) {
          for (let c = 0; c < (cfg.weekendDinnerCount || 0); c++) {
            const st = pickStaff(staffList, pos, i * 200 + c);
            shifts.push({
              staff_id: st.id, staff_name: st.name, shift_date: week[i], start_time: '14:00', end_time: '23:00',
              position: pos, section_code: c % 2 ? 'B' : (pos === 'bartender' ? 'BAR' : 'A'), shift_type: 'dinner', notes: 'Dinner (weekend)'
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
              position: 'bartender', section_code: 'BAR', shift_type: 'dinner', notes: 'Bar night'
            });
          }
        }
      }
    }

    return { shifts };
  }

  let saving = false;
  let saveProgress = 0; // 0-100
  let showApproveModal = false;
  let showShiftDetail = false;
  let selectedShift = null;

  // Quick add/remove shifts for a given day/position in the proposal (UI only)
  function addShiftForDayPosition(day, position) {
    try {
      const staffList = get(staffStore) || [];
      const countExisting = (proposal?.shifts || []).filter(s => (s.shift_date === day) && ((s.position || '').toLowerCase() === position)).length;
      const st = pickStaff(staffList, position, countExisting);
      const section = position === 'bartender' ? 'BAR' : 'A';
      const newShift = {
        staff_id: st.id, staff_name: st.name, shift_date: day,
        start_time: '14:00', end_time: '23:00',
        position, section_code: section, shift_type: 'dinner', notes: 'Added manually'
      };
      proposal = { shifts: [...(proposal?.shifts || []), newShift] };
    } catch (e) {
      console.error('Failed to add shift:', e);
    }
  }
  function removeShiftForDayPosition(day, position) {
    try {
      const idx = (proposal?.shifts || []).slice().reverse().findIndex(s => (s.shift_date === day) && ((s.position || '').toLowerCase() === position));
      if (idx === -1) return;
      const realIdx = (proposal.shifts.length - 1) - idx;
      const arr = proposal.shifts.slice();
      arr.splice(realIdx, 1);
      proposal = { shifts: arr };
    } catch (e) {
      console.error('Failed to remove shift:', e);
    }
  }

  function openShiftDetails(s) {
    selectedShift = s;
    showShiftDetail = true;
  }

  async function approveSelected() {
    // Approvals allowed any day; retain brunch validation
    if (!proposal?.shifts?.length || saving) return;

    // Simple brunch validation
    for (const row of proposal.shifts) {
      if (row.shift_type === 'brunch' && !isSunday(row.shift_date)) {
        alert('Brunch shifts must be on Sunday. Fix dates before approval.');
        return;
      }
    }

    saving = true;
    saveProgress = 0;

    try {
      // Ensure sections are loaded so section_code can be mapped
      await collections.getSections();

      const total = proposal.shifts.length;
      let created = 0;
      const errors = [];

      for (const row of proposal.shifts) {
        // Skip mock/unassigned staff rows
        if (!row.staff_id || String(row.staff_id).startsWith('mock-')) {
          errors.push({ row, error: new Error('No real staff assigned to this shift') });
          continue;
        }
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
        try {
          await collections.createShift(payload);
          created += 1;
        } catch (err) {
          console.error('Create shift failed for row:', row, err);
          errors.push({ row, error: err });
        }
        saveProgress = Math.round(((created + errors.length) / total) * 100);
      }
      await collections.getShifts();
      if (errors.length === 0) {
        // Success: no blocking alert; continue to manager dashboard
      } else {
        const first = errors[0]?.error;
        const msg = first?.data?.message || first?.message || 'Some shifts failed';
        alert(`${created}/${total} shifts created. ${errors.length} failed. ${msg}`);
      }
      goto('/dashboard/manager');
    } catch (e) {
      console.error('Approval error:', e);
      const detail = e?.data?.message || e?.message || e;
      alert(detail || 'Failed to create some shifts');
    } finally {
      saving = false;
      saveProgress = 0;
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
        <!-- Quick selector for all roles (mobile-friendly) -->
        <div class="mb-2">
          <label class="sr-only">Select role</label>
          <select bind:value={activePosition} class="w-full bg-gray-700 border border-gray-600 rounded px-2 py-2 text-sm">
            {#each positions as p}
              <option value={p}>{p}</option>
            {/each}
          </select>
        </div>
        <!-- Active position controls -->
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

            {/if}

      </div>

      <button on:click={generateProposal} class="w-full mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium">Generate proposal</button>
      {#if error}
        <div class="text-sm text-yellow-300">{error}</div>
      {/if}

    </div>

  {#if showShiftDetail}
    <div class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60">
      <div class="w-full max-w-xl bg-gray-900 border border-gray-700 rounded-xl shadow-xl shadow-black/50">
        <div class="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 class="text-lg font-semibold">Shift details</h3>
          <button class="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded" on:click={() => { showShiftDetail = false; selectedShift = null; }}>✕</button>
        </div>
        <div class="p-4 space-y-3 text-sm">
          {#if selectedShift}
            {@const p = (selectedShift.position || (selectedShift.shift_type === 'brunch' ? 'server' : '') || '').toLowerCase()}
            {@const meta = getPosMeta(p)}
            <div class="flex items-center gap-2">
              <span class={`px-1.5 py-0.5 rounded border inline-flex items-center justify-center ${meta.chip}`} title={p || 'role'}>
                <span>{meta.icon}</span>
              </span>
              <div class="font-medium">{selectedShift.staff_name || selectedShift.staff_id}</div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <div class="text-gray-400">Date</div>
                <div>{selectedShift.shift_date} {getWeekdayLabel(selectedShift.shift_date)}</div>
              </div>
              <div>
                <div class="text-gray-400">Time</div>
                <div>{selectedShift.start_time}–{selectedShift.end_time}</div>
              </div>
              <div>
                <div class="text-gray-400">Position</div>
                <div class="capitalize">{p || '—'}</div>
              </div>
              <div>
                <div class="text-gray-400">Section</div>
                <div>{selectedShift.section_code || '—'}</div>
              </div>
              <div>
                <div class="text-gray-400">Type</div>
                <div>{selectedShift.shift_type || 'regular'}</div>
              </div>
              <div>
                <div class="text-gray-400">Notes</div>
                <div class="break-words">{selectedShift.notes || '—'}</div>
              </div>
            </div>
          {/if}
          <div class="flex justify-end gap-2 pt-2">
            <button class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded" on:click={() => { showShiftDetail = false; selectedShift = null; }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  {/if}
 
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
                      <div class="flex items-center gap-2">
                        <input type="date" bind:value={s.shift_date} class="bg-gray-700 border border-gray-600 rounded px-2 py-1" />
                        <span class="text-xs text-gray-400">{getWeekdayLabel(s.shift_date)}</span>
                      </div>
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
              {@const dayShifts = proposal.shifts.filter(s => s.shift_date === day)}
              {@const counts = positions.map(p => ({ p, c: dayShifts.filter(s => (s.position || (s.shift_type==='brunch' ? 'server' : '') || '').toLowerCase() === p).length }))}
              <div class="border border-gray-700 rounded p-2 min-h-[140px]">
                <div class="text-xs text-gray-400 mb-2">{day} {getWeekdayLabel(day)}</div>
                <!-- Position counts row -->
                <div class="mb-2 flex flex-wrap gap-2">
                  {#each counts as item}
                    {#if item.c > 0}
                      <div class="flex flex-col items-start gap-1">
                        <button
                          type="button"
                          class={`px-2 py-0.5 rounded text-[11px] border ${dayFilter[day] === item.p ? getPosMeta(item.p).chipActive : getPosMeta(item.p).chip}`}
                          on:click={() => dayFilter = { ...dayFilter, [day]: (dayFilter[day] === item.p ? '' : item.p) }}
                          title={`Filter ${day} by ${item.p}`}
                        ><span class="mr-1">{getPosMeta(item.p).icon}</span>{item.p} ({item.c})</button>
                        <div class="flex items-center gap-1">
                          <button
                            type="button"
                            class="px-1.5 py-0.5 text-[11px] rounded border bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                            title={`Add ${item.p} on ${day}`}
                            on:click={() => addShiftForDayPosition(day, item.p)}
                          >+
                          </button>
                          <button
                            type="button"
                            class="px-1.5 py-0.5 text-[11px] rounded border bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                            title={`Remove ${item.p} on ${day}`}
                            on:click={() => removeShiftForDayPosition(day, item.p)}
                          >−
                          </button>
                        </div>
                      </div>
                    {/if}
                  {/each}
                </div>
                {#each dayShifts.filter(s => !dayFilter[day] || ((s.position || (s.shift_type==='brunch' ? 'server' : '') || '').toLowerCase() === dayFilter[day])) as s}
                  {@const p = (s.position || (s.shift_type === 'brunch' ? 'server' : '') || '').toLowerCase()}
                  {@const meta = getPosMeta(p)}
                  <button type="button" class="mb-2 bg-gray-700 rounded p-2 w-full text-left hover:bg-gray-600/80 transition-colors" on:click={() => openShiftDetails(s)}>
                    <div class="text-xs text-gray-300 truncate flex items-center gap-2">
                      <span class={`px-1.5 py-0.5 rounded border inline-flex items-center justify-center ${meta.chip}`} title={p || 'role'}>
                        <span>{meta.icon}</span>
                      </span>
                      <span class="truncate">{s.staff_name || s.staff_id}</span>
                    </div>
                    <div class="text-xs">{s.start_time}–{s.end_time} • {s.section_code}</div>
                    {#if s.shift_type === 'brunch'}
                      <div class="text-[10px] text-yellow-300">Brunch</div>
                    {/if}
                  </button>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
        <div class="mt-4">
          {#if saving}
            <div class="mb-3">
              <div class="h-2 w-full bg-gray-700 rounded">
                <div class="h-2 bg-green-500 rounded transition-all" style={`width: ${saveProgress}%;`}></div>
              </div>
              <div class="mt-1 text-xs text-gray-300">Saving shifts… {saveProgress}%</div>
            </div>
          {/if}
          <div class="flex justify-end">
            <button on:click={() => showApproveModal = true} disabled={saving} class="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700">
              {saving ? 'Saving…' : 'Approve and Create'}
            </button>
          </div>
        </div>
      {:else}
        <div class="text-gray-400">No proposal yet. Generate to preview shifts.</div>
      {/if}
    </div>
  </div>

  {#if showApproveModal}
    <div class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60">
      <div class="w-full max-w-3xl bg-gray-900 border border-gray-700 rounded-xl shadow-xl shadow-black/50">
        <div class="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 class="text-lg font-semibold">Approve and Create</h3>
          <button class="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded" on:click={() => showApproveModal = false}>✕</button>
        </div>
        <div class="p-4 space-y-4 text-sm">
          <div class="text-gray-300">
            Nothing is created or saved until you click <strong>Approve and Create</strong>. You can generate and edit locally as many times as you want.
          </div>

          {#if proposal?.shifts?.length}
            <div class="rounded border border-gray-700 bg-gray-800/40">
              <div class="p-3 border-b border-gray-700 font-medium">Summary for week starting {week_start}</div>
              <div class="p-3 space-y-3">
                {#each getWeekDates(getWeekSunday(week_start)) as day}
                  {@const dayShifts = proposal.shifts.filter(s => s.shift_date === day)}
                  {#if dayShifts.length}
                    <div>
                      <div class="text-xs text-gray-400 mb-1">{day} {getWeekdayLabel(day)} • {dayShifts.length} shift{dayShifts.length === 1 ? '' : 's'}</div>
                      <div class="flex flex-wrap gap-2">
                        {#each positions as p}
                          {@const c = dayShifts.filter(s => (s.position || (s.shift_type==='brunch' ? 'server' : '') || '').toLowerCase() === p).length}
                          {#if c > 0}
                            {@const meta = getPosMeta(p)}
                            <span class={`inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded border ${meta.chip}`}>
                              <span>{meta.icon}</span>
                              <span>{p}</span>
                              <span class="opacity-70">({c})</span>
                            </span>
                          {/if}
                        {/each}
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

          <div class="flex items-center justify-end gap-2">
            <button class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded" on:click={() => showApproveModal = false}>Cancel</button>
            <button class="px-3 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-60 disabled:cursor-not-allowed" disabled={saving} on:click={async () => { showApproveModal = false; await approveSelected(); }}>
              {saving ? 'Saving…' : 'Approve and Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
