<script>
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { authStore, isManager } from "$lib/auth.js";
	import {
		collections,
		inventoryItems,
		staff,
		shifts,
		menuItems,
		vendors,
		events,
		loading,
	} from "$lib/stores/collections.js";
	import ImportModal from "$lib/components/ImportModal.svelte";
	import InventoryModal from "$lib/components/InventoryModal.svelte";
	import StaffModal from "$lib/components/StaffModal.svelte";
	import ShiftModal from "$lib/components/ShiftModal.svelte";
	import MenuModal from "$lib/components/MenuModal.svelte";
	import VendorModal from "$lib/components/VendorModal.svelte";
	import EventModal from "$lib/components/EventModal.svelte";

	let activeTab = "overview";
	let user = null;
	let showImportModal = false;
	let showInventoryModal = false;
	let editInventoryItem = null;
	let showStaffModal = false;
	let editStaffItem = null;
	let showShiftModal = false;
	let editShiftItem = null;
	let showMenuModal = false;
	let editMenuItem = null;
	let showVendorModal = false;
	let editVendorItem = null;
	let showEventModal = false;
	let editEventItem = null;

	// Reactive declarations
	$: lowStockItems = $inventoryItems.filter(
		(item) => item.current_stock_field <= item.min_stock_level_field
	);

	$: todayShifts = $shifts.filter(
		(shift) => shift.shift_date === new Date().toISOString().split("T")[0]
	);

	// Enhanced metrics
	$: upcomingEvents = $events.filter(event => {
		const eventDate = new Date(event.event_date);
		const today = new Date();
		const nextWeek = new Date();
		nextWeek.setDate(today.getDate() + 7);
		return eventDate >= today && eventDate <= nextWeek && event.status === 'confirmed';
	});

	$: totalMenuItems = $menuItems.length;
	$: availableMenuItems = $menuItems.filter(item => item.available).length;
	$: activeStaff = $staff.filter(member => member.status === 'active').length;
	$: pendingEvents = $events.filter(event => event.status === 'inquiry').length;

	// Weekly shifts calculation
	$: weeklyShifts = $shifts.filter(shift => {
		const shiftDate = new Date(shift.shift_date);
		const today = new Date();
		const startOfWeek = new Date(today);
		startOfWeek.setDate(today.getDate() - today.getDay());
		const endOfWeek = new Date(startOfWeek);
		endOfWeek.setDate(startOfWeek.getDate() + 6);
		return shiftDate >= startOfWeek && shiftDate <= endOfWeek;
	});

	// Revenue estimate from confirmed events this month
	$: monthlyRevenue = $events
		.filter(event => {
			const eventDate = new Date(event.event_date);
			const today = new Date();
			return eventDate.getMonth() === today.getMonth() && 
				   eventDate.getFullYear() === today.getFullYear() &&
				   event.status === 'confirmed';
		})
		.reduce((total, event) => total + (event.estimated_revenue || 0), 0);

	onMount(async () => {
		// Check authentication and role
		const unsubscribe = authStore.subscribe(async (auth) => {
			if (!auth.isLoggedIn && !auth.isLoading) {
				goto("/");
				return;
			}

			const userRole = auth.role?.toLowerCase();
			if (
				auth.isLoggedIn &&
				userRole !== "manager" &&
				userRole !== "owner"
			) {
				goto("/dashboard");
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
						collections.getEvents(),
					]);
				} catch (error) {
					console.error("Error loading dashboard data:", error);
				}
			}
		});

		return unsubscribe;
	});

	async function logout() {
		const { auth } = await import("$lib/auth.js");
		await auth.logout();
		goto("/");
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

	function openInventoryModal(item = null) {
		editInventoryItem = item;
		showInventoryModal = true;
	}

	function closeInventoryModal() {
		showInventoryModal = false;
		editInventoryItem = null;
	}

	async function handleDeleteInventoryItem(item) {
		if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
			try {
				await collections.deleteInventoryItem(item.id);
				await collections.getInventoryItems(); // Refresh data
			} catch (error) {
				console.error("Error deleting inventory item:", error);
				alert("Failed to delete inventory item");
			}
		}
	}

	function openStaffModal(item = null) {
		editStaffItem = item;
		showStaffModal = true;
	}

	function closeStaffModal() {
		showStaffModal = false;
		editStaffItem = null;
	}

	async function handleDeleteStaff(item) {
		if (
			confirm(
				`Are you sure you want to delete "${item.first_name} ${item.last_name}"?`
			)
		) {
			try {
				await collections.deleteStaff(item.id);
				await collections.getStaff(); // Refresh data
			} catch (error) {
				console.error("Error deleting staff member:", error);
				alert("Failed to delete staff member");
			}
		}
	}

	function openShiftModal(item = null) {
		editShiftItem = item;
		showShiftModal = true;
	}

	function closeShiftModal() {
		showShiftModal = false;
		editShiftItem = null;
	}

	async function handleDeleteShift(item) {
		if (confirm(`Are you sure you want to delete this shift?`)) {
			try {
				await collections.deleteShift(item.id);
				await collections.getShifts(); // Refresh data
			} catch (error) {
				console.error("Error deleting shift:", error);
				alert("Failed to delete shift");
			}
		}
	}

	function openMenuModal(item = null) {
		editMenuItem = item;
		showMenuModal = true;
	}

	function closeMenuModal() {
		showMenuModal = false;
		editMenuItem = null;
	}

	async function handleDeleteMenuItem(item) {
		if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
			try {
				await collections.deleteMenuItem(item.id);
				await collections.getMenuItems(); // Refresh data
			} catch (error) {
				console.error("Error deleting menu item:", error);
				alert("Failed to delete menu item");
			}
		}
	}

	function openVendorModal(item = null) {
		editVendorItem = item;
		showVendorModal = true;
	}

	function closeVendorModal() {
		showVendorModal = false;
		editVendorItem = null;
	}

	async function handleDeleteVendor(item) {
		if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
			try {
				await collections.deleteVendor(item.id);
				await collections.getVendors(); // Refresh data
			} catch (error) {
				console.error("Error deleting vendor:", error);
				alert("Failed to delete vendor");
			}
		}
	}

	function openEventModal(item = null) {
		editEventItem = item;
		showEventModal = true;
	}

	function closeEventModal() {
		showEventModal = false;
		editEventItem = null;
	}

	async function handleDeleteEvent(item) {
		if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
			try {
				await collections.deleteEvent(item.id);
				await collections.getEvents(); // Refresh data
			} catch (error) {
				console.error("Error deleting event:", error);
				alert("Failed to delete event");
			}
		}
	}

	// Helper functions for date and time formatting
	function formatShortDate(dateString) {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	}

	function formatTime12Hour(timeString) {
		if (!timeString) return "";
		const [hours, minutes] = timeString.split(":");
		const hour24 = parseInt(hours);
		const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
		const ampm = hour24 >= 12 ? "pm" : "am";
		return `${hour12}${minutes !== "00" ? ":" + minutes : ""}${ampm}`;
	}
