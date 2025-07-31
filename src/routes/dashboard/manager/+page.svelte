<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore, isManager } from '$lib/auth.js';
	import { collections, inventoryItems, staff, shifts, menuItems, vendors, events, loading } from '$lib/stores/collections.js';
	import ImportModal from '$lib/components/ImportModal.svelte';

	let activeTab = 'overview';
	let user = null;
	let showImportModal = false;

	// Reactive declarations
	$: lowStockItems = $inventoryItems.filter(item => 
		item.current_stock_field <= item.min_stock_level_field
	);
	
	$: todayShifts = $shifts.filter(shift => 
		shift.shift_date === new Date().toISOString().split('T')[0]
	);

	onMount(async () => {
		// Check authentication and role
		const unsubscribe = authStore.subscribe(async (auth) => {
			if (!auth.isLoggedIn && !auth.isLoading) {
				goto('/');
				return;
			}
			
			const userRole = auth.role?.toLowerCase();
			if (auth.isLoggedIn && userRole !== 'manager' && userRole !== 'owner') {
				goto('/dashboard');
				return;
			}

			if (auth.isLoggedIn) {
				user = auth.user;
				// Load all data for managers
				try {
					await Promise.all([
						collections.getInventoryItems(),
						collections.getStaff(),
						collections.getShifts(),
						collections.getMenuItems(),
						collections.getVendors(),
						collections.getEvents()
					]);
				} catch (error) {
					console.error('Error loading dashboard data:', error);
				}
			}
		});

		return unsubscribe;
	});

	async function logout() {
		const { auth } = await import('$lib/auth.js');
		await auth.logout();
		goto('/');
	}

	function setActiveTab(tab) {
		activeTab = tab;
	}

	function openImportModal() {
		showImportModal = true;
	}

	function closeImportModal() {
		showImportModal = false;
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100">
	<!-- Header -->
	<header class="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center py-6">
				<div class="flex items-center space-x-4">
					<div class="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
						<span class="font-bold text-xl">P</span>
					</div>
					<div>
						<h1 class="text-2xl font-bold">PARC Portal</h1>
						<p class="text-sm text-blue-400">Manager Dashboard</p>
					</div>
				</div>
				<div class="flex items-center space-x-4">
					{#if user}
						<div class="flex items-center space-x-2">
							<div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
								<span class="font-medium">{user.name?.charAt(0) || user.email?.charAt(0) || 'M'}</span>
							</div>
							<div class="hidden md:block">
								<p class="font-medium">{user.name || user.email}</p>
								<p class="text-sm text-green-400">Manager</p>
							</div>
						</div>
					{/if}
					<button
						on:click={openImportModal}
						class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-sm font-medium"
					>
						Import Data
					</button>
					<button
						on:click={logout}
						class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium"
					>
						Logout
					</button>
				</div>
			</div>
		</div>
	</header>

	<!-- Navigation Tabs -->
	<nav class="bg-gray-800/30 border-b border-gray-700">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex space-x-8 overflow-x-auto">
				{#each [
					{ id: 'overview', name: 'Overview', icon: '📊' },
					{ id: 'inventory', name: 'Inventory', icon: '📦' },
					{ id: 'staff', name: 'Staff', icon: '👥' },
					{ id: 'shifts', name: 'Shifts', icon: '🗓️' },
					{ id: 'menu', name: 'Menu', icon: '🍽️' },
					{ id: 'vendors', name: 'Vendors', icon: '🏢' },
					{ id: 'events', name: 'Events', icon: '🎉' }
				] as tab}
					<button
						class="flex items-center space-x-2 py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap {
							activeTab === tab.id 
								? 'border-blue-500 text-blue-400' 
								: 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
						}"
						on:click={() => setActiveTab(tab.id)}
					>
						<span>{tab.icon}</span>
						<span>{tab.name}</span>
					</button>
				{/each}
			</div>
		</div>
	</nav>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		{#if activeTab === 'overview'}
			<!-- Overview Dashboard -->
			<div class="mb-8">
				<h2 class="text-3xl font-bold">Manager Overview</h2>
				<p class="text-gray-400 mt-2">Monitor your restaurant operations at a glance</p>
			</div>

			<!-- Key Metrics -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
				<!-- Total Staff -->
				<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-gray-400 text-sm">Total Staff</p>
							<p class="text-2xl font-bold">{$staff.length}</p>
						</div>
						<div class="w-12 h-12 rounded-lg bg-blue-900/50 flex items-center justify-center">
							<span class="text-2xl">👥</span>
						</div>
					</div>
				</div>

				<!-- Today's Shifts -->
				<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-gray-400 text-sm">Today's Shifts</p>
							<p class="text-2xl font-bold">{todayShifts.length}</p>
						</div>
						<div class="w-12 h-12 rounded-lg bg-green-900/50 flex items-center justify-center">
							<span class="text-2xl">🗓️</span>
						</div>
					</div>
				</div>

				<!-- Low Stock Items -->
				<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-gray-400 text-sm">Low Stock Items</p>
							<p class="text-2xl font-bold text-orange-400">{lowStockItems.length}</p>
						</div>
						<div class="w-12 h-12 rounded-lg bg-orange-900/50 flex items-center justify-center">
							<span class="text-2xl">⚠️</span>
						</div>
					</div>
				</div>

				<!-- Active Events -->
				<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-gray-400 text-sm">Active Events</p>
							<p class="text-2xl font-bold">{$events.filter(e => e.status === 'confirmed').length}</p>
						</div>
						<div class="w-12 h-12 rounded-lg bg-purple-900/50 flex items-center justify-center">
							<span class="text-2xl">🎉</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Low Stock Alerts -->
				<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
					<h3 class="text-xl font-bold mb-4 flex items-center">
						<span class="mr-2">⚠️</span>
						Low Stock Alerts
					</h3>
					{#if lowStockItems.length === 0}
						<p class="text-gray-400">All items are well stocked!</p>
					{:else}
						<div class="space-y-3">
							{#each lowStockItems.slice(0, 5) as item}
								<div class="flex justify-between items-center p-3 bg-orange-900/20 rounded-lg border border-orange-700/30">
									<div>
										<p class="font-medium">{item.item_name_field}</p>
										<p class="text-sm text-gray-400">Current: {item.current_stock_field} {item.unit_field}</p>
									</div>
									<span class="text-orange-400 font-bold">LOW</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Today's Schedule -->
				<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
					<h3 class="text-xl font-bold mb-4 flex items-center">
						<span class="mr-2">🗓️</span>
						Today's Schedule
					</h3>
					{#if todayShifts.length === 0}
						<p class="text-gray-400">No shifts scheduled for today</p>
					{:else}
						<div class="space-y-3">
							{#each todayShifts.slice(0, 5) as shift}
								<div class="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
									<div>
										<p class="font-medium">{shift.expand?.staff_member?.first_name} {shift.expand?.staff_member?.last_name}</p>
										<p class="text-sm text-gray-400">{shift.position}</p>
									</div>
									<div class="text-right">
										<p class="text-sm">{shift.start_time} - {shift.end_time}</p>
										<span class="text-xs px-2 py-1 rounded-full {
											shift.status === 'confirmed' ? 'bg-green-900/50 text-green-300' :
											shift.status === 'scheduled' ? 'bg-blue-900/50 text-blue-300' :
											'bg-gray-700/50 text-gray-300'
										}">
											{shift.status}
										</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

		{:else if activeTab === 'inventory'}
			<!-- Inventory Management -->
			<div class="mb-8 flex justify-between items-center">
				<div>
					<h2 class="text-3xl font-bold">Inventory Management</h2>
					<p class="text-gray-400 mt-2">Track and manage restaurant inventory</p>
				</div>
				<button class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">
					+ Add Item
				</button>
			</div>

			{#if $loading.inventory}
				<div class="flex justify-center items-center h-64">
					<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
				</div>
			{:else}
				<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead class="bg-gray-700/50">
								<tr>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Item</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Category</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Stock</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Unit</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-700">
								{#each $inventoryItems as item}
									<tr class="hover:bg-gray-700/30">
										<td class="px-6 py-4 whitespace-nowrap">
											<div>
												<div class="text-sm font-medium">{item.name}</div>
												{#if item.description}
													<div class="text-sm text-gray-400">{item.description}</div>
												{/if}
											</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span class="px-2 py-1 text-xs rounded-full bg-gray-700 text-gray-300">
												{item.category}
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<div class="text-sm">
												<span class="font-medium">{item.current_stock}</span>
												<span class="text-gray-400">/ {item.min_stock_level} min</span>
											</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm">{item.unit}</td>
										<td class="px-6 py-4 whitespace-nowrap">
											{#if item.current_stock <= item.min_stock_level}
												<span class="px-2 py-1 text-xs rounded-full bg-red-900/50 text-red-300">
													Low Stock
												</span>
											{:else if item.current_stock <= (item.min_stock_level * 1.5)}
												<span class="px-2 py-1 text-xs rounded-full bg-yellow-900/50 text-yellow-300">
													Warning
												</span>
											{:else}
												<span class="px-2 py-1 text-xs rounded-full bg-green-900/50 text-green-300">
													Good
												</span>
											{/if}
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-sm">
											<button class="text-blue-400 hover:text-blue-300 mr-3">Edit</button>
											<button class="text-red-400 hover:text-red-300">Delete</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

		{:else if activeTab === 'staff'}
			<!-- Staff Management -->
			<div class="space-y-6">
				<div class="flex justify-between items-center">
					<h2 class="text-2xl font-bold">Staff Management</h2>
					<button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
						Add New Staff
					</button>
				</div>
				
				<div class="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
					<table class="w-full">
						<thead class="bg-gray-700/50">
							<tr>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Name</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Position</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Email</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Phone</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Status</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-700">
							{#each $staff as member}
								<tr class="hover:bg-gray-700/30">
									<td class="px-6 py-4 text-sm text-white">
										{member.first_name} {member.last_name}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300 capitalize">
										{member.position}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										{member.email}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										{member.phone || 'N/A'}
									</td>
									<td class="px-6 py-4 text-sm">
										<span class="px-2 py-1 rounded-full text-xs {
											member.status === 'active' ? 'bg-green-900/50 text-green-300' :
											member.status === 'inactive' ? 'bg-yellow-900/50 text-yellow-300' :
											'bg-red-900/50 text-red-300'
										}">
											{member.status}
										</span>
									</td>
									<td class="px-6 py-4 text-sm">
										<button class="text-blue-400 hover:text-blue-300 mr-3">Edit</button>
										<button class="text-red-400 hover:text-red-300">Delete</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

		{:else if activeTab === 'shifts'}
			<!-- Shifts Management -->
			<div class="space-y-6">
				<div class="flex justify-between items-center">
					<h2 class="text-2xl font-bold">Shifts Management</h2>
					<button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
						Schedule Shift
					</button>
				</div>
				
				<div class="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
					<table class="w-full">
						<thead class="bg-gray-700/50">
							<tr>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Staff Member</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Date</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Time</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Position</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Status</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-700">
							{#each $shifts as shift}
								<tr class="hover:bg-gray-700/30">
									<td class="px-6 py-4 text-sm text-white">
										{shift.staff_member ? 'Staff Member' : 'Unassigned'}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										{shift.shift_date}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										{shift.start_time} - {shift.end_time}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300 capitalize">
										{shift.position}
									</td>
									<td class="px-6 py-4 text-sm">
										<span class="px-2 py-1 rounded-full text-xs {
											shift.status === 'confirmed' ? 'bg-green-900/50 text-green-300' :
											shift.status === 'scheduled' ? 'bg-blue-900/50 text-blue-300' :
											shift.status === 'completed' ? 'bg-gray-900/50 text-gray-300' :
											'bg-red-900/50 text-red-300'
										}">
											{shift.status}
										</span>
									</td>
									<td class="px-6 py-4 text-sm">
										<button class="text-blue-400 hover:text-blue-300 mr-3">Edit</button>
										<button class="text-red-400 hover:text-red-300">Cancel</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

		{:else if activeTab === 'menu'}
			<!-- Menu Management -->
			<div class="space-y-6">
				<div class="flex justify-between items-center">
					<h2 class="text-2xl font-bold">Menu Management</h2>
					<button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
						Add Menu Item
					</button>
				</div>
				
				<div class="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
					<table class="w-full">
						<thead class="bg-gray-700/50">
							<tr>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Item</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Category</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Price</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Cost</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Available</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-700">
							{#each $menuItems as item}
								<tr class="hover:bg-gray-700/30">
									<td class="px-6 py-4 text-sm text-white">
										{item.name}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300 capitalize">
										{item.category.replace('_', ' ')}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										${item.price}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										${item.cost || 'N/A'}
									</td>
									<td class="px-6 py-4 text-sm">
										<span class="px-2 py-1 rounded-full text-xs {
											item.available ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
										}">
											{item.available ? 'Available' : 'Unavailable'}
										</span>
									</td>
									<td class="px-6 py-4 text-sm">
										<button class="text-blue-400 hover:text-blue-300 mr-3">Edit</button>
										<button class="text-red-400 hover:text-red-300">Remove</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

		{:else if activeTab === 'vendors'}
			<!-- Vendors Management -->
			<div class="space-y-6">
				<div class="flex justify-between items-center">
					<h2 class="text-2xl font-bold">Vendors Management</h2>
					<button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
						Add Vendor
					</button>
				</div>
				
				<div class="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
					<table class="w-full">
						<thead class="bg-gray-700/50">
							<tr>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Vendor</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Contact</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Category</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Payment Terms</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Status</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-700">
							{#each $vendors as vendor}
								<tr class="hover:bg-gray-700/30">
									<td class="px-6 py-4 text-sm text-white">
										{vendor.name}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										<div>{vendor.contact_person}</div>
										<div class="text-xs text-gray-400">{vendor.email}</div>
									</td>
									<td class="px-6 py-4 text-sm text-gray-300 capitalize">
										{vendor.category.replace('_', ' ')}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										{vendor.payment_terms}
									</td>
									<td class="px-6 py-4 text-sm">
										<span class="px-2 py-1 rounded-full text-xs {
											vendor.status === 'active' ? 'bg-green-900/50 text-green-300' :
											vendor.status === 'pending' ? 'bg-yellow-900/50 text-yellow-300' :
											'bg-red-900/50 text-red-300'
										}">
											{vendor.status}
										</span>
									</td>
									<td class="px-6 py-4 text-sm">
										<button class="text-blue-400 hover:text-blue-300 mr-3">Edit</button>
										<button class="text-red-400 hover:text-red-300">Remove</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

		{:else if activeTab === 'events'}
			<!-- Events Management -->
			<div class="space-y-6">
				<div class="flex justify-between items-center">
					<h2 class="text-2xl font-bold">Events Management</h2>
					<button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
						Add Event
					</button>
				</div>
				
				<div class="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
					<table class="w-full">
						<thead class="bg-gray-700/50">
							<tr>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Event</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Type</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Date & Time</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Guests</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Status</th>
								<th class="px-6 py-4 text-left text-sm font-medium text-gray-300">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-700">
							{#each $events as event}
								<tr class="hover:bg-gray-700/30">
									<td class="px-6 py-4 text-sm text-white">
										{event.name}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300 capitalize">
										{event.event_type.replace('_', ' ')}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										<div>{event.event_date}</div>
										<div class="text-xs text-gray-400">{event.start_time} - {event.end_time}</div>
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										{event.guest_count || 'TBD'} guests
									</td>
									<td class="px-6 py-4 text-sm">
										<span class="px-2 py-1 rounded-full text-xs {
											event.status === 'confirmed' ? 'bg-green-900/50 text-green-300' :
											event.status === 'inquiry' ? 'bg-blue-900/50 text-blue-300' :
											event.status === 'completed' ? 'bg-gray-900/50 text-gray-300' :
											'bg-red-900/50 text-red-300'
										}">
											{event.status}
										</span>
									</td>
									<td class="px-6 py-4 text-sm">
										<button class="text-blue-400 hover:text-blue-300 mr-3">Edit</button>
										<button class="text-red-400 hover:text-red-300">Cancel</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

		{:else}
			<!-- Fallback for any unhandled tabs -->
			<div class="text-center py-12">
				<p class="text-gray-400 text-lg">
					{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} management coming soon...
				</p>
			</div>
		{/if}
	</main>
</div>

<!-- Import Modal -->
<ImportModal bind:isOpen={showImportModal} on:close={closeImportModal} />
