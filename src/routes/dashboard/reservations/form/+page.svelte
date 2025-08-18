<script>
  import { goto } from '$app/navigation';
  import { collections } from '$lib/stores/collections.js';
  import pb from '$lib/pocketbase.js';

  let form = {
    reservation_date: '', // YYYY-MM-DD
    start_time: '',       // HH:MM (24h)
    party_size: 2,
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    notes: ''
  };
  let submitting = false;
  let error = '';
  let successId = '';
  let successInfo = null; // { name, date, time, party, phone, email, tableAssigned }

  function getToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // Initialize defaults
  $: if (!form.reservation_date) form.reservation_date = getToday();

  async function submitReservation() {
    error = '';
    submitting = true;
    try {
      if (!form.customer_name?.trim()) throw new Error('Please enter your name');
      if (!form.reservation_date) throw new Error('Please select a date');
      if (!form.start_time) throw new Error('Please select a time');
      const party = Number(form.party_size);
      if (!party || party < 1) throw new Error('Party size must be at least 1');

      const payload = {
        ...form,
        reservation_date: String(form.reservation_date).slice(0,10),
        start_time: String(form.start_time),
        party_size: party
      };

      // Use server endpoint to bypass client auth and apply auto-assignment logic
      const res = await fetch('/api/reservations/opentable?debug=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let msg = `Failed (${res.status})`;
        try {
          const data = await res.json();
          msg = data?.error || msg;
          if (data?.details) {
            console.warn('Reservation create details:', data.details);
            // Surface the most relevant field error if present
            const fields = Object.keys(data.details || {});
            const firstField = fields[0];
            const fieldMsg = firstField && data.details[firstField]?.message ? ` (${firstField}: ${data.details[firstField].message})` : '';
            msg = `${msg}${fieldMsg}`;
          }
        } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      if (data?.debug) console.log('Reservation debug:', data.debug);
      const r = data?.reservation || {};
      successId = r.id || 'created';
      // Friendly displays
      const rawDate = r.reservation_date || payload.reservation_date;
      let dateDisplay = rawDate;
      try {
        dateDisplay = (String(rawDate).includes('T') || String(rawDate).endsWith('Z'))
          ? new Date(rawDate).toISOString().slice(0,10)
          : String(rawDate).slice(0,10);
      } catch {}
      successInfo = {
        name: r.customer_name || form.customer_name,
        date: dateDisplay,
        time: r.start_time || payload.start_time,
        party: r.party_size || payload.party_size,
        phone: r.customer_phone || form.customer_phone,
        email: r.customer_email || form.customer_email,
        tableAssigned: !!r.table_id
      };
    } catch (e) {
      console.error('Reservation submit failed:', e?.data || e);
      error = e?.data?.message || e?.message || 'Failed to submit reservation. Please try again later.';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100">
  <header class="py-6 px-4 sm:px-6 lg:px-8 border-b border-gray-800">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center"><span class="font-bold text-xl">P</span></div>
        <h1 class="text-2xl font-bold">PARC Portal</h1>
      </div>
      <nav class="hidden md:block">
        <ul class="flex gap-6">
          <li><a href="/" class="hover:text-blue-400">Home</a></li>
          <li><a href="/dashboard/reservations/form" class="text-blue-400">Reservations</a></li>
          <li><a href="#" class="hover:text-blue-400">About</a></li>
          <li><a href="#" class="hover:text-blue-400">Contact</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <main class="max-w-2xl mx-auto p-6">
    <h2 class="text-3xl font-semibold mb-2">Request a Reservation</h2>
    <p class="text-gray-400 mb-6">Fill out the form below. We’ll confirm by email or phone.</p>

    {#if successId}
      <div class="p-5 mb-6 rounded-lg border border-green-700 bg-green-900/20 text-green-100">
        <div class="text-xl font-semibold mb-1">Thank you{successInfo?.name ? `, ${successInfo.name}` : ''}!</div>
        <div>Your reservation request has been received.</div>
        <ul class="mt-3 text-green-200/90 text-sm space-y-1">
          {#if successInfo}
            <li>• Date: <span class="font-medium">{successInfo.date}</span></li>
            <li>• Time: <span class="font-medium">{successInfo.time}</span></li>
            <li>• Party: <span class="font-medium">{successInfo.party}</span></li>
            {#if successInfo.phone}<li>• Phone: <span class="font-medium">{successInfo.phone}</span></li>{/if}
            {#if successInfo.email}<li>• Email: <span class="font-medium">{successInfo.email}</span></li>{/if}
            <li>• Table assignment: <span class="font-medium">{successInfo.tableAssigned ? 'Tentative' : 'Pending'}</span></li>
          {/if}
        </ul>
        <div class="mt-3 text-green-200/80 text-sm">We’ll contact you to confirm as soon as possible.</div>
      </div>
      <div class="flex gap-3">
        <a href="/" class="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600">Return Home</a>
        <a href="/dashboard/reservations/form" class="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600">Make another reservation</a>
        {#if pb?.authStore?.isValid && ['manager','owner','general_manager'].includes((pb?.authStore?.model?.role || '').toLowerCase())}
          <button class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700" on:click={() => goto('/dashboard/reservations')}>Manager View</button>
        {/if}
      </div>
    {:else}
      {#if error}
        <div class="p-3 mb-4 rounded border border-red-700 bg-red-900/40 text-red-200 text-sm">{error}</div>
      {/if}

      <form class="space-y-4" on:submit|preventDefault={submitReservation}>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-gray-300 mb-1" for="reservation_date">Date</label>
            <input id="reservation_date" type="date" bind:value={form.reservation_date} min={getToday()} required class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white" />
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-1" for="start_time">Time</label>
            <input id="start_time" type="time" bind:value={form.start_time} required class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-gray-300 mb-1" for="party_size">Party Size</label>
            <input id="party_size" type="number" min="1" bind:value={form.party_size} required class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white" />
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-1" for="customer_name">Your Name</label>
            <input id="customer_name" type="text" bind:value={form.customer_name} required class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white" placeholder="Full name" />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-gray-300 mb-1" for="customer_phone">Phone (optional)</label>
            <input id="customer_phone" type="tel" bind:value={form.customer_phone} class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white" placeholder="(555) 123-4567" />
          </div>
          <div>
            <label class="block text-sm text-gray-300 mb-1" for="customer_email">Email (optional)</label>
            <input id="customer_email" type="email" bind:value={form.customer_email} class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white" placeholder="you@email.com" />
          </div>
        </div>

        <div>
          <label class="block text-sm text-gray-300 mb-1" for="notes">Notes (optional)</label>
          <textarea id="notes" rows="3" bind:value={form.notes} class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white" placeholder="Allergies, occasion, seating preference..."></textarea>
        </div>

        <div class="pt-2">
          <button type="submit" class="px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-60" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Reservation'}
          </button>
        </div>
      </form>
    {/if}
  </main>
</div>
