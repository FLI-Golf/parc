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
	let activeView = 'overview'; // 'overview' or 'tables'
	let selectedTable = null;
	let tableGroups = [];
	let isDataLoaded = false;

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
		// Track if we've already handled this auth state to prevent loops
		let hasHandledAuth = false;
		
		const unsubscribe = authStore.subscribe(async (auth) => {
			console.log('🔐 Kitchen Auth State:', { isLoading: auth.isLoading, isLoggedIn: auth.isLoggedIn, role: auth.role, hasHandledAuth });
			
			// Wait for auth to finish loading
			if (auth.isLoading) {
				console.log('⏳ Auth still loading...');
				return;
			}
			
			// Prevent infinite loops
			if (hasHandledAuth) {
				return;
			}
			
			// Redirect if not logged in
			if (!auth.isLoggedIn) {
				console.log('❌ Not logged in, redirecting...');
				hasHandledAuth = true;
				goto('/');
				return;
			}
			
			// Set user and load data only when auth is ready
			if (auth.isLoggedIn && auth.user) {
				console.log('✅ Kitchen dashboard access granted for:', auth.user.email);
				hasHandledAuth = true;
				user = auth.user;
				
				try {
					await collections.getMenuItems(); // Load menu items for preparation times
					await loadKitchenOrders();
					isDataLoaded = true;
					console.log('📊 Kitchen data loaded successfully');
				} catch (error) {
					console.error('❌ Error loading kitchen data:', error);
				}
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
			
			// Compute active items per station with new status 'sent_to_bar'
			const isActiveTicket = (item) => activeTickets.some(ticket => ticket.id === item.ticket_id);
			const kitchenActive = allTicketItems.filter(item =>
				isActiveTicket(item) &&
				item.kitchen_station && item.kitchen_station !== 'bar' &&
				(item.status === 'sent_to_kitchen' || item.status === 'preparing')
			);
			const barActive = allTicketItems.filter(item =>
				isActiveTicket(item) &&
				item.kitchen_station === 'bar' &&
				(item.status === 'sent_to_bar' || item.status === 'preparing')
			);

			// Filter by user role
			const userRole = user?.role?.toLowerCase();
			
			if (userRole === 'bartender') {
				// Bartenders only see bar orders
				kitchenOrders = [];
				barOrders = barActive;
			} else if (userRole === 'kitchen_prep' || userRole === 'dishwasher') {
				// Kitchen prep and dishwashers only see kitchen orders (no bar)
				kitchenOrders = kitchenActive;
				barOrders = [];
			} else {
				// Chefs and managers see everything (separated)
				kitchenOrders = kitchenActive;
				barOrders = barActive;
			}

			// Add metadata to items
			kitchenOrders = kitchenOrders.map(addOrderMetadata);
			barOrders = barOrders.map(addOrderMetadata);

			// Group orders by table for table view (only include relevant orders for this user)
			const allRelevantOrders = [...kitchenOrders, ...barOrders];
			groupOrdersByTable(allRelevantOrders);

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

	// Group orders by table
	function groupOrdersByTable(allOrders) {
		const grouped = {};
		
		allOrders.forEach(item => {
			const tableId = item.expand?.ticket_id?.table_id || item.table_id || 'Unknown';
			if (!grouped[tableId]) {
				grouped[tableId] = {
					tableId,
					ticketNumber: item.expand?.ticket_id?.ticket_number || item.ticket_number,
					items: [],
					totalItems: 0,
					urgentItems: 0,
					overdueItems: 0
				};
			}
			
			grouped[tableId].items.push(item);
			grouped[tableId].totalItems++;
			
			if (item.urgencyLevel === 'urgent' || item.urgencyLevel === 'overdue') {
				grouped[tableId].urgentItems++;
			}
			if (item.urgencyLevel === 'overdue' || item.urgencyLevel === 'critical') {
				grouped[tableId].overdueItems++;
			}
		});
		
		tableGroups = Object.values(grouped).sort((a, b) => b.overdueItems - a.overdueItems || b.urgentItems - a.urgentItems);
	}

	// Get table status color
	function getTableStatusColor(table) {
		if (table.overdueItems > 0) return 'bg-red-600';
		if (table.urgentItems > 0) return 'bg-orange-600';
		return 'bg-green-600';
	}

	async function logout() {
		const { auth } = await import('$lib/auth.js');
		await auth.logout();
		goto('/');
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100">
	
	<!-- Loading Screen -->
	{#if !user || !isDataLoaded}
		<div class="min-h-screen flex items-center justify-center">
			<div class="text-center">
				<div class="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
				<h2 class="text-xl font-semibold text-white mb-2">Loading Kitchen Dashboard</h2>
				<p class="text-gray-400">Please wait while we load your orders...</p>
			</div>
		</div>
	{:else}
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
								on:click={() => window.history.back()}
								class="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white flex items-center gap-1"
							>
								← Back
							</button>
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
		<!-- Tab Navigation -->
		<div class="mb-6 border-b border-gray-700">
			<nav class="flex space-x-8">
				<button
					on:click={() => activeView = 'overview'}
					class="py-2 px-1 border-b-2 font-medium text-sm transition-colors {
						activeView === 'overview' 
							? 'border-orange-500 text-orange-400' 
							: 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
					}"
				>
					📊 Station Overview
				</button>
				<button
					on:click={() => activeView = 'tables'}
					class="py-2 px-1 border-b-2 font-medium text-sm transition-colors {
						activeView === 'tables' 
							? 'border-orange-500 text-orange-400' 
							: 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
					}"
				>
					🍽️ By Table ({tableGroups.length})
				</button>
			</nav>
		</div>

		{#if activeView === 'overview'}
			<!-- Station-Based View (Original) -->
			<div class="grid grid-cols-1 {(user?.role?.toLowerCase() === 'bartender' || user?.role?.toLowerCase() === 'chef') ? 'xl:grid-cols-2' : ''} gap-6">
			
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

			<!-- Bar Orders (only show for bartenders and chefs) -->
			{#if user?.role?.toLowerCase() === 'bartender' || user?.role?.toLowerCase() === 'chef'}
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
			{/if}
			</div>
		{:else if activeView === 'tables'}
			<!-- Table-Based View -->
			<div class="space-y-6">
				{#if selectedTable}
					<!-- Table Detail View -->
					<div class="bg-gray-800 rounded-lg border border-gray-700 p-6">
						<div class="flex items-center justify-between mb-6">
							<div>
								<h2 class="text-2xl font-bold">Table {selectedTable.tableId}</h2>
								<p class="text-gray-400">Ticket #{selectedTable.ticketNumber} • {selectedTable.totalItems} items</p>
							</div>
							<button
								on:click={() => selectedTable = null}
								class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
							>
								← Back to Tables
							</button>
						</div>

						<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
							{#each selectedTable.items as item}
								<div class="p-4 rounded-lg border-2 {getUrgencyColors(item.urgencyLevel)}">
									<div class="flex justify-between items-start mb-2">
										<div>
											<div class="font-bold text-lg">
												{item.quantity}x {item.expand?.menu_item_id?.name || item.name}
											</div>
											<div class="text-sm text-gray-300">
												{getStationName(item.kitchen_station)}
											</div>
											{#if item.seat_number}
												<div class="text-sm text-blue-300">
													Seat {item.seat_number} {item.seat_name ? `(${item.seat_name})` : ''}
												</div>
											{/if}
										</div>
										<div class="text-right">
											<div class="text-xl font-bold {item.isOverdue ? 'text-red-400' : 'text-green-400'}">
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
					</div>
				{:else}
					<!-- Table Overview -->
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
						{#each tableGroups as table}
							<button
								on:click={() => selectedTable = table}
								class="p-6 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg text-left transition-all hover:scale-105"
							>
								<div class="flex items-center justify-between mb-3">
									<h3 class="text-lg font-bold">Table {table.tableId}</h3>
									<div class="w-4 h-4 rounded-full {getTableStatusColor(table)}"></div>
								</div>
								
								<div class="text-sm text-gray-400 mb-2">
									Ticket #{table.ticketNumber}
								</div>
								
								<div class="space-y-1">
									<div class="flex justify-between text-sm">
										<span>Total Items:</span>
										<span class="font-medium">{table.totalItems}</span>
									</div>
									{#if table.urgentItems > 0}
										<div class="flex justify-between text-sm text-orange-400">
											<span>Urgent:</span>
											<span class="font-medium">{table.urgentItems}</span>
										</div>
									{/if}
									{#if table.overdueItems > 0}
										<div class="flex justify-between text-sm text-red-400">
											<span>Overdue:</span>
											<span class="font-medium">{table.overdueItems}</span>
										</div>
									{/if}
								</div>
							</button>
						{/each}
					</div>

					{#if tableGroups.length === 0}
						<div class="text-center py-12 text-gray-400">
							<div class="text-6xl mb-4">🎉</div>
							<h3 class="text-xl font-semibold mb-2">All Orders Complete!</h3>
							<p>No active orders from any tables right now.</p>
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
	{/if}
</div>
