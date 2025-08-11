<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/auth.js';
  import { collections, spoils, ticketItems, tickets, menuItems, loading } from '$lib/stores/collections.js';
  // We use speech recognition for text entry; no file upload is sent

  let user = null;
  let hasHandledAuth = false;
  let showNewSpoil = false;
  let creatingFor = null; // optional ticketItemId
  let voiceData = null; // { blob, duration, transcript }
  let step = 1;
  let form = {
    source: 'bar',
    spoil_type: 'returned',
    quantity: 1,
    occurred_at: '',
    reason_text: ''
  };
  let attachAudio = true;
  let selectedTicketItemId = '';
  function selectTicketItem(id) {
    selectedTicketItemId = id;
    const found = ($ticketItems || []).find(ti => ti.id === id);
    if (found) creatingFor = found;
  }

  let filterStatus = 'open';
  let filterSource = 'all';

  onMount(async () => {
    const unsub = authStore.subscribe(async (auth) => {
      if (auth.isLoading || hasHandledAuth) return;
      if (!auth.isLoggedIn) { hasHandledAuth = true; goto('/'); return; }
      const role = (auth.role || '').toLowerCase();
      if (!(role === 'manager' || role === 'owner')) { hasHandledAuth = true; goto('/dashboard'); return; }
      hasHandledAuth = true;
      user = auth.user;
      try {
        await Promise.all([
          collections.getSpoils(),
          collections.getTicketItems().catch(()=>{}),
          collections.getTickets().catch(()=>{}),
          collections.getMenuItems().catch(()=>{})
        ]);
        initSpeech();
      } catch (e) { console.error('Failed to load spoils:', e); }
    });
    return unsub;
  });

  // Speech recognition for quick entry
  let recognition = null;
  let speechSupported = false;
  let isRecordingSearch = false;
  let isRecordingReason = false;
  let searchQuery = '';

  function initSpeech() {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      try {
        recognition = new SR();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onresult = (e) => {
          const transcript = e.results?.[0]?.[0]?.transcript || '';
          if (isRecordingSearch) searchQuery = transcript;
          if (isRecordingReason) form.reason_text = (form.reason_text + ' ' + transcript).trim();
          isRecordingSearch = false;
          isRecordingReason = false;
        };
        recognition.onerror = () => {
          isRecordingSearch = false;
          isRecordingReason = false;
        };
        recognition.onend = () => {
          isRecordingSearch = false;
          isRecordingReason = false;
        };
        speechSupported = true;
      } catch {}
    }
  }
  function toggleSearchMic() {
    if (!recognition) return;
    if (isRecordingSearch) { try { recognition.stop(); } catch {} isRecordingSearch = false; return; }
    isRecordingSearch = true; isRecordingReason = false;
    try { recognition.start(); } catch {}
  }
  function toggleReasonMic() {
    if (!recognition) return;
    if (isRecordingReason) { try { recognition.stop(); } catch {} isRecordingReason = false; return; }
    isRecordingReason = true; isRecordingSearch = false;
    try { recognition.start(); } catch {}
  }

  $: filteredSpoils = $spoils.filter(s => {
    const statusMatch = filterStatus === 'all' ? true : s.status === filterStatus;
    const sourceMatch = filterSource === 'all' ? true : s.source === filterSource;
    return statusMatch && sourceMatch;
  });

  function openNewSpoil(ticketItem = null) {
    creatingFor = ticketItem;
    voiceData = null;
    step = 1;
    form = { source: 'bar', spoil_type: 'returned', quantity: ticketItem?.quantity || 1, occurred_at: new Date().toISOString().slice(0,16), reason_text: '' };
    showNewSpoil = true;
  }
  function closeNewSpoil() {
    showNewSpoil = false;
    creatingFor = null;
    voiceData = null;
    step = 1;
  }
  const supportedAudioTypes = ['audio/webm','audio/ogg','audio/mpeg','audio/wav'];
  let audioError = '';
  function onVoiceSave(e) {
    voiceData = e.detail;
    audioError = '';
    if (voiceData?.blob && voiceData.blob.type && !supportedAudioTypes.includes(voiceData.blob.type)) {
      audioError = `Unsupported audio format: ${voiceData.blob.type}. Supported: ${supportedAudioTypes.join(', ')}`;
      attachAudio = false; // disable attachment to avoid PB validation errors
    }
    form.reason_text = form.reason_text || voiceData?.transcript || '';
  }
  function onVoiceCancel() {
    voiceData = null;
  }

  async function submitSpoil() {
    try {
      const payload = {
        ticketItemId: creatingFor?.id,
        ticketId: creatingFor?.ticket_id,
        menuItemId: creatingFor?.menu_item_id,
        userId: user?.id,
        staffId: null,
        quantity: Number(form.quantity) || 1,
        spoilType: form.spoil_type,
        source: form.source,
        status: 'open',
        reasonText: form.reason_text || voiceData?.transcript || '',
        costEstimate: null,
        occurredAt: form.occurred_at ? form.occurred_at : null,
        metadata: voiceData ? { duration: voiceData?.duration, mime: voiceData?.blob?.type || 'audio/webm' } : null,
        audioBlob: attachAudio ? (voiceData?.blob || null) : null
      };
      console.log('🧪 Spoils payload:', payload);
      await collections.createSpoil(payload);
      await collections.getSpoils();
      closeNewSpoil();
    } catch (e) {
      console.error('Failed to submit spoil:', e?.data || e);
      const msg = e?.data ? (e.data.attachments?.message || e.data.message || 'Failed to submit spoil') : 'Failed to submit spoil';
      alert(msg);
    }
  }

  async function setStatus(spoil, status) {
    try {
      await collections.updateSpoil(spoil.id, { status });
      await collections.getSpoils();
    } catch (e) {
      console.error('Failed to update spoil status:', e);
    }
  }

  async function saveCost(spoil, value) {
    const num = value === '' ? null : Number(value);
    try {
      await collections.updateSpoil(spoil.id, { cost_estimate: num });
    } catch (e) {
      console.error('Failed to save cost estimate:', e);
    }
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100">
  <header class="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-red-600/80 flex items-center justify-center">📉</div>
          <div>
            <h1 class="text-2xl font-bold">Spoils & Incidents</h1>
            <p class="text-sm text-red-300">Report, review and approval workflow</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button on:click={() => history.back()} class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">← Back</button>
        </div>
      </div>
    </div>
  </header>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-4">
      <select bind:value={filterStatus} class="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
        <option value="open">Open</option>
        <option value="reviewed">Reviewed</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="all">All</option>
      </select>
      <select bind:value={filterSource} class="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
        <option value="all">All Sources</option>
        <option value="bar">Bar</option>
        <option value="kitchen">Kitchen</option>
        <option value="server">Server</option>
        <option value="guest">Guest</option>
      </select>
      <button on:click={() => openNewSpoil()} class="ml-auto px-3 py-2 bg-teal-600 hover:bg-teal-700 rounded text-sm">+ New Spoil</button>
    </div>

    {#if $loading.spoils}
      <div class="flex justify-center items-center h-40">
        <div class="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    {:else}
      {#if filteredSpoils.length === 0}
        <div class="text-center text-gray-400 py-12">No spoils found.</div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each filteredSpoils as s}
            <div class="p-4 bg-gray-800/60 border border-gray-700 rounded-lg">
              <div class="flex justify-between items-start">
                <div>
                  <div class="text-sm text-gray-300">{s.spoil_type} • {s.source}</div>
                  <div class="text-lg font-semibold text-white">{s.expand?.menu_item_id?.name || s.expand?.menu_item_id?.name_field || 'Item'}</div>
                  <div class="text-xs text-gray-400">Qty {s.quantity_field} • Ticket #{s.expand?.ticket_id?.ticket_number || s.ticket_id}</div>
                </div>
                <span class="text-xs px-2 py-1 rounded-full border {s.status === 'open' ? 'text-yellow-300 border-yellow-600' : s.status === 'reviewed' ? 'text-blue-300 border-blue-600' : s.status === 'approved' ? 'text-green-300 border-green-600' : 'text-red-300 border-red-600'}">{s.status}</span>
              </div>
              {#if s.reason_text}
                <div class="mt-2 text-sm text-gray-300">Reason: {s.reason_text}</div>
              {/if}
              {#if s.attachments?.length}
                <div class="mt-2 text-sm text-gray-400">Attachment: <a target="_blank" href={s.attachments} class="text-blue-400 underline">Download</a></div>
              {/if}
              <div class="mt-3 flex items-center gap-2">
                <input type="number" min="0" step="0.01" placeholder="Cost $" value={s.cost_estimate || ''} on:change={(e)=>saveCost(s, e.target.value)} class="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm" />
                <button on:click={()=>setStatus(s,'reviewed')} class="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs">Mark Reviewed</button>
                <button on:click={()=>setStatus(s,'approved')} class="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs">Approve</button>
                <button on:click={()=>setStatus(s,'rejected')} class="px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs">Reject</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  {#if showNewSpoil}
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-gray-900 border border-gray-700 rounded-xl p-4 w-full max-w-xl">
        <h3 class="text-xl font-semibold text-white mb-2">New Spoil Report</h3>

        <!-- Stepper -->
        <div class="flex items-center gap-2 text-xs text-gray-300 mb-3">
          <span class={step >= 1 ? 'text-white font-semibold' : 'text-gray-400'}>1. Details</span>
          <span>›</span>
          <span class={step >= 2 ? 'text-white font-semibold' : 'text-gray-400'}>2. Reason</span>
          <span>›</span>
          <span class={step >= 3 ? 'text-white font-semibold' : 'text-gray-400'}>3. Review</span>
        </div>

        {#if step === 1}
          <!-- Details -->
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-gray-400 mb-1">Source</label>
                <select bind:value={form.source} class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm">
                  <option value="bar">Bar</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="server">Server</option>
                  <option value="guest">Guest</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1">Type</label>
                <select bind:value={form.spoil_type} class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm">
                  <option value="returned">Returned</option>
                  <option value="remade">Remade</option>
                  <option value="wasted">Wasted</option>
                  <option value="expired">Expired</option>
                  <option value="overpour">Overpour</option>
                  <option value="breakage">Breakage</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-gray-400 mb-1">Quantity</label>
                <input type="number" min="1" bind:value={form.quantity} class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm" />
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1">Occurred At</label>
                <input type="datetime-local" bind:value={form.occurred_at} class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm" />
              </div>
            </div>
            {#if creatingFor}
              <div class="text-xs text-gray-300">Item: {creatingFor.expand?.menu_item_id?.name || creatingFor.expand?.menu_item_id?.name_field} • Ticket #{creatingFor.expand?.ticket_id?.ticket_number}</div>
            {:else}
              <div>
                <label class="block text-xs text-gray-400 mb-1">Select Item</label>
                <div class="relative">
                  <input type="text" bind:value={searchQuery} placeholder="Search items..." class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 pr-10 text-sm" />
                  {#if speechSupported}
                    <button type="button" on:click={toggleSearchMic} class="absolute right-1 top-1.5 px-2 py-1 rounded {isRecordingSearch ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}" title={isRecordingSearch ? 'Stop' : 'Voice search'} aria-label="Voice search">
                      {#if isRecordingSearch}
                        🔴
                      {:else}
                        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 2a2 2 0 00-2 2v6a2 2 0 104 0V4a2 2 0 00-2-2zm-5 8a5 5 0 0010 0h2a7 7 0 01-6 6.92V18h3a1 1 0 110 2H6a1 1 0 110-2h3v-1.08A7 7 0 013 10h2z" clip-rule="evenodd"></path></svg>
                      {/if}
                    </button>
                  {/if}
                </div>
                <select bind:value={selectedTicketItemId} on:change={(e)=>selectTicketItem(e.target.value)} class="mt-2 w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm">
                  <option value="">-- Choose a ticket item --</option>
                  {#each ($ticketItems || []).filter(ti => {
                    const name = (ti.expand?.menu_item_id?.name || ti.expand?.menu_item_id?.name_field || '').toLowerCase();
                    return !searchQuery || name.includes(searchQuery.toLowerCase());
                  }).slice().sort((a,b)=> (b.updated||'').localeCompare(a.updated||'')) as ti}
                    <option value={ti.id}>
                      {(ti.expand?.menu_item_id?.name || ti.expand?.menu_item_id?.name_field || 'Item')} • Ticket #{ti.expand?.ticket_id?.ticket_number || ti.ticket_id}
                    </option>
                  {/each}
                </select>
              </div>
            {/if}
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button on:click={closeNewSpoil} class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded">Cancel</button>
            <button on:click={() => step = 2} class="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded" disabled={!creatingFor}>Next</button>
          </div>
        {:else if step === 2}
          <!-- Reason (voice or text) -->
          <div class="space-y-3">
            <div>
              <label class="block text-xs text-gray-400 mb-1">Reason (optional)</label>
              <textarea rows="3" bind:value={form.reason_text} class="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm" placeholder="Describe what happened"></textarea>
            </div>
            <div class="flex items-center justify-between">
              <p class="text-xs text-gray-400">Use the mic to dictate the reason:</p>
              {#if speechSupported}
                <button type="button" on:click={toggleReasonMic} class="px-2 py-1 rounded {isRecordingReason ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}" title={isRecordingReason ? 'Stop' : 'Start recording'} aria-label="Dictate reason">
                  {#if isRecordingReason}
                    🔴
                  {:else}
                    <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 2a2 2 0 00-2 2v6a2 2 0 104 0V4a2 2 0 00-2-2zm-5 8a5 5 0 0010 0h2a7 7 0 01-6 6.92V18h3a1 1 0 110 2H6a1 1 0 110-2h3v-1.08A7 7 0 013 10h2z" clip-rule="evenodd"></path></svg>
                  {/if}
                </button>
              {/if}
            </div>
          </div>
          <div class="mt-4 flex justify-between gap-2">
            <button on:click={() => step = 1} class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded">Back</button>
            <button on:click={() => step = 3} class="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded">Next</button>
          </div>
        {:else}
          <!-- Review -->
          <div class="space-y-2 text-sm text-gray-200">
            <!-- High-level -->
            <div class="grid grid-cols-2 gap-2">
              <div><span class="text-gray-400">Source:</span> {form.source}</div>
              <div><span class="text-gray-400">Type:</span> {form.spoil_type}</div>
              <div><span class="text-gray-400">Quantity:</span> {form.quantity}</div>
              <div><span class="text-gray-400">Occurred:</span> {form.occurred_at || '—'}</div>
            </div>
            <div>
              <span class="text-gray-400">Item:</span>
              {#if creatingFor}
                {(creatingFor.expand?.menu_item_id?.name || creatingFor.expand?.menu_item_id?.name_field)} (Ticket #{creatingFor.expand?.ticket_id?.ticket_number})
              {:else}
                <span class="text-red-400">Required</span>
              {/if}
            </div>
            <div><span class="text-gray-400">Reason:</span> {form.reason_text || '—'}</div>
            <div><span class="text-gray-400">Audio:</span> {attachAudio && voiceData ? `Attached (${voiceData.duration || 0}s, ${voiceData?.blob?.type || 'audio'})` : 'Not attached'}</div>

            <!-- Low-level (what will be sent) -->
            <div class="mt-3 p-2 bg-gray-800 border border-gray-700 rounded">
              <div class="text-xs text-gray-400 mb-1">Request preview</div>
              <div class="text-xs grid grid-cols-2 gap-x-3 gap-y-1">
                <div><span class="text-gray-500">ticket_item_id:</span> {creatingFor?.id || '—'}</div>
                <div><span class="text-gray-500">ticket_id:</span> {creatingFor?.ticket_id || '—'}</div>
                <div><span class="text-gray-500">menu_item_id:</span> {creatingFor?.menu_item_id || '—'}</div>
                <div><span class="text-gray-500">user_id:</span> {user?.id || '—'}</div>
                <div><span class="text-gray-500">quantity_field:</span> {Number(form.quantity) || 1}</div>
                <div><span class="text-gray-500">spoil_type:</span> {form.spoil_type}</div>
                <div><span class="text-gray-500">source:</span> {form.source}</div>
                <div><span class="text-gray-500">status:</span> open</div>
                <div class="col-span-2"><span class="text-gray-500">occurred_at:</span> {form.occurred_at ? new Date(form.occurred_at).toISOString() : '—'}</div>
                <div class="col-span-2"><span class="text-gray-500">reason_text:</span> {form.reason_text || '—'}</div>
                <div class="col-span-2"><span class="text-gray-500">attachments:</span> {attachAudio && voiceData ? `{File: spoil-reason.webm, type=${voiceData?.blob?.type || 'audio/webm'}, size=${voiceData?.blob?.size || 0}}` : '—'}</div>
              </div>
            </div>

            <!-- Validation hints -->
            <div class="text-xs text-yellow-300 mt-2">
              Required: Item, Type, Source, Quantity, User. {#if !creatingFor || !user?.id}<span class="text-red-400">Missing required field(s).</span>{/if}
            </div>
          </div>
          <div class="mt-4 flex justify-between gap-2">
            <button on:click={() => step = 2} class="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded">Back</button>
            <button on:click={submitSpoil} class="px-3 py-2 bg-teal-600 hover:bg-teal-700 rounded" disabled={!creatingFor || !user?.id}>Submit</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
