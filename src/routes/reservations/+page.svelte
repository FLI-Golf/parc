<script lang="ts">
  import { collections, loading } from '$lib/stores/collections.js';
  import { onMount } from 'svelte';
  let reservation_date = new Date().toISOString().slice(0,10);
  let start_time = '18:00';
  let party_size: number = 2;
  let customer_name = '';
  let customer_phone = '';
  let customer_email = '';
  let notes = '';
  let submitting = false;
  let successId: string | null = null;
  let errorMsg: string | null = null;

  async function submit() {
    errorMsg = null;
    successId = null;
    if (!reservation_date || !start_time || !party_size || !customer_name) {
      errorMsg = 'Please fill date, time, party size, and name.';
      return;
    }
    submitting = true;
    try {
      const record = await collections.createReservation({
        reservation_date,
        start_time,
        party_size,
        customer_name,
        customer_phone,
        customer_email,
        notes,
        source: 'web',
        status: 'booked'
      });
      successId = record.id;
      // Reset most fields except contact for fast repeat
      party_size = 2;
      customer_name = '';
      notes = '';
    } catch (e: any) {
      try { errorMsg = e?.data?.message || e?.message || 'Failed to create reservation'; } catch { errorMsg = 'Failed to create reservation'; }
    } finally {
      submitting = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 py-12 px-4">
  <div class="w-full max-w-xl bg-gray-900/70 backdrop-blur rounded-lg border border-gray-700 p-6 shadow-xl">
    <h1 class="text-2xl font-semibold text-white mb-4">Make a Reservation</h1>
    <p class="text-gray-300 mb-6">Book a table. You’ll receive confirmation from our staff if any changes are needed.</p>

    {#if errorMsg}
      <div class="mb-4 rounded border border-red-600 text-red-200 bg-red-900/30 px-3 py-2">{errorMsg}</div>
    {/if}
    {#if successId}
      <div class="mb-4 rounded border border-green-600 text-green-200 bg-green-900/30 px-3 py-2">Reservation submitted. Confirmation ID: {successId}</div>
    {/if}

    <form class="grid grid-cols-1 gap-4" on:submit|preventDefault={submit}>
      <div class="grid grid-cols-2 gap-4">
        <label class="flex flex-col gap-1">
          <span class="text-gray-200 text-sm">Date</span>
          <input type="date" bind:value={reservation_date} class="bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600" required />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-gray-200 text-sm">Time</span>
          <input type="time" bind:value={start_time} class="bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600" required />
        </label>
      </div>

      <label class="flex flex-col gap-1">
        <span class="text-gray-200 text-sm">Party size</span>
        <input type="number" min="1" max="20" bind:value={party_size} class="bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600" required />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-gray-200 text-sm">Name</span>
        <input type="text" bind:value={customer_name} class="bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600" required />
      </label>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="flex flex-col gap-1">
          <span class="text-gray-200 text-sm">Phone</span>
          <input type="tel" bind:value={customer_phone} class="bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-gray-200 text-sm">Email</span>
          <input type="email" bind:value={customer_email} class="bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600" />
        </label>
      </div>

      <label class="flex flex-col gap-1">
        <span class="text-gray-200 text-sm">Notes (optional)</span>
        <textarea rows="3" bind:value={notes} class="bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"></textarea>
      </label>

      <button type="submit" class="mt-2 inline-flex items-center justify-center px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50" disabled={submitting}>
        {#if submitting}Submitting...{/if}
        {#if !submitting}Submit{/if}
      </button>
    </form>
  </div>
</div>
