<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/auth.js';
  import { collections } from '$lib/stores/collections.js';

  let user = null;
  let currentTime = new Date();
  let timeInterval;
  let refreshInterval;
  let isDataLoaded = false;
  let barOrders = [];

  onMount(() => {
    let handled = false;
    const unsubscribe = authStore.subscribe(async (auth) => {
      if (auth.isLoading || handled) return;
      if (!auth.isLoggedIn) {
        handled = true;
        goto('/');
        return;
      }
      user = auth.user;
      try {
        await Promise.all([
          collections.getMenuItems(),
          collections.getTickets(),
          collections.getTicketItems()
        ]);
        await loadBarOrders();
        isDataLoaded = true;
      } catch (e) {
        console.error('Error loading bar display data:', e);
      }
    });

    timeInterval = setInterval(() => { currentTime = new Date(); }, 1000);
    refreshInterval = setInterval(() => { loadBarOrders(); }, 30000);
    return () => {
      unsubscribe();
    };
  });

  onDestroy(() => {
    if (timeInterval) clearInterval(timeInterval);
    if (refreshInterval) clearInterval(refreshInterval);
  });

  async function loadBarOrders() {
    try {
      const tickets = await collections.getTickets();
      const activeTickets = tickets.filter(t => t.status === 'sent_to_kitchen' || t.status === 'preparing');
      const allItems = await collections.getTicketItems();
      const relevant = allItems.filter(item =>
        activeTickets.some(t => t.id === item.ticket_id) &&
        item.kitchen_station === 'bar' &&
        (item.status === 'sent_to_bar' || item.status === 'preparing' || item.status === 'ready')
      );
      barOrders = relevant.map(addMeta).sort((a,b)=> a.remainingMinutes - b.remainingMinutes);
    } catch (e) {
      console.error('Failed to load bar orders:', e);
    }
  }

  function addMeta(item) {
    const orderedAt = new Date(item.ordered_at || item.created || Date.now());
    const elapsedMinutes = Math.floor((currentTime - orderedAt) / (1000*60));
    const est = item.expand?.menu_item_id?.preparation_time || 5;
    const remainingMinutes = Math.max(0, est - elapsedMinutes);
    return { ...item, elapsedMinutes, estimatedMinutes: est, remainingMinutes, isOverdue: elapsedMinutes > est };
  }

  async function markItemPreparing(item) {
    try {
      await collections.updateTicketItem(item.id, { status: 'preparing' });
      await loadBarOrders();
    } catch (e) {
      console.error('Failed to mark preparing:', e);
    }
  }

  async function markItemReady(item) {
    try {
      await collections.updateTicketItem(item.id, { status: 'ready', prepared_at: new Date().toISOString() });
      await loadBarOrders();
    } catch (e) {
      console.error('Failed to mark ready:', e);
    }
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100">
  {#if !user || !isDataLoaded}
    <div class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 class="text-xl font-semibold text-white mb-2">Loading Bar Display</h2>
        <p class="text-gray-400">Please wait while we load drink orders...</p>
      </div>
    </div>
  {:else}
    <header class="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-4">
          <div class="flex items-center space-x-4">
            <div class="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <span class="font-bold text-xl">🍹</span>
            </div>
            <div>
              <h1 class="text-2xl font-bold">Bar Display</h1>
              <p class="text-sm text-blue-400">Real-time drink orders</p>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <div class="text-lg font-mono">{currentTime.toLocaleTimeString('en-US', { hour12: false })}</div>
            <button on:click={() => history.back()} class="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded">← Back</button>
          </div>
        </div>
      </div>
    </header>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">Bar Orders ({barOrders.length})</h2>
        <button on:click={loadBarOrders} class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm">🔄 Refresh</button>
      </div>

      {#if barOrders.length === 0}
        <div class="text-center py-12 text-gray-400">
          <div class="text-6xl mb-4">🍹</div>
          <h3 class="text-xl font-semibold mb-2">No Pending Drinks</h3>
          <p>All drink orders are complete.</p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each barOrders as item}
            <div class="p-4 bg-blue-900/30 border-2 border-blue-700 rounded-lg">
              <div class="flex justify-between items-start mb-2">
                <div>
                  <div class="font-bold text-lg">{item.quantity}x {item.expand?.menu_item_id?.name || item.expand?.menu_item_id?.name_field || 'Drink'}</div>
                  <div class="text-sm text-gray-300">Ticket #{item.expand?.ticket_id?.ticket_number || item.ticket_id} | Table {item.expand?.ticket_id?.table_id || '—'}</div>
                </div>
                <div class="text-right">
                  <div class="text-2xl font-bold {item.isOverdue ? 'text-red-400' : 'text-blue-400'}">{item.remainingMinutes}m</div>
                  <div class="text-xs text-gray-400">{item.elapsedMinutes}m elapsed</div>
                </div>
              </div>
              {#if item.modifications}
                <div class="text-sm text-yellow-300 mb-2"><strong>Mods:</strong> {item.modifications}</div>
              {/if}
              {#if item.special_instructions}
                <div class="text-sm text-orange-300 mb-3"><strong>Special:</strong> {item.special_instructions}</div>
              {/if}
              <div class="flex space-x-2">
                {#if item.status === 'sent_to_bar'}
                  <button on:click={() => markItemPreparing(item)} class="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-medium">▶️ Start Making</button>
                {/if}
                <button on:click={() => markItemReady(item)} class="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium">✅ Ready for Pickup</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