</script>

<div
	class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100"
>
	<!-- Header -->
	<header class="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center py-6">
				<div class="flex items-center space-x-4">
					<div
						class="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center"
					>
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
							<div
								class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center"
							>
								<span class="font-medium"
									>{user.name?.charAt(0) ||
										user.email?.charAt(0) ||
										"M"}</span
								>
							</div>
							<div class="hidden md:block">
								<p class="font-medium">
									{user.name || user.email}
								</p>
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
				{#each [{ id: "overview", name: "Overview", icon: "📊" }, { id: "inventory", name: "Inventory", icon: "📦" }, { id: "staff", name: "Staff", icon: "👥" }, { id: "shifts", name: "Shifts", icon: "🗓️" }, { id: "menu", name: "Menu", icon: "🍽️" }, { id: "vendors", name: "Vendors", icon: "🏢" }, { id: "events", name: "Events", icon: "🎉" }] as tab}
					<button
						class="flex items-center space-x-2 py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap {activeTab ===
						tab.id
							? 'border-blue-500 text-blue-400'
							: 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'}"
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
		{#if activeTab === "overview"}
			<!-- Overview Dashboard -->
			<div class="mb-8 flex justify-between items-center">
				<div>
					<h2 class="text-3xl font-bold">Manager Overview</h2>
					<p class="text-gray-400 mt-2">
						Monitor your restaurant operations at a glance
					</p>
				</div>
				<!-- Quick Actions -->
				<div class="flex space-x-3">
					<button
						on:click={() => openStaffModal()}
						class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
					>
						+ Staff
					</button>
					<button
						on:click={() => openShiftModal()}
						class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
					>
						+ Shift
					</button>
					<button
						on:click={() => openEventModal()}
						class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
					>
						+ Event
					</button>
				</div>
			</div>

			<!-- Enhanced Key Metrics -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
				<!-- Active Staff -->
				<div class="bg-gradient-to-br from-blue-900/50 to-blue-800/30 backdrop-blur-sm rounded-xl border border-blue-700/50 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-blue-200 text-sm font-medium">Active Staff</p>
							<p class="text-3xl font-bold text-white">{activeStaff}</p>
							<p class="text-blue-300 text-xs mt-1">of {$staff.length} total</p>
						</div>
						<div class="w-14 h-14 rounded-xl bg-blue-600/30 flex items-center justify-center">
							<span class="text-2xl">👥</span>
						</div>
					</div>
				</div>

				<!-- This Week's Shifts -->
				<div class="bg-gradient-to-br from-green-900/50 to-green-800/30 backdrop-blur-sm rounded-xl border border-green-700/50 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-green-200 text-sm font-medium">This Week</p>
							<p class="text-3xl font-bold text-white">{weeklyShifts.length}</p>
							<p class="text-green-300 text-xs mt-1">{todayShifts.length} today</p>
						</div>
						<div class="w-14 h-14 rounded-xl bg-green-600/30 flex items-center justify-center">
							<span class="text-2xl">🗓️</span>
						</div>
					</div>
				</div>

				<!-- Inventory Alert -->
				<div class="bg-gradient-to-br from-orange-900/50 to-orange-800/30 backdrop-blur-sm rounded-xl border border-orange-700/50 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-orange-200 text-sm font-medium">Stock Alerts</p>
							<p class="text-3xl font-bold text-white">{lowStockItems.length}</p>
							<p class="text-orange-300 text-xs mt-1">need restocking</p>
						</div>
						<div class="w-14 h-14 rounded-xl bg-orange-600/30 flex items-center justify-center">
							<span class="text-2xl">⚠️</span>
						</div>
					</div>
				</div>

				<!-- Monthly Revenue -->
				<div class="bg-gradient-to-br from-purple-900/50 to-purple-800/30 backdrop-blur-sm rounded-xl border border-purple-700/50 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-purple-200 text-sm font-medium">Est. Revenue</p>
							<p class="text-3xl font-bold text-white">
								${monthlyRevenue.toLocaleString()}
							</p>
							<p class="text-purple-300 text-xs mt-1">this month</p>
						</div>
						<div class="w-14 h-14 rounded-xl bg-purple-600/30 flex items-center justify-center">
							<span class="text-2xl">💰</span>
						</div>
					</div>
				</div>

				<!-- Menu Status -->
				<div class="bg-gradient-to-br from-teal-900/50 to-teal-800/30 backdrop-blur-sm rounded-xl border border-teal-700/50 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-teal-200 text-sm font-medium">Menu Items</p>
							<p class="text-3xl font-bold text-white">{availableMenuItems}</p>
							<p class="text-teal-300 text-xs mt-1">of {totalMenuItems} available</p>
						</div>
						<div class="w-14 h-14 rounded-xl bg-teal-600/30 flex items-center justify-center">
							<span class="text-2xl">🍽️</span>
						</div>
					</div>
				</div>

				<!-- Upcoming Events -->
				<div class="bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 backdrop-blur-sm rounded-xl border border-indigo-700/50 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-indigo-200 text-sm font-medium">Next Week</p>
							<p class="text-3xl font-bold text-white">{upcomingEvents.length}</p>
							<p class="text-indigo-300 text-xs mt-1">confirmed events</p>
						</div>
						<div class="w-14 h-14 rounded-xl bg-indigo-600/30 flex items-center justify-center">
							<span class="text-2xl">📅</span>
						</div>
					</div>
				</div>

				<!-- Pending Inquiries -->
				<div class="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 backdrop-blur-sm rounded-xl border border-yellow-700/50 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-yellow-200 text-sm font-medium">Pending</p>
							<p class="text-3xl font-bold text-white">{pendingEvents}</p>
							<p class="text-yellow-300 text-xs mt-1">event inquiries</p>
						</div>
						<div class="w-14 h-14 rounded-xl bg-yellow-600/30 flex items-center justify-center">
							<span class="text-2xl">❓</span>
						</div>
					</div>
				</div>

				<!-- Weekly Performance -->
				<div class="bg-gradient-to-br from-cyan-900/50 to-cyan-800/30 backdrop-blur-sm rounded-xl border border-cyan-700/50 p-6">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-cyan-200 text-sm font-medium">Operations</p>
							<p class="text-3xl font-bold text-white">
								{Math.round((activeStaff / Math.max($staff.length, 1)) * 100)}%
							</p>
							<p class="text-cyan-300 text-xs mt-1">staff efficiency</p>
						</div>
						<div class="w-14 h-14 rounded-xl bg-cyan-600/30 flex items-center justify-center">
							<span class="text-2xl">📊</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Low Stock Alerts -->
				<div
					class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6"
				>
					<h3 class="text-xl font-bold mb-4 flex items-center">
						<span class="mr-2">⚠️</span>
						Low Stock Alerts
					</h3>
					{#if lowStockItems.length === 0}
						<p class="text-gray-400">All items are well stocked!</p>
					{:else}
						<div class="space-y-3">
							{#each lowStockItems.slice(0, 5) as item}
								<div
									class="flex justify-between items-center p-3 bg-orange-900/20 rounded-lg border border-orange-700/30"
								>
									<div>
										<p class="font-medium">
											{item.item_name_field}
										</p>
										<p class="text-sm text-gray-400">
											Current: {item.current_stock_field}
											{item.unit_field}
										</p>
									</div>
									<span class="text-orange-400 font-bold"
										>LOW</span
									>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Today's Schedule -->
				<div
					class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6"
				>
					<h3 class="text-xl font-bold mb-4 flex items-center">
						<span class="mr-2">🗓️</span>
						Today's Schedule
					</h3>
					{#if todayShifts.length === 0}
						<p class="text-gray-400">
							No shifts scheduled for today
						</p>
					{:else}
						<div class="space-y-3">
							{#each todayShifts.slice(0, 5) as shift}
								<div
									class="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg"
								>
									<div>
										<p class="font-medium">
											{shift.expand?.staff_member
												?.first_name}
											{shift.expand?.staff_member
												?.last_name}
										</p>
										<p class="text-sm text-gray-400">
											{shift.position}
										</p>
									</div>
									<div class="text-right">
										<p class="text-sm">
											{shift.start_time} - {shift.end_time}
										</p>
										<span
											class="text-xs px-2 py-1 rounded-full {shift.status ===
											'confirmed'
												? 'bg-green-900/50 text-green-300'
												: shift.status === 'scheduled'
												? 'bg-blue-900/50 text-blue-300'
												: 'bg-gray-700/50 text-gray-300'}"
										>
											{shift.status}
										</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === "inventory"}
			<!-- Inventory Management -->
			<div class="mb-8 flex justify-between items-center">
				<div>
					<h2 class="text-3xl font-bold">Inventory Management</h2>
					<p class="text-gray-400 mt-2">
						Track and manage restaurant inventory
					</p>
				</div>
				<button
					on:click={() => openInventoryModal()}
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
				>
					+ Add Item
				</button>
			</div>

			{#if $loading.inventory}
				<div class="flex justify-center items-center h-64">
					<div
						class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"
					/>
				</div>
			{:else}
				<div
					class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden"
				>
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead class="bg-gray-700/50">
								<tr>
									<th
										class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
										>Item</th
									>
									<th
										class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
										>Category</th
									>
									<th
										class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
										>Stock</th
									>
									<th
										class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
										>Unit</th
									>
									<th
										class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
										>Status</th
									>
									<th
										class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
										>Actions</th
									>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-700">
								{#each $inventoryItems as item}
									<tr class="hover:bg-gray-700/30">
										<td class="px-6 py-4 whitespace-nowrap">
											<div>
												<div
													class="text-sm font-medium"
												>
													{item.name}
												</div>
												{#if item.description}
													<div
														class="text-sm text-gray-400"
													>
														{item.description}
													</div>
												{/if}
											</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<span
												class="px-2 py-1 text-xs rounded-full bg-gray-700 text-gray-300"
											>
												{item.category}
											</span>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<div class="text-sm">
												<span class="font-medium"
													>{item.current_stock}</span
												>
												<span class="text-gray-400"
													>/ {item.min_stock_level} min</span
												>
											</div>
										</td>
										<td
											class="px-6 py-4 whitespace-nowrap text-sm"
											>{item.unit}</td
										>
										<td class="px-6 py-4 whitespace-nowrap">
											{#if item.current_stock <= item.min_stock_level}
												<span
													class="px-2 py-1 text-xs rounded-full bg-red-900/50 text-red-300"
												>
													Low Stock
												</span>
											{:else if item.current_stock <= item.min_stock_level * 1.5}
												<span
													class="px-2 py-1 text-xs rounded-full bg-yellow-900/50 text-yellow-300"
												>
													Warning
												</span>
											{:else}
												<span
													class="px-2 py-1 text-xs rounded-full bg-green-900/50 text-green-300"
												>
													Good
												</span>
											{/if}
										</td>
										<td
											class="px-6 py-4 whitespace-nowrap text-sm"
										>
											<button
												on:click={() =>
													openInventoryModal(item)}
												class="text-blue-400 hover:text-blue-300 mr-3"
											>
												Edit
											</button>
											<button
												on:click={() =>
													handleDeleteInventoryItem(
														item
													)}
												class="text-red-400 hover:text-red-300"
											>
												Delete
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		{:else if activeTab === "staff"}
			<!-- Staff Management -->
			<div class="space-y-6">
				<div class="flex justify-between items-center">
					<h2 class="text-2xl font-bold">Staff Management</h2>
					<button
						on:click={() => openStaffModal()}
						class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
					>
						Add New Staff
					</button>
				</div>

				<div
					class="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden"
				>
					<table class="w-full">
						<thead class="bg-gray-700/50">
							<tr>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Name</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Position</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Email</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Phone</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Status</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Actions</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-700">
							{#each $staff as member}
								<tr class="hover:bg-gray-700/30">
									<td class="px-6 py-4 text-sm text-white">
										{member.first_name}
										{member.last_name}
									</td>
									<td
										class="px-6 py-4 text-sm text-gray-300 capitalize"
									>
										{member.position}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										{member.email}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										{member.phone || "N/A"}
									</td>
									<td class="px-6 py-4 text-sm">
										<span
											class="px-2 py-1 rounded-full text-xs {member.status ===
											'active'
												? 'bg-green-900/50 text-green-300'
												: member.status === 'inactive'
												? 'bg-yellow-900/50 text-yellow-300'
												: 'bg-red-900/50 text-red-300'}"
										>
											{member.status}
										</span>
									</td>
									<td class="px-6 py-4 text-sm">
										<button
											on:click={() =>
												openStaffModal(member)}
											class="text-blue-400 hover:text-blue-300 mr-3"
										>
											Edit
										</button>
										<button
											on:click={() =>
												handleDeleteStaff(member)}
											class="text-red-400 hover:text-red-300"
										>
											Delete
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else if activeTab === "shifts"}
			<!-- Shifts Management -->
			<div class="space-y-6">
				<div class="flex justify-between items-center">
					<h2 class="text-2xl font-bold">Shifts Management</h2>
					<button
						on:click={() => openShiftModal()}
						class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
					>
						Schedule Shift
					</button>
				</div>

				<div
					class="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden"
				>
					<table class="w-full">
						<thead class="bg-gray-700/50">
							<tr>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Staff Member</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Date</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Time</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Position</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Status</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Actions</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-700">
							{#each $shifts as shift}
								<tr class="hover:bg-gray-700/30">
									<td class="px-6 py-4 text-sm text-white">
										{shift.staff_member
											? "Staff Member"
											: "Unassigned"}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										{formatShortDate(shift.shift_date)}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										{formatTime12Hour(shift.start_time)} - {formatTime12Hour(
											shift.end_time
										)}
									</td>
									<td
										class="px-6 py-4 text-sm text-gray-300 capitalize"
									>
										{shift.position}
									</td>
									<td class="px-6 py-4 text-sm">
										<span
											class="px-2 py-1 rounded-full text-xs {shift.status ===
											'confirmed'
												? 'bg-green-900/50 text-green-300'
												: shift.status === 'scheduled'
												? 'bg-blue-900/50 text-blue-300'
												: shift.status === 'completed'
												? 'bg-gray-900/50 text-gray-300'
												: 'bg-red-900/50 text-red-300'}"
										>
											{shift.status}
										</span>
									</td>
									<td class="px-6 py-4 text-sm">
										<button
											on:click={() =>
												openShiftModal(shift)}
											class="text-blue-400 hover:text-blue-300 mr-3"
										>
											Edit
										</button>
										<button
											on:click={() =>
												handleDeleteShift(shift)}
											class="text-red-400 hover:text-red-300"
										>
											Cancel
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else if activeTab === "menu"}
			<!-- Menu Management -->
			<div class="space-y-6">
				<div class="flex justify-between items-center">
					<h2 class="text-2xl font-bold">Menu Management</h2>
					<button
						on:click={() => openMenuModal()}
						class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
					>
						Add Menu Item
					</button>
				</div>

				<div
					class="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden"
				>
					<table class="w-full">
						<thead class="bg-gray-700/50">
							<tr>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Item</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Category</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Price</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Cost</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Available</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Actions</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-700">
							{#each $menuItems as item}
								<tr class="hover:bg-gray-700/30">
									<td class="px-6 py-4 text-sm text-white">
										{item.name}
									</td>
									<td
										class="px-6 py-4 text-sm text-gray-300 capitalize"
									>
										{item.category.replace("_", " ")}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										${item.price}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										${item.cost || "N/A"}
									</td>
									<td class="px-6 py-4 text-sm">
										<span
											class="px-2 py-1 rounded-full text-xs {item.available
												? 'bg-green-900/50 text-green-300'
												: 'bg-red-900/50 text-red-300'}"
										>
											{item.available
												? "Available"
												: "Unavailable"}
										</span>
									</td>
									<td class="px-6 py-4 text-sm">
										<button
											on:click={() => openMenuModal(item)}
											class="text-blue-400 hover:text-blue-300 mr-3"
											>Edit</button
										>
										<button
											on:click={() =>
												handleDeleteMenuItem(item)}
											class="text-red-400 hover:text-red-300"
											>Remove</button
										>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else if activeTab === "vendors"}
			<!-- Vendors Management -->
			<div class="space-y-6">
				<div class="flex justify-between items-center">
					<h2 class="text-2xl font-bold">Vendors Management</h2>
					<button
						on:click={() => openVendorModal()}
						class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
					>
						Add Vendor
					</button>
				</div>

				<div
					class="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden"
				>
					<table class="w-full">
						<thead class="bg-gray-700/50">
							<tr>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Vendor</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Contact</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Category</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Payment Terms</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Status</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Actions</th
								>
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
										<div class="text-xs text-gray-400">
											{vendor.email}
										</div>
									</td>
									<td
										class="px-6 py-4 text-sm text-gray-300 capitalize"
									>
										{vendor.category.replace("_", " ")}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										{vendor.payment_terms}
									</td>
									<td class="px-6 py-4 text-sm">
										<span
											class="px-2 py-1 rounded-full text-xs {vendor.status ===
											'active'
												? 'bg-green-900/50 text-green-300'
												: vendor.status === 'pending'
												? 'bg-yellow-900/50 text-yellow-300'
												: 'bg-red-900/50 text-red-300'}"
										>
											{vendor.status}
										</span>
									</td>
									<td class="px-6 py-4 text-sm">
										<button
											on:click={() =>
												openVendorModal(vendor)}
											class="text-blue-400 hover:text-blue-300 mr-3"
											>Edit</button
										>
										<button
											on:click={() =>
												handleDeleteVendor(vendor)}
											class="text-red-400 hover:text-red-300"
											>Remove</button
										>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else if activeTab === "events"}
			<!-- Events Management -->
			<div class="space-y-6">
				<div class="flex justify-between items-center">
					<h2 class="text-2xl font-bold">Events Management</h2>
					<button
						on:click={() => openEventModal()}
						class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
					>
						Add Event
					</button>
				</div>

				<div
					class="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden"
				>
					<table class="w-full">
						<thead class="bg-gray-700/50">
							<tr>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Event</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Type</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Date & Time</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Guests</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Status</th
								>
								<th
									class="px-6 py-4 text-left text-sm font-medium text-gray-300"
									>Actions</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-700">
							{#each $events as event}
								<tr class="hover:bg-gray-700/30">
									<td class="px-6 py-4 text-sm text-white">
										{event.name}
									</td>
									<td
										class="px-6 py-4 text-sm text-gray-300 capitalize"
									>
										{event.event_type.replace("_", " ")}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										<div>{event.event_date}</div>
										<div class="text-xs text-gray-400">
											{event.start_time} - {event.end_time}
										</div>
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										{event.guest_count || "TBD"} guests
									</td>
									<td class="px-6 py-4 text-sm">
										<span
											class="px-2 py-1 rounded-full text-xs {event.status ===
											'confirmed'
												? 'bg-green-900/50 text-green-300'
												: event.status === 'inquiry'
												? 'bg-blue-900/50 text-blue-300'
												: event.status === 'completed'
												? 'bg-gray-900/50 text-gray-300'
												: 'bg-red-900/50 text-red-300'}"
										>
											{event.status}
										</span>
									</td>
									<td class="px-6 py-4 text-sm">
										<button
											on:click={() =>
												openEventModal(event)}
											class="text-blue-400 hover:text-blue-300 mr-3"
											>Edit</button
										>
										<button
											on:click={() =>
												handleDeleteEvent(event)}
											class="text-red-400 hover:text-red-300"
											>Cancel</button
										>
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
					{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} management
					coming soon...
				</p>
			</div>
		{/if}
	</main>
</div>

<!-- Import Modal -->
<ImportModal bind:isOpen={showImportModal} on:close={closeImportModal} />

<!-- Inventory Modal -->
<InventoryModal
	bind:isOpen={showInventoryModal}
	bind:editItem={editInventoryItem}
	on:close={closeInventoryModal}
	on:success={closeInventoryModal}
/>

<!-- Staff Modal -->
<StaffModal
	bind:isOpen={showStaffModal}
	bind:editItem={editStaffItem}
	on:close={closeStaffModal}
	on:success={closeStaffModal}
/>

<!-- Shift Modal -->
<ShiftModal
	bind:isOpen={showShiftModal}
	bind:editItem={editShiftItem}
	on:close={closeShiftModal}
	on:success={closeShiftModal}
/>

<!-- Menu Modal -->
<MenuModal
	bind:isOpen={showMenuModal}
	bind:editItem={editMenuItem}
	on:close={closeMenuModal}
	on:success={closeMenuModal}
/>

<!-- Vendor Modal -->
<VendorModal
	bind:isOpen={showVendorModal}
	bind:editItem={editVendorItem}
	on:close={closeVendorModal}
	on:success={closeVendorModal}
/>

<!-- Event Modal -->
<EventModal
	bind:isOpen={showEventModal}
	bind:editItem={editEventItem}
	on:close={closeEventModal}
	on:success={closeEventModal}
/>
