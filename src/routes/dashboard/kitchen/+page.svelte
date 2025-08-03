<script>
	import { onMount, onDestroy } from 'svelte';
	import { authStore } from '$lib/auth.js';
	import { collections, loading } from '$lib/stores/collections.js';
	import { goto } from '$app/navigation';

	let user = null;
	let timeInterval;
	let currentTime = new Date();
	let kitchenOrders = [];
	let barOrders = [];
	let refreshInterval;

	// Estimated cooking times by station (in minutes)
	const estimatedTimes = {
		'kitchen': 12,
		'grill': 15,
		'cold_station': 8,
		'fryer': 10,
		'bar': 5
	};

	// Auto-refresh every 30 seconds
	onMount(() => {
		const unsubscribe = authStore.subscribe(async (auth) => {
			user = auth.user;
			if (!auth.isLoggedIn && !auth.isLoading) {
				goto('/');
				return;
			}
			
			// Load initial data
			if (auth.isLoggedIn) {
				await collections.getMenuItems(); // Load menu items for preparation times
				await loadKitchenOrders();
			}
		});

		// Update time every second
		timeInterval = setInterval(() => {
			currentTime = new Date();
		}, 1000);

		// Refresh orders every 30 seconds
		refreshInterval = setInterval(() => {
			loadKitchenOrders();
		}, 30000);

		return unsubscribe;
	});

	onDestroy(() => {
		if (timeInterval) clearInterval(timeInterval);
		if (refreshInterval) clearInterval(refreshInterval);
	});

	// Load orders that are sent to kitchen but not yet ready
	async function loadKitchenOrders() {
		try {
			// Get tickets that are sent to kitchen
			const tickets = await collections.getTickets();
			const activeTickets = tickets.filter(ticket => 
				ticket.status === 'sent_to_kitchen' || ticket.status === 'preparing'
			);

			// Get all ticket items for active tickets
			const allTicketItems = await collections.getTicketItems();
			
			// Filter items that are in kitchen stations
			const activeItems = allTicketItems.filter(item => 
				activeTickets.some(ticket => ticket.id === item.ticket_id) &&
				(item.status === 'sent_to_kitchen' || item.status === 'preparing') &&
				item.kitchen_station
			);

			// Separate by station
			kitchenOrders = activeItems.filter(item => 
				item.kitchen_station !== 'bar'
			);
			
			barOrders = activeItems.filter(item => 
				item.kitchen_station === 'bar'
			);

			// Add metadata to items
			kitchenOrders = kitchenOrders.map(addOrderMetadata);
			barOrders = barOrders.map(addOrderMetadata);

		} catch (error) {
			console.error('Error loading kitchen orders:', error);
		}
	}

	// Add metadata like elapsed time, estimated ready time
	function addOrderMetadata(item) {
		const orderedAt = new Date(item.ordered_at);
		const elapsedMinutes = Math.floor((currentTime - orderedAt) / (1000 * 60));
		
		// Use item's preparation time if available, otherwise fallback to station defaults
		const menuItem = item.expand?.menu_item_id;
		const estimatedMinutes = menuItem?.preparation_time || estimatedTimes[item.kitchen_station] || 12;
		const remainingMinutes = Math.max(0, estimatedMinutes - elapsedMinutes);
		
		return {
			...item,
			elapsedMinutes,
			estimatedMinutes,
			remainingMinutes,
			isOverdue: elapsedMinutes > estimatedMinutes,
			urgencyLevel: getUrgencyLevel(elapsedMinutes, estimatedMinutes)
		};
	}

	// Determine urgency level for visual indicators
	function getUrgencyLevel(elapsed, estimated) {
		const ratio = elapsed / estimated;
		if (ratio >= 1.2) return 'critical'; // 20% overdue
		if (ratio >= 1.0) return 'overdue';
		if (ratio >= 0.8) return 'urgent'; // 80% of time elapsed
		return 'normal';
	}

	// Mark item as ready
	async function markItemReady(item) {
		try {
			await collections.updateTicketItem(item.id, {
				status: 'ready',
				prepared_at: new Date().toISOString()
			});
			await loadKitchenOrders();
		} catch (error) {
			console.error('Error marking item ready:', error);
		}
	}

	// Mark item as preparing (started cooking)
	async function markItemPreparing(item) {
		try {
			await collections.updateTicketItem(item.id, {
				status: 'preparing'
			});
			await loadKitchenOrders();
		} catch (error) {
			console.error('Error marking item preparing:', error);
		}
	}

	// Get station display name
	function getStationName(station) {
		const names = {
			'kitchen': 'Kitchen',
			'grill': 'Grill',
			'cold_station': 'Cold Station',
			'fryer': 'Fryer',
			'bar': 'Bar'
		};
		return names[station] || station;
	}

	// Get urgency color classes
	function getUrgencyColors(urgency) {
		const colors = {
			'normal': 'bg-gray-700 border-gray-600',
			'urgent': 'bg-yellow-800 border-yellow-600',
			'overdue': 'bg-orange-800 border-orange-600',
			'critical': 'bg-red-800 border-red-600 animate-pulse'
		};
		return colors[urgency] || colors.normal;
	}

	async function logout() {
		const { auth } = await import('$lib/auth.js');
		await auth.signOut();
		goto('/');
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100">
	<!-- Header -->
	<header class="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center py-4">
				<div class="flex items-center space-x-4">
					<div class="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center">
						<span class="font-bold text-xl">🍳</span>
					</div>
					<div>
						<h1 class="text-2xl font-bold">Kitchen Display System</h1>
						<p class="text-sm text-orange-400">Real-time Order Tracking</p>
					</div>
				</div>
				<div class="flex items-center space-x-4">
					<div class="text-lg font-mono">
						{currentTime.toLocaleTimeString('en-US', { hour12: false })}
					</div>
					{#if user}
						<div class="flex items-center space-x-2">
							<div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
								<span class="font-medium text-sm">{user.name?.charAt(0) || user.email?.charAt(0) || 'K'}</span>
							</div>
							<button 
								on:click={logout}
								class="text-sm px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white"
							>
								Logout
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
		<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
			
			<!-- Kitchen Orders -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h2 class="text-xl font-bold">Kitchen Orders ({kitchenOrders.length})</h2>
					<button 
						on:click={loadKitchenOrders}
						class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
					>
						🔄 Refresh
					</button>
				</div>

				{#if kitchenOrders.length === 0}
					<div class="text-center py-8 text-gray-400">
						<div class="text-4xl mb-2">✨</div>
						<p>All caught up! No pending kitchen orders.</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each kitchenOrders as item}
							<div class="p-4 rounded-lg border-2 {getUrgencyColors(item.urgencyLevel)}">
								<div class="flex justify-between items-start mb-2">
									<div>
										<div class="font-bold text-lg">
										{item.quantity}x {item.expand?.menu_item_id?.name || item.name}
										</div>
										<div class="text-sm text-gray-300">
											Ticket #{item.ticket_number} | Table {item.table_id} | {getStationName(item.kitchen_station)}
										</div>
										{#if item.seat_number}
											<div class="text-sm text-blue-300">
												Seat {item.seat_number} {item.seat_name ? `(${item.seat_name})` : ''}
											</div>
										{/if}
									</div>
									<div class="text-right">
										<div class="text-2xl font-bold {item.isOverdue ? 'text-red-400' : 'text-green-400'}">
											{item.remainingMinutes}m
										</div>
										<div class="text-xs text-gray-400">
											{item.elapsedMinutes}m elapsed
										</div>
									</div>
								</div>

								{#if item.modifications}
									<div class="text-sm text-yellow-300 mb-2">
										<strong>Mods:</strong> {item.modifications}
									</div>
								{/if}

								{#if item.special_instructions}
									<div class="text-sm text-orange-300 mb-3">
										<strong>Special:</strong> {item.special_instructions}
									</div>
								{/if}

								<div class="flex space-x-2">
									{#if item.status === 'sent_to_kitchen'}
										<button
											on:click={() => markItemPreparing(item)}
											class="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-medium"
										>
											▶️ Start Preparing
										</button>
									{/if}
									<button
										on:click={() => markItemReady(item)}
										class="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium"
									>
										✅ Mark Ready
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Bar Orders -->
			<div class="space-y-4">
				<h2 class="text-xl font-bold">Bar Orders ({barOrders.length})</h2>

				{#if barOrders.length === 0}
					<div class="text-center py-8 text-gray-400">
						<div class="text-4xl mb-2">🍹</div>
						<p>No pending drink orders.</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each barOrders as item}
							<div class="p-4 bg-blue-900/30 border-2 border-blue-700 rounded-lg">
								<div class="flex justify-between items-start mb-2">
									<div>
										<div class="font-bold text-lg">
											{item.quantity}x {item.expand?.menu_item_id?.name || item.name}
										</div>
										<div class="text-sm text-gray-300">
											Ticket #{item.ticket_number} | Table {item.table_id}
										</div>
										{#if item.seat_number}
											<div class="text-sm text-blue-300">
												Seat {item.seat_number} {item.seat_name ? `(${item.seat_name})` : ''}
											</div>
										{/if}
									</div>
									<div class="text-right">
										<div class="text-2xl font-bold text-blue-400">
											{item.remainingMinutes}m
										</div>
										<div class="text-xs text-gray-400">
											{item.elapsedMinutes}m elapsed
										</div>
									</div>
								</div>

								{#if item.modifications}
									<div class="text-sm text-yellow-300 mb-2">
										<strong>Mods:</strong> {item.modifications}
									</div>
								{/if}

								{#if item.special_instructions}
									<div class="text-sm text-orange-300 mb-3">
										<strong>Special:</strong> {item.special_instructions}
									</div>
								{/if}

								<div class="flex space-x-2">
									{#if item.status === 'sent_to_kitchen'}
										<button
											on:click={() => markItemPreparing(item)}
											class="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-medium"
										>
											▶️ Start Making
										</button>
									{/if}
									<button
										on:click={() => markItemReady(item)}
										class="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium"
									>
										✅ Ready for Pickup
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
