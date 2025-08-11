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
		maintenanceTasks,
		maintenanceSchedules,
		maintenanceRecords,
		sections,
		tables,
		tableUpdates,
		tickets,
		ticketItems,
		spoils,
		loading,
	} from "$lib/stores/collections.js";
	import ImportModal from "$lib/components/ImportModal.svelte";
	import InventoryModal from "$lib/components/InventoryModal.svelte";
	import StaffModal from "$lib/components/StaffModal.svelte";
	import ShiftModal from "$lib/components/ShiftModal.svelte";
	import MenuModal from "$lib/components/MenuModal.svelte";
	import VendorModal from "$lib/components/VendorModal.svelte";
	import EventModal from "$lib/components/EventModal.svelte";
	import MaintenanceModal from "$lib/components/MaintenanceModal.svelte";
	import ScheduleProposeModal from "$lib/components/ScheduleProposeModal.svelte";
	let showScheduleModal = false;

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
	let showMaintenanceModal = false;
	let editMaintenanceItem = null;
	let maintenanceFilter = "all"; // For maintenance task filtering
	let floorPlanFilter = "all"; // For floor plan filtering
	let filteredSections = []; // Filtered sections based on floor plan filter
	let showDetailedMenuView = false; // For detailed menu items view

	// Menu filtering system variables
	let selectedMenuCategories = {
		brunch: false,
		lunch: false,
		dinner: true,    // Default checked
		wine: true,      // Default checked
		cocktails: true, // Default checked
		mocktails: true, // Default checked
		happy_hour: false,
		beer: true,      // Default checked
		desserts: false
	};
	let menuSearchQuery = '';
	let showMenuFilters = false; // Collapsed by default
	let menuQuickFilter = 'all'; // Default to show all categories

	// Voice search state
	let speechSupported = false;
	let recognition = null;
	let isRecordingSearch = false;

	// Persist manager menu filter preferences and init speech
	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem('mgrMenuSelectedCategories') || 'null');
			if (saved && typeof saved === 'object') selectedMenuCategories = { ...selectedMenuCategories, ...saved };
			const savedShow = localStorage.getItem('mgrMenuShowFilters');
			if (savedShow !== null) showMenuFilters = savedShow === 'true';
			const savedQuick = localStorage.getItem('mgrMenuQuickFilter');
			if (savedQuick) menuQuickFilter = savedQuick;
		} catch (e) {
			console.warn('Could not load manager menu filter prefs:', e);
		}
		// Setup Web Speech API if available
		if (typeof window !== 'undefined') {
			const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
			if (SpeechRecognition) {
				try {
					recognition = new SpeechRecognition();
					recognition.lang = 'en-US';
					recognition.continuous = false;
					recognition.interimResults = false;
					recognition.onresult = (event) => {
						const transcript = event.results?.[0]?.[0]?.transcript || '';
						if (transcript) menuSearchQuery = transcript;
						isRecordingSearch = false;
					};
					recognition.onerror = (event) => {
						console.error('Speech recognition error:', event);
						isRecordingSearch = false;
					};
					speechSupported = true;
				} catch (err) {
					console.warn('Speech recognition setup failed:', err);
				}
			}
		}
	});
	$: if (typeof window !== 'undefined') {
		localStorage.setItem('mgrMenuSelectedCategories', JSON.stringify(selectedMenuCategories));
		localStorage.setItem('mgrMenuShowFilters', String(showMenuFilters));
		localStorage.setItem('mgrMenuQuickFilter', String(menuQuickFilter));
	}

	function startVoiceSearch() {
		if (!recognition) return;
		try {
			isRecordingSearch = true;
			recognition.start();
		} catch (e) {
			console.warn('Failed to start voice search:', e);
			isRecordingSearch = false;
		}
	}
	function stopVoiceSearch() {
		if (!recognition) return;
		try { recognition.stop(); } catch {}
		isRecordingSearch = false;
	}

	// Menu filter categories
	const menuFilterCategories = [
	{ id: 'brunch', label: 'Brunch', icon: '🥐' },
	{ id: 'lunch', label: 'Lunch', icon: '🥗' },
	{ id: 'dinner', label: 'Dinner', icon: '🍽️' },
	{ id: 'wine', label: 'Wine', icon: '🍷' },
	{ id: 'cocktails', label: 'Cocktails', icon: '🍸' },
	{ id: 'mocktails', label: 'Mocktails', icon: '🥤' },
	{ id: 'happy_hour', label: 'Happy Hour', icon: '🍻' },
	{ id: 'beer', label: 'Beer', icon: '🍺' },
		{ id: 'desserts', label: 'Desserts', icon: '🍰' }
];

	// Quick filter categories
	const menuQuickFilterCategories = [
	{ id: 'all', label: 'All Defaults', icon: '📋' },
	{ id: 'brunch', label: 'Brunch', icon: '🥐' },
	{ id: 'lunch', label: 'Lunch', icon: '🥗' },
	{ id: 'dinner', label: 'Dinner', icon: '🍽️' },
	{ id: 'wine', label: 'Wine', icon: '🍷' },
	{ id: 'cocktails', label: 'Cocktails', icon: '🍸' },
	{ id: 'mocktails', label: 'Mocktails', icon: '🥤' },
	{ id: 'happy_hour', label: 'Happy Hour', icon: '🍻' },
	{ id: 'beer', label: 'Beer', icon: '🍺' },
		{ id: 'desserts', label: 'Desserts', icon: '🍰' }
];
	let selectedMenuCategory = "all"; // Filter for menu categories

	// Bulk edit state for menu items
	let selectedMenuIds = new Set();
	let bulkCategory = 'beverage';
	let isBulkUpdating = false;
	
	function toggleSelectMenuItem(id) {
		if (selectedMenuIds.has(id)) {
			selectedMenuIds.delete(id);
		} else {
			selectedMenuIds.add(id);
		}
		// force reactivity with Set
		selectedMenuIds = new Set(selectedMenuIds);
	}
	function clearSelectedMenuItems() {
		selectedMenuIds = new Set();
	}
	function selectAllFilteredMenuItems() {
		selectedMenuIds = new Set(filteredMenuItems.map(i => i.id));
	}
	async function bulkUpdateMenuCategory() {
		if (selectedMenuIds.size === 0) return;
		isBulkUpdating = true;
		try {
			for (const id of selectedMenuIds) {
				await collections.updateMenuItem(id, { category: bulkCategory });
			}
			await collections.getMenuItems();
			clearSelectedMenuItems();
		} catch (e) {
			console.error('Bulk update failed', e);
			alert('Failed to bulk update categories.');
		} finally {
			isBulkUpdating = false;
		}
	}

	// Menu view navigation functions
	function showMenuDetails() {
		showDetailedMenuView = true;
	}
	
	function backToOverview() {
		showDetailedMenuView = false;
		selectedMenuCategory = "all";
	}

	// Get today's date in local timezone
	function getTodayString() {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function formatDate(dateStr) {
		// Parse as local date to avoid timezone issues
		const [year, month, day] = dateStr.split('-');
		const date = new Date(year, month - 1, day);
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	// Reactive declarations
	$: lowStockItems = $inventoryItems.filter(
		(item) => item.current_stock <= item.min_stock_level * 1.5
	);

	$: todayShifts = $shifts.filter(
		(shift) => shift.shift_date === getTodayString()
	);

	// Enhanced metrics
	$: upcomingEvents = $events.filter((event) => {
		const eventDate = new Date(event.event_date);
		const today = new Date();
		const nextWeek = new Date();
		nextWeek.setDate(today.getDate() + 7);
		return (
			eventDate >= today &&
			eventDate <= nextWeek &&
			event.status === "confirmed"
		);
	});

	$: totalMenuItems = $menuItems.length;
	$: availableMenuItems = $menuItems.filter((item) => item.available).length;
	$: activeStaff = $staff.filter((member) => member.status === "active")
		.length;
	$: pendingEvents = $events.filter((event) => event.status === "inquiry").length;

	// Helper for detailed view category matching (independent of defaults)
	function itemMatchesDetailedCategory(item, categoryId) {
		if (categoryId === 'all') return true;
		const category = (item.category || '').toLowerCase();
		const subcategory = (item.subcategory || '').toLowerCase();
		switch (categoryId) {
			case 'main_course':
				return category === 'main_course' || category === 'dinner';
			case 'beverage':
				return (
					category === 'beverage' ||
					category.includes('wine') || ['wine_red','wine_white','wine_sparkling'].includes(subcategory) ||
					category.includes('cocktail') || ['cocktail_classic','cocktail_signature','mocktail'].includes(subcategory) ||
					category.includes('beer') || ['beer_draft','beer_bottle'].includes(subcategory)
				);
			case 'dessert':
				return category === 'dessert' || category === 'desserts';
			default:
				return category === categoryId;
		}
	}

	// Menu filtering reactive statement
	$: filteredMenuItems = $menuItems.filter((item) => {
		// Search filter
		if (menuSearchQuery && !item.name.toLowerCase().includes(menuSearchQuery.toLowerCase())) {
			return false;
		}

		// If a detailed category chip is active, use it as the primary filter
		if (showDetailedMenuView && selectedMenuCategory !== 'all') {
			return itemMatchesDetailedCategory(item, selectedMenuCategory);
		}

		// Otherwise, apply defaults/quick filters like the Server dashboard
		let matchesDefaults;
		if (menuQuickFilter === 'all') {
			matchesDefaults = Object.keys(selectedMenuCategories).some(categoryId =>
				selectedMenuCategories[categoryId] && itemMatchesCategory(item, categoryId)
			);
		} else {
			matchesDefaults = itemMatchesCategory(item, menuQuickFilter);
		}
		if (!matchesDefaults) return false;

		return true;
	});

	// Weekly shifts calculation
	$: weeklyShifts = $shifts.filter((shift) => {
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
		.filter((event) => {
			const eventDate = new Date(event.event_date);
			const today = new Date();
			return (
				eventDate.getMonth() === today.getMonth() &&
				eventDate.getFullYear() === today.getFullYear() &&
				event.status === "confirmed"
			);
		})
		.reduce((total, event) => total + (event.estimated_revenue || 0), 0);

	// Mock maintenance data (until PocketBase collections are set up)


	// Maintenance calculations using real data
	$: displayMaintenanceTasks = $maintenanceTasks; // For compatibility with existing template
	$: filteredMaintenanceTasks = maintenanceFilter === "all" 
		? displayMaintenanceTasks 
		: displayMaintenanceTasks.filter(task => task.frequency === maintenanceFilter);
	$: overdueTasks = $maintenanceSchedules.filter(
		(schedule) => schedule.status === "overdue"
	);
	$: criticalTasks = $maintenanceTasks.filter(
		(task) => task.priority === "critical"
	);
	$: todayTasks = $maintenanceSchedules.filter((schedule) => {
		return schedule.scheduled_date === getTodayString();
	});
	$: pendingTasks = $maintenanceSchedules.filter(
		(schedule) => schedule.status === "pending"
	);
	$: completedTasks = $maintenanceSchedules.filter(
		(schedule) => schedule.status === "completed"
	);
	$: recentRecords = $maintenanceRecords.slice(-5); // Last 5 completed records
	
	// Urgent maintenance tasks
	$: urgentTasks = $maintenanceTasks.filter(task => 
		task.priority === 'urgent' || task.priority === 'high' || 
		(task.due_date && new Date(task.due_date) < new Date())
	);

	// Table management reactive declarations
	$: tablesBySection = $tables.reduce((acc, table) => {
		const section = table.section_code || 'unassigned';
		if (!acc[section]) acc[section] = [];
		acc[section].push(table);
		return acc;
	}, {});

	$: mainDiningTables = tablesBySection['A'] || [];
	$: sectionBTables = tablesBySection['B'] || [];
	$: patioTables = tablesBySection['P'] || [];
	$: barTables = tablesBySection['BAR'] || [];
	$: highTopTables = tablesBySection['HT'] || [];
	$: privateDiningTables = tablesBySection['PD'] || [];

	// Recent table updates (last 10)
	$: recentTableUpdates = $tableUpdates.slice(0, 10);

	// Get section by code
	function getSectionByCode(code) {
		return $sections.find(section => section.section_code === code);
	}

	// Get section icon by area type
	function getSectionIcon(areaType) {
		switch (areaType) {
			case 'dining':
			case 'dining_room': return '🍽️';
			case 'bar': return '🍺';
			case 'kitchen': return '👨‍🍳';
			case 'front': return '🏠';
			case 'admin': return '💼';
			case 'storage': return '📦';
			case 'outdoor':
			case 'patio': return '🌿';
			case 'private':
			case 'private_dining': return '🏛️';
			case 'other': return '📍';
			default: return '🏢';
		}
	}

	// Get section colors by area type
	function getSectionColors(areaType) {
		switch (areaType) {
			case 'dining':
			case 'dining_room': return { 
				gradient: 'from-green-900/50 to-green-800/30 border-green-700/50',
				badge: 'bg-green-900/50 text-green-300'
			};
			case 'bar': return { 
				gradient: 'from-purple-900/50 to-purple-800/30 border-purple-700/50',
				badge: 'bg-purple-900/50 text-purple-300'
			};
			case 'kitchen': return { 
				gradient: 'from-orange-900/50 to-orange-800/30 border-orange-700/50',
				badge: 'bg-orange-900/50 text-orange-300'
			};
			case 'front': return { 
				gradient: 'from-blue-900/50 to-blue-800/30 border-blue-700/50',
				badge: 'bg-blue-900/50 text-blue-300'
			};
			case 'admin': return { 
				gradient: 'from-gray-900/50 to-gray-800/30 border-gray-700/50',
				badge: 'bg-gray-900/50 text-gray-300'
			};
			case 'storage': return { 
				gradient: 'from-yellow-900/50 to-yellow-800/30 border-yellow-700/50',
				badge: 'bg-yellow-900/50 text-yellow-300'
			};
			case 'outdoor':
			case 'patio': return { 
				gradient: 'from-emerald-900/50 to-emerald-800/30 border-emerald-700/50',
				badge: 'bg-emerald-900/50 text-emerald-300'
			};
			case 'private':
			case 'private_dining': return { 
				gradient: 'from-blue-900/50 to-blue-800/30 border-blue-700/50',
				badge: 'bg-blue-900/50 text-blue-300'
			};
			case 'other': return { 
				gradient: 'from-gray-900/50 to-gray-800/30 border-gray-700/50',
				badge: 'bg-gray-900/50 text-gray-300'
			};
			default: return { 
				gradient: 'from-gray-900/50 to-gray-800/30 border-gray-700/50',
				badge: 'bg-gray-900/50 text-gray-300'
			};
		}
	}

	// Check if area type has tables vs work stations
	function isTableArea(areaType) {
		return ['dining', 'dining_room', 'bar', 'outdoor', 'patio', 'private', 'private_dining'].includes(areaType);
	}

	// Filter sections based on floor plan filter
	function getFilteredSections() {
		console.log('Filtering sections with filter:', floorPlanFilter);
		console.log('$sections exists:', !!$sections, 'length:', $sections?.length);
		console.log('Available sections:', $sections.map(s => ({ code: s.section_code, area_type: s.area_type })));
		
		if (!$sections || $sections.length === 0) {
			console.log('No sections available, returning empty array');
			return [];
		}
		
		let filtered;
		switch (floorPlanFilter) {
			case 'front':
				filtered = $sections.filter(section => 
					['dining', 'dining_room', 'bar', 'outdoor', 'patio', 'private', 'private_dining', 'front'].includes(section.area_type)
				);
				break;
			case 'back':
				filtered = $sections.filter(section => 
					['kitchen', 'admin', 'storage'].includes(section.area_type)
				);
				break;
			case 'tables':
				filtered = $sections.filter(section => isTableArea(section.area_type));
				break;
			case 'staff':
				// Show all sections but highlight those with staff assignments
				filtered = $sections;
				break;
			case 'all':
			default:
				filtered = $sections;
				break;
		}
		
		console.log('Filtered sections:', filtered.map(s => ({ code: s.section_code, area_type: s.area_type })));
		return filtered;
	}

	// Reactive filtered sections - recalculate when sections or filter changes
	$: {
		console.log('Reactive statement triggered. Sections:', $sections?.length || 0, 'Filter:', floorPlanFilter);
		filteredSections = getFilteredSections();
	}

	// Table status color helper
	function getTableStatusClasses(status) {
		switch (status) {
			case 'available': return {
				bg: 'bg-green-700/30',
				border: 'border-green-600/50',
				text: 'text-green-100',
				hover: 'hover:bg-green-600/40',
				indicator: 'bg-green-500',
				overlay: 'bg-green-600/20'
			};
			case 'occupied': return {
				bg: 'bg-yellow-700/30',
				border: 'border-yellow-600/50',
				text: 'text-yellow-100',
				hover: 'hover:bg-yellow-600/40',
				indicator: 'bg-yellow-500',
				overlay: 'bg-yellow-600/20'
			};
			case 'reserved': return {
				bg: 'bg-red-700/30',
				border: 'border-red-600/50',
				text: 'text-red-100',
				hover: 'hover:bg-red-600/40',
				indicator: 'bg-red-500',
				overlay: 'bg-red-600/20'
			};
			case 'cleaning': return {
				bg: 'bg-gray-700/30',
				border: 'border-gray-600/50',
				text: 'text-gray-100',
				hover: 'hover:bg-gray-600/40',
				indicator: 'bg-gray-500',
				overlay: 'bg-gray-600/20'
			};
			case 'out_of_order': return {
				bg: 'bg-purple-700/30',
				border: 'border-purple-600/50',
				text: 'text-purple-100',
				hover: 'hover:bg-purple-600/40',
				indicator: 'bg-purple-500',
				overlay: 'bg-purple-600/20'
			};
			default: return {
				bg: 'bg-gray-700/30',
				border: 'border-gray-600/50',
				text: 'text-gray-100',
				hover: 'hover:bg-gray-600/40',
				indicator: 'bg-gray-500',
				overlay: 'bg-gray-600/20'
			};
		}
	}

	// Table status icon helper
	function getTableStatusIcon(status) {
		switch (status) {
			case 'available': return '✓';
			case 'occupied': return '👥';
			case 'reserved': return '📅';
			case 'cleaning': return '🧹';
			case 'out_of_order': return '⚠️';
			default: return '?';
		}
	}

	onMount(async () => {
		let hasLoaded = false; // Prevent duplicate data loading
		let hasHandledAuth = false; // Prevent redirect loops/stutter
		
		// Check authentication and role
		const unsubscribe = authStore.subscribe(async (auth) => {
			// Wait for auth to finish loading or if we've already handled redirect
			if (auth.isLoading || hasHandledAuth) {
				return;
			}
			
			if (!auth.isLoggedIn) {
				hasHandledAuth = true;
				goto("/");
				return;
			}

			const userRole = auth.role?.toLowerCase();
			if (
				auth.isLoggedIn &&
				userRole !== "manager" &&
				userRole !== "owner"
			) {
				hasHandledAuth = true;
				goto("/dashboard");
				return;
			}

			if (auth.isLoggedIn && !hasLoaded) {
				hasLoaded = true;
				user = auth.user;
				// Load all data for managers
				try {
					await Promise.all([
						collections.getInventoryItems().catch(() => console.log("Inventory collection not yet set up")),
						collections.getStaff().catch(() => console.log("Staff collection not yet set up")),
						collections.getShifts().catch(() => console.log("Shifts collection not yet set up")),
						collections.getMenuItems().catch(() => console.log("Menu collection not yet set up")),
						collections.getVendors().catch(() => console.log("Vendors collection not yet set up")),
						collections.getEvents().catch(() => console.log("Events collection not yet set up")),
						collections.getTickets().catch(() => console.log("Tickets collection not yet set up")),
						collections.getTicketItems().catch(() => console.log("Ticket items collection not yet set up")),
						collections.getSpoils().catch(() => console.log("Spoils collection not yet set up")),
						// Load table management data if collections exist
						collections
							.getSections()
							.catch((error) => {
								console.error("Error loading sections:", error);
								console.log("Sections collection not yet set up");
							}),
						collections
							.getTables()
							.catch(() =>
								console.log(
									"Tables collection not yet set up"
								)
							),
						collections
							.getTableUpdates()
							.catch(() =>
								console.log(
									"Table updates collection not yet set up"
								)
							),
						// Load maintenance data if collections exist
						collections
							.getMaintenanceTasks()
							.catch(() =>
								console.log(
									"Maintenance collections not yet set up"
								)
							),
						collections
							.getMaintenanceSchedules()
							.catch(() =>
								console.log(
									"Maintenance schedules not yet set up"
								)
							),
						collections
							.getMaintenanceRecords()
							.catch(() =>
								console.log(
									"Maintenance records not yet set up"
								)
							),
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

	// Menu filtering functions
	function handleMenuCategoryChange() {
		// Auto-switch to 'all' if current quick filter is not in selected defaults
		if (menuQuickFilter !== 'all' && !selectedMenuCategories[menuQuickFilter]) {
			menuQuickFilter = 'all';
		}
	}

	function handleMenuQuickFilterChange() {
		// Function handles radio button changes automatically through bind:group
	}

	// Function to check if an item matches the selected category filter
	function itemMatchesCategory(item, categoryId) {
		if (categoryId === 'all') return true;
		
		const category = item.category?.toLowerCase() || '';
		const subcategory = item.subcategory?.toLowerCase() || '';
		
		switch (categoryId) {
			case 'wine':
				return category.includes('wine') || ['wine_red', 'wine_white', 'wine_sparkling'].includes(subcategory);
			case 'cocktails':
				return category.includes('cocktail') || ['cocktail_classic', 'cocktail_signature'].includes(subcategory);
			case 'mocktails':
				return subcategory === 'mocktail';
			case 'beer':
				return category.includes('beer') || ['beer_draft', 'beer_bottle'].includes(subcategory);
			case 'dinner':
				return category === 'dinner' || category === 'main_course';
			case 'brunch':
				return category === 'brunch';
			case 'lunch':
				return category === 'lunch';
			case 'happy_hour':
				return category === 'happy_hour';
			case 'desserts':
				return category === 'dessert' || category === 'desserts';
			default:
				return category === categoryId;
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

	function openMaintenanceModal(item = null) {
		editMaintenanceItem = item;
		showMaintenanceModal = true;
	}

	function closeMaintenanceModal() {
		showMaintenanceModal = false;
		editMaintenanceItem = null;
	}

	async function handleDeleteMaintenance(item) {
		if (confirm(`Are you sure you want to delete "${item.task_name}"?`)) {
			try {
				await collections.deleteMaintenanceTask(item.id);
				await collections.getMaintenanceTasks(); // Refresh data
			} catch (error) {
				console.error("Error deleting maintenance task:", error);
				alert("Failed to delete maintenance task");
			}
		}
	}

	// Helper functions for date and time formatting
	function formatShortDate(dateString) {
		// Handle both "YYYY-MM-DD" and "YYYY-MM-DD HH:MM:SS" formats
		const dateOnly = dateString.split(' ')[0]; // Remove time if present
		const [year, month, day] = dateOnly.split('-');
		const date = new Date(year, month - 1, day);
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

	// Helper to get section name by ID
	function getSectionName(sectionId) {
		if (!sectionId || !$sections) return null;
		const section = $sections.find(s => s.id === sectionId);
		return section ? section.section_name : null;
	}

	// Helper to get staff member name
	function getStaffMemberName(shift) {
		if (shift.expand?.staff_member?.first_name && shift.expand?.staff_member?.last_name) {
			return `${shift.expand.staff_member.first_name} ${shift.expand.staff_member.last_name}`;
		}
		return "Unassigned";
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
						on:click={logout}
						class="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm font-medium"
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
				{#each [{ id: "overview", name: "Overview", icon: "📊" }, { id: "floor-plan", name: "Floor Plan", icon: "🏗️" }, { id: "sections", name: "Section Assignments", icon: "🎯" }, { id: "maintenance", name: "Maintenance", icon: "🧹" }, { id: "inventory", name: "Inventory", icon: "📦" }, { id: "staff", name: "Staff", icon: "👥" }, { id: "shifts", name: "Shifts", icon: "🗓️" }, { id: "menu", name: "Menu", icon: "🍽️" }, { id: "vendors", name: "Vendors", icon: "🏢" }, { id: "events", name: "Events", icon: "🎉" }] as tab}
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
		{#if activeTab === "overview" && !showDetailedMenuView}
			<!-- Overview Dashboard -->
			<div class="mb-8 flex justify-between items-center">
				<div>
					<h2 class="text-3xl font-bold">Manager Overview</h2>
				<p class="text-gray-400 mt-2">{formatDate(getTodayString())}</p>
					<p class="text-gray-400 mt-2">
						Monitor your restaurant operations at a glance
					</p>
				</div>
				<!-- Quick Actions -->
				<div class="flex space-x-3">
					<button
						on:click={() => openMaintenanceModal()}
						class="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-medium transition-colors"
					>
						+ Maintenance
					</button>
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
					<button
						on:click={openImportModal}
						class="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
					>
						<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 11-2 0V4H5v5a1 1 0 11-2 0V3zm6.293 6.293a1 1 0 011.414 0L12 10.586V6a1 1 0 112 0v4.586l1.293-1.293a1 1 0 111.414 1.414l-3.999 4a1 1 0 01-1.415 0l-4-4a1 1 0 010-1.414zM4 15a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" clip-rule="evenodd" />
						</svg>
						Import Data
					</button>
				</div>
</div>

<ScheduleProposeModal bind:open={showScheduleModal} on:approved={() => collections.getShifts()} />

			<!-- Enhanced Key Metrics -->
			<div
				class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
			>
				<!-- Active Staff -->
				<div
					class="bg-gradient-to-br from-blue-900/50 to-blue-800/30 backdrop-blur-sm rounded-xl border border-blue-700/50 p-6"
				>
					<div class="flex items-center justify-between">
						<div>
							<p class="text-blue-200 text-sm font-medium">
								Active Staff
							</p>
							<p class="text-3xl font-bold text-white">
								{activeStaff}
							</p>
							<p class="text-blue-300 text-xs mt-1">
								of {$staff.length} total
							</p>
						</div>
						<div
							class="w-14 h-14 rounded-xl bg-blue-600/30 flex items-center justify-center"
						>
							<span class="text-2xl">👥</span>
						</div>
					</div>
				</div>

				<!-- This Week's Shifts -->
				<div
					class="bg-gradient-to-br from-green-900/50 to-green-800/30 backdrop-blur-sm rounded-xl border border-green-700/50 p-6"
				>
					<div class="flex items-center justify-between">
						<div>
							<p class="text-green-200 text-sm font-medium">
								This Week
							</p>
							<p class="text-3xl font-bold text-white">
								{weeklyShifts.length}
							</p>
							<p class="text-green-300 text-xs mt-1">
								{todayShifts.length} today
							</p>
						</div>
						<div
							class="w-14 h-14 rounded-xl bg-green-600/30 flex items-center justify-center"
						>
							<span class="text-2xl">🗓️</span>
						</div>
					</div>
				</div>

				<!-- Kitchen Display -->
				<a href="/dashboard/kitchen" class="bg-gradient-to-br from-orange-900/50 to-orange-800/30 backdrop-blur-sm rounded-xl border border-orange-700/50 p-6 block">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-orange-200 text-sm font-medium">Kitchen Display</p>
							<p class="text-xs text-orange-300 mt-1">View live kitchen orders</p>
						</div>
						<div class="flex items-center gap-3">
							<span class="px-2 py-1 text-xs rounded-full bg-orange-900/50 text-orange-300 border border-orange-700/50">
								{($ticketItems.filter(i => (i.status === 'sent_to_kitchen' || i.status === 'preparing') && i.kitchen_station !== 'bar')).length} pending
							</span>
							<div class="w-14 h-14 rounded-xl bg-orange-600/30 flex items-center justify-center">
								<span class="text-2xl">🍳</span>
							</div>
						</div>
					</div>
				</a>

				<!-- Bar Display -->
				<a href="/dashboard/bar" class="bg-gradient-to-br from-blue-900/50 to-blue-800/30 backdrop-blur-sm rounded-xl border border-blue-700/50 p-6 block">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-blue-200 text-sm font-medium">Bar Display</p>
							<p class="text-xs text-blue-300 mt-1">View live drink orders</p>
						</div>
						<div class="flex items-center gap-3">
							<span class="px-2 py-1 text-xs rounded-full bg-blue-900/50 text-blue-300 border border-blue-700/50">
								{($ticketItems.filter(i => (i.status === 'sent_to_bar' || i.status === 'preparing') && i.kitchen_station === 'bar')).length} pending
							</span>
							<div class="w-14 h-14 rounded-xl bg-blue-600/30 flex items-center justify-center">
								<span class="text-2xl">🍹</span>
							</div>
						</div>
					</div>
				</a>

				<!-- Spoils -->
				<a href="/dashboard/spoils" class="bg-gradient-to-br from-red-900/50 to-red-800/30 backdrop-blur-sm rounded-xl border border-red-700/50 p-6 block">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-red-200 text-sm font-medium">Spoils & Incidents</p>
							<p class="text-xs text-red-300 mt-1">Report and review losses</p>
						</div>
						<div class="flex items-center gap-3">
							<span class="px-2 py-1 text-xs rounded-full bg-red-900/50 text-red-300 border border-red-700/50">
								{($spoils.filter(s => s.status === 'open')).length} open
							</span>
							<div class="w-14 h-14 rounded-xl bg-red-600/30 flex items-center justify-center">
								<span class="text-2xl">📉</span>
							</div>
						</div>
					</div>
				</a>

				<!-- Inventory Alert -->
				<div
					class="bg-gradient-to-br from-orange-900/50 to-orange-800/30 backdrop-blur-sm rounded-xl border border-orange-700/50 p-6"
				>
					<div class="flex items-center justify-between">
						<div>
							<p class="text-orange-200 text-sm font-medium">
								Stock Alerts
							</p>
							<p class="text-3xl font-bold text-white">
								{lowStockItems.length}
							</p>
							<p class="text-orange-300 text-xs mt-1">
								need restocking
							</p>
						</div>
						<div
							class="w-14 h-14 rounded-xl bg-orange-600/30 flex items-center justify-center"
						>
							<span class="text-2xl">⚠️</span>
						</div>
					</div>
				</div>

				<!-- Monthly Revenue -->
				<div
					class="bg-gradient-to-br from-purple-900/50 to-purple-800/30 backdrop-blur-sm rounded-xl border border-purple-700/50 p-6"
				>
					<div class="flex items-center justify-between">
						<div>
							<p class="text-purple-200 text-sm font-medium">
								Est. Revenue
							</p>
							<p class="text-3xl font-bold text-white">
								${monthlyRevenue.toLocaleString()}
							</p>
							<p class="text-purple-300 text-xs mt-1">
								this month
							</p>
						</div>
						<div
							class="w-14 h-14 rounded-xl bg-purple-600/30 flex items-center justify-center"
						>
							<span class="text-2xl">💰</span>
						</div>
					</div>
				</div>

				<!-- Menu Status -->
				<button
					on:click={showMenuDetails}
					class="bg-gradient-to-br from-teal-900/50 to-teal-800/30 backdrop-blur-sm rounded-xl border border-teal-700/50 p-6 hover:from-teal-800/60 hover:to-teal-700/40 transition-all duration-200 w-full text-left"
				>
					<div class="flex items-center justify-between">
						<div>
							<p class="text-teal-200 text-sm font-medium">
								Menu Items
							</p>
							<p class="text-3xl font-bold text-white">
								{availableMenuItems}
							</p>
							<p class="text-teal-300 text-xs mt-1">
								of {totalMenuItems} available
							</p>
						</div>
						<div
							class="w-14 h-14 rounded-xl bg-teal-600/30 flex items-center justify-center"
						>
							<span class="text-2xl">🍽️</span>
						</div>
					</div>
				</button>

				<!-- Upcoming Events -->
				<div
					class="bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 backdrop-blur-sm rounded-xl border border-indigo-700/50 p-6"
				>
					<div class="flex items-center justify-between">
						<div>
							<p class="text-indigo-200 text-sm font-medium">
								Next Week
							</p>
							<p class="text-3xl font-bold text-white">
								{upcomingEvents.length}
							</p>
							<p class="text-indigo-300 text-xs mt-1">
								confirmed events
							</p>
						</div>
						<div
							class="w-14 h-14 rounded-xl bg-indigo-600/30 flex items-center justify-center"
						>
							<span class="text-2xl">📅</span>
						</div>
					</div>
				</div>

				<!-- Pending Inquiries -->
				<div
					class="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 backdrop-blur-sm rounded-xl border border-yellow-700/50 p-6"
				>
					<div class="flex items-center justify-between">
						<div>
							<p class="text-yellow-200 text-sm font-medium">
								Pending
							</p>
							<p class="text-3xl font-bold text-white">
								{pendingEvents}
							</p>
							<p class="text-yellow-300 text-xs mt-1">
								event inquiries
							</p>
						</div>
						<div
							class="w-14 h-14 rounded-xl bg-yellow-600/30 flex items-center justify-center"
						>
							<span class="text-2xl">❓</span>
						</div>
					</div>
				</div>

				<!-- Weekly Performance -->
				<div
					class="bg-gradient-to-br from-cyan-900/50 to-cyan-800/30 backdrop-blur-sm rounded-xl border border-cyan-700/50 p-6"
				>
					<div class="flex items-center justify-between">
						<div>
							<p class="text-cyan-200 text-sm font-medium">
								Operations
							</p>
							<p class="text-3xl font-bold text-white">
								{Math.round(
									(activeStaff / Math.max($staff.length, 1)) *
										100
								)}%
							</p>
							<p class="text-cyan-300 text-xs mt-1">
								staff efficiency
							</p>
						</div>
						<div
							class="w-14 h-14 rounded-xl bg-cyan-600/30 flex items-center justify-center"
						>
							<span class="text-2xl">📊</span>
						</div>
					</div>
				</div>

				<!-- Maintenance Alerts -->
				<div
					class="bg-gradient-to-br from-red-900/50 to-red-800/30 backdrop-blur-sm rounded-xl border border-red-700/50 p-6"
				>
					<div class="flex items-center justify-between">
						<div>
							<p class="text-red-200 text-sm font-medium">
								Maintenance
							</p>
							<p class="text-3xl font-bold text-white">
								{overdueTasks.length}
							</p>
							<p class="text-red-300 text-xs mt-1">
								overdue tasks
							</p>
						</div>
						<div
							class="w-14 h-14 rounded-xl bg-red-600/30 flex items-center justify-center"
						>
							<span class="text-2xl">🔧</span>
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
						Stock Alerts
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
											{item.name}
										</p>
										<p class="text-sm text-gray-400">
											Current: {item.current_stock}
											{item.unit} / {item.min_stock_level}
											min
										</p>
									</div>
									<span class="text-orange-400 font-bold">
										{item.current_stock <=
										item.min_stock_level
											? "LOW"
											: "WARNING"}
									</span>
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

				<!-- Maintenance Overview -->
				<div
					class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6"
				>
					<h3 class="text-xl font-bold mb-4 flex items-center">
						<span class="mr-2">🔧</span>
						Maintenance Status
					</h3>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
						<!-- Overdue -->
						<div class="bg-red-900/20 rounded-lg border border-red-700/30 p-4">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-red-200 text-sm font-medium">Overdue</p>
									<p class="text-2xl font-bold text-red-300">{overdueTasks.length}</p>
								</div>
								<span class="text-red-400 text-xl">🚨</span>
							</div>
						</div>
						<!-- Pending -->
						<div class="bg-yellow-900/20 rounded-lg border border-yellow-700/30 p-4">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-yellow-200 text-sm font-medium">Pending</p>
									<p class="text-2xl font-bold text-yellow-300">{pendingTasks.length}</p>
								</div>
								<span class="text-yellow-400 text-xl">⏳</span>
							</div>
						</div>
						<!-- Completed Today -->
						<div class="bg-green-900/20 rounded-lg border border-green-700/30 p-4">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-green-200 text-sm font-medium">Completed</p>
									<p class="text-2xl font-bold text-green-300">{completedTasks.length}</p>
								</div>
								<span class="text-green-400 text-xl">✅</span>
							</div>
						</div>
					</div>

					{#if overdueTasks.length > 0}
						<div class="mb-4">
							<h4 class="text-lg font-semibold text-red-300 mb-3">🚨 Overdue Tasks</h4>
							<div class="space-y-2">
								{#each overdueTasks.slice(0, 3) as task}
									<div class="bg-red-900/10 border border-red-700/20 rounded-lg p-3">
										<div class="flex justify-between items-center">
											<div>
												<p class="font-medium text-red-200">{task.task_name}</p>
												<p class="text-sm text-red-300">Due: {task.scheduled_date}</p>
											</div>
											<button 
												on:click={() => openMaintenanceModal()}
												class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
											>
												Reschedule
											</button>
										</div>
									</div>
								{/each}
								{#if overdueTasks.length > 3}
									<p class="text-sm text-gray-400 text-center">
										and {overdueTasks.length - 3} more overdue tasks...
									</p>
								{/if}
							</div>
						</div>
					{/if}

					{#if recentRecords.length > 0}
						<div>
							<h4 class="text-lg font-semibold text-green-300 mb-3">✅ Recent Completions</h4>
							<div class="space-y-2">
								{#each recentRecords as record}
									<div class="bg-green-900/10 border border-green-700/20 rounded-lg p-3">
										<div class="flex justify-between items-start">
											<div class="flex-1">
												<p class="font-medium text-green-200">{record.task_name}</p>
												<p class="text-sm text-green-300">
													Completed by {record.completed_by} on {record.completed_date}
												</p>
												{#if record.completion_notes}
													<p class="text-xs text-gray-400 mt-1">{record.completion_notes}</p>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === "overview" && showDetailedMenuView}
			<!-- Detailed Menu Items View -->
			<div class="mb-8 flex justify-between items-center">
				<div>
					<h2 class="text-3xl font-bold">Menu Items</h2>
					<p class="text-gray-400 mt-2">Detailed view of all menu items organized by category</p>
				</div>
				<!-- Actions -->
				<div class="flex space-x-3">
					<button
						on:click={backToOverview}
						class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
					>
						← Back to Overview
					</button>
					<button
						on:click={() => openMenuModal()}
						class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
					>
						+ Add Item
					</button>
				</div>
			</div>

			<!-- Category Filter -->
			<div class="mb-6">
				{#key 'detailed-categories'}
					{@const detailedCategories = [
						{ id: 'all', label: 'All Categories', icon: '🍴' },
						{ id: 'brunch', label: 'Brunch', icon: '🥐' },
						{ id: 'lunch', label: 'Lunch', icon: '🥗' },
						{ id: 'dinner', label: 'Dinner', icon: '🍽️' },
						{ id: 'happy_hour', label: 'Happy Hour', icon: '🍻' },
						{ id: 'wine', label: 'Wine', icon: '🍷' },
						{ id: 'cocktails', label: 'Cocktails', icon: '🍸' },
						{ id: 'mocktails', label: 'Mocktails', icon: '🥤' },
						{ id: 'beer', label: 'Beer', icon: '🍺' },
						{ id: 'desserts', label: 'Desserts', icon: '🍰' },
					]}
					<div class="flex flex-wrap gap-2">
						{#each detailedCategories as cat}
							<button
								on:click={() => selectedMenuCategory = cat.id}
								class="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 {selectedMenuCategory === cat.id ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
							>
								<span>{cat.icon}</span>
								<span>{cat.label}</span>
							</button>
						{/each}
					</div>
					{/key}
					</div>

					<!-- Search Input -->
				<div class="mt-4 relative">
					<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
					</div>
					<input
						type="text"
						bind:value={menuSearchQuery}
						placeholder="Search menu items..."
						class="w-full pl-10 pr-12 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					>
					{#if speechSupported}
						<button
							type="button"
							on:click={() => (isRecordingSearch ? stopVoiceSearch() : startVoiceSearch())}
							class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors duration-200 {isRecordingSearch ? 'bg-red-600 text-white animate-pulse' : 'text-gray-400 hover:text-white hover:bg-gray-600'}"
							title="Voice search"
						>
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd"></path>
							</svg>
						</button>
					{/if}
				</div>

				<!-- Bulk actions toolbar -->
				{#if selectedMenuIds.size > 0}
				<div class="mb-4 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg flex flex-wrap items-center gap-3">
				<span class="text-sm text-blue-200 font-medium">{selectedMenuIds.size} selected</span>
				<button class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded" on:click={selectAllFilteredMenuItems}>Select all shown</button>
				<button class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded" on:click={clearSelectedMenuItems}>Clear</button>
				<div class="flex items-center gap-2">
				<label class="text-sm text-gray-300">Set category to</label>
							<select bind:value={bulkCategory} class="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm">
								<option value="appetizer">Appetizer</option>
								<option value="main_course">Main Course</option>
								<option value="dessert">Dessert</option>
								<option value="beverage">Beverage</option>
								<option value="special">Special</option>
								<option value="side_dish">Side Dish</option>
							</select>
							<button on:click={bulkUpdateMenuCategory} disabled={isBulkUpdating} class="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-white text-sm">
								{isBulkUpdating ? 'Updating…' : 'Update Category'}
							</button>
						</div>
					</div>
				{/if}

				<!-- Menu Items Grid -->
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{#each filteredMenuItems as item}
						{@const cat = (item.category || '').toLowerCase()}
						<div class="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6 hover:border-gray-600/50 transition-all">
							<div class="flex justify-between items-start mb-4">
								<div class="flex-1">
									<div class="flex items-center gap-2 mb-1">
										<input type="checkbox" checked={selectedMenuIds.has(item.id)} on:change={() => toggleSelectMenuItem(item.id)} class="h-4 w-4 text-blue-600 rounded border-gray-600 bg-gray-700" />
										<h3 class="text-lg font-semibold text-white">{item.name}</h3>
									</div>
								<p class="text-sm text-gray-400 mb-2">{item.description || 'No description available'}</p>
								<div class="flex items-center gap-2 mb-2">

									<span class="px-2 py-1 rounded text-xs font-medium flex items-center gap-1 {
										cat === 'brunch' ? 'bg-amber-900/40 text-amber-300' :
										cat === 'lunch' ? 'bg-lime-900/40 text-lime-300' :
										cat === 'dinner' ? 'bg-red-900/40 text-red-300' :
										cat === 'happy_hour' ? 'bg-yellow-900/40 text-yellow-300' :
										cat === 'wine' ? 'bg-rose-900/40 text-rose-300' :
										cat === 'cocktails' ? 'bg-fuchsia-900/40 text-fuchsia-300' :
										cat === 'beer' ? 'bg-orange-900/40 text-orange-300' :
										cat === 'desserts' ? 'bg-purple-900/40 text-purple-300' :
										'bg-gray-900/50 text-gray-300'
									}">
										<span>
											{cat === 'brunch' ? '🥐' :
											 cat === 'lunch' ? '🥗' :
											 cat === 'dinner' ? '🍽️' :
											 cat === 'happy_hour' ? '🍻' :
											 cat === 'wine' ? '🍷' :
											 cat === 'cocktails' ? '🍸' :
											 cat === 'beer' ? '🍺' :
											 cat === 'desserts' ? '🍰' : '🍴'}
										</span>
										<span class="capitalize">{(item.category || 'uncategorized').replace('_', ' ')}</span>
									</span>
									<span class="px-2 py-1 rounded text-xs font-medium {item.available ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}">
										{item.available ? 'Available' : 'Unavailable'}
									</span>
								</div>
								<p class="text-xl font-bold text-green-400">${item.price?.toFixed(2) || '0.00'}</p>
							</div>
							<div class="flex flex-col gap-2 ml-4">
								<button
									on:click={() => openMenuModal(item)}
									class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors"
								>
									Edit
								</button>
								<button
									on:click={() => {
										if (confirm(`Toggle availability for ${item.name}?`)) {
											collections.updateMenuItem(item.id, { available: !item.available });
										}
									}}
									class="px-3 py-1 {item.available ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} rounded text-xs font-medium transition-colors"
								>
									{item.available ? 'Disable' : 'Enable'}
								</button>
							</div>
						</div>
						
						{#if item.allergens && item.allergens.length > 0}
							<div class="mt-3 pt-3 border-t border-gray-700">
								<p class="text-xs text-gray-500 mb-1">Allergens:</p>
								<div class="flex flex-wrap gap-1">
									{#each item.allergens as allergen}
										<span class="px-2 py-1 bg-orange-900/30 text-orange-300 rounded text-xs">
											{allergen}
										</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			{#if $menuItems.filter(item => selectedMenuCategory === "all" || item.category === selectedMenuCategory).length === 0}
				<div class="text-center py-12">
					<div class="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-800/50 flex items-center justify-center">
						<span class="text-4xl">🍽️</span>
					</div>
					<h3 class="text-xl font-semibold text-gray-300 mb-2">No Menu Items</h3>
					<p class="text-gray-500 mb-4">
						{selectedMenuCategory === "all" ? "No menu items found." : `No ${selectedMenuCategory} items found.`}
					</p>
					<button
						on:click={() => openMenuModal()}
						class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
					>
						Add First Item
					</button>
				</div>
			{/if}
		{:else if activeTab === "floor-plan"}
			<!-- Floor Plan -->
			<div class="mb-8 flex justify-between items-center">
				<div>
					<h2 class="text-3xl font-bold">Restaurant Floor Plan</h2>
					<p class="text-gray-400 mt-2">
						Visual layout of dining areas, bar, patio, and waiting area
					</p>
				</div>
			</div>

			<!-- Floor Plan Filter Tabs -->
			<div class="mb-6">
				<div class="flex space-x-1 p-1 bg-gray-700/30 rounded-lg max-w-4xl">
					<button
						on:click={() => floorPlanFilter = "all"}
						class="flex-1 py-3 px-4 text-sm font-medium rounded-md {floorPlanFilter === 'all' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600/30'} transition-colors"
					>
						<span class="mr-2">🏢</span>
						All Areas
					</button>
					<button
						on:click={() => {
							console.log('Setting filter to front');
							floorPlanFilter = "front";
						}}
						class="flex-1 py-3 px-4 text-sm font-medium rounded-md {floorPlanFilter === 'front' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600/30'} transition-colors"
					>
						<span class="mr-2">🍽️</span>
						Front of House
					</button>
					<button
						on:click={() => floorPlanFilter = "back"}
						class="flex-1 py-3 px-4 text-sm font-medium rounded-md {floorPlanFilter === 'back' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600/30'} transition-colors"
					>
						<span class="mr-2">👨‍🍳</span>
						Back of House
					</button>
					<button
						on:click={() => floorPlanFilter = "tables"}
						class="flex-1 py-3 px-4 text-sm font-medium rounded-md {floorPlanFilter === 'tables' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600/30'} transition-colors"
					>
						<span class="mr-2">🪑</span>
						Tables Only
					</button>
					<button
						on:click={() => floorPlanFilter = "staff"}
						class="flex-1 py-3 px-4 text-sm font-medium rounded-md {floorPlanFilter === 'staff' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600/30'} transition-colors"
					>
						<span class="mr-2">👥</span>
						Staff View
					</button>
				</div>
			</div>

			<!-- Debug Info -->
			<div class="mb-4 p-2 bg-gray-800/30 rounded text-xs text-gray-400">
				Current filter: {floorPlanFilter} | 
				Total sections: {$sections.length} | 
				Filtered sections: {filteredSections.length} |
				Available area types: {[...$sections.map(s => s.area_type)].join(', ')}
			</div>

			<!-- Floor Plan Container -->
			<div
				class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-8"
			>
				{#if $loading.sections || $loading.tables}
					<!-- Loading State -->
					<div class="flex items-center justify-center h-[600px]">
						<div class="text-center">
							<div class="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
							<p class="text-gray-400">Loading floor plan...</p>
						</div>
					</div>
				{:else}
					<!-- Dynamic Sections Grid -->
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[600px]">
						{#each filteredSections as section}
							{@const sectionTables = tablesBySection[section.section_code] || []}
							{@const sectionIcon = getSectionIcon(section.area_type)}
							{@const sectionColors = getSectionColors(section.area_type)}
							<div
								class="bg-gradient-to-br {sectionColors.gradient} rounded-lg border p-4 relative min-h-[280px]"
							>
								<!-- Section Header -->
								<div class="mb-4">
									<h3 class="text-white font-semibold text-lg flex items-center">
										<span class="mr-2">{sectionIcon}</span>
										{section.section_name}
									</h3>
									<p class="text-gray-300 text-sm">
										{section.section_code} • {section.area_type || 'Standard'} • 
										{#if isTableArea(section.area_type)}
											{sectionTables.length} tables
										{:else}
											0 tables
										{/if}
										{#if section.max_capacity}
											• Max {section.max_capacity} people
										{/if}
									</p>
								</div>

								{#if isTableArea(section.area_type)}
									<!-- Tables in Section -->
									<div class="grid grid-cols-3 gap-2 mb-4">
										{#each sectionTables.slice(0, 9) as table}
											{@const statusClasses = getTableStatusClasses(table.status)}
											<div
												class="{statusClasses.bg} rounded border {statusClasses.border} flex flex-col items-center justify-center relative group {statusClasses.hover} transition-colors cursor-pointer p-2 min-h-[60px]"
											>
												<span class="{statusClasses.text} text-xs font-medium"
													>{table.table_name}</span
												>
												<span class="{statusClasses.text} text-xs opacity-75">
													{table.capacity || 0}
												</span>
												<div
													class="absolute -top-1 -right-1 w-2 h-2 {statusClasses.indicator} rounded-full {table.status === 'available' ? 'animate-pulse' : ''}"
												></div>
												<div
													class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity {statusClasses.overlay} rounded flex items-center justify-center"
												>
													<span class="text-xs {statusClasses.text} text-center">
														{table.capacity || 0} seats<br>{table.status || 'Unknown'}
													</span>
												</div>
											</div>
										{/each}
										<!-- Show more indicator if there are additional tables -->
										{#if sectionTables.length > 9}
											<div class="bg-gray-700/30 rounded border border-gray-600/50 flex items-center justify-center p-2 min-h-[60px]">
												<span class="text-gray-400 text-xs">+{sectionTables.length - 9} more</span>
											</div>
										{/if}
									</div>

									<!-- Table Stats -->
									<div class="absolute bottom-4 left-4 right-4">
										<div class="flex justify-between text-xs text-gray-300">
											<span>Available: {sectionTables.filter(t => t.status === 'available').length}</span>
											<span>Occupied: {sectionTables.filter(t => t.status === 'occupied').length}</span>
											<span>Reserved: {sectionTables.filter(t => t.status === 'reserved').length}</span>
										</div>
									</div>
								{:else}
									<!-- Work Station Information -->
									<div class="flex-1 flex flex-col justify-center">
										<div class="text-center py-8">
											<div class="text-4xl mb-4">{getSectionIcon(section.area_type)}</div>
											<p class="text-gray-300 text-sm mb-4">{section.description || 'Work station area'}</p>
											
											<!-- Placeholder for future ticket/order integration -->
											<div class="grid grid-cols-2 gap-4 text-xs">
												<div class="bg-gray-700/30 rounded p-3">
													<div class="text-gray-400">Staff Assigned</div>
													<div class="text-white font-medium">Coming Soon</div>
												</div>
												<div class="bg-gray-700/30 rounded p-3">
													<div class="text-gray-400">Active Orders</div>
													<div class="text-white font-medium">Coming Soon</div>
												</div>
											</div>
										</div>
									</div>

									<!-- Work Station Stats -->
									<div class="absolute bottom-4 left-4 right-4">
										<div class="text-center text-xs text-gray-300">
											<span class="px-2 py-1 rounded-full {sectionColors.badge}">Work Station</span>
										</div>
									</div>
								{/if}
							</div>
						{/each}

						<!-- Empty state if no sections -->
						{#if filteredSections.length === 0}
							<div class="col-span-full flex items-center justify-center h-[400px] bg-gray-800/30 rounded-lg border-2 border-dashed border-gray-600">
								<div class="text-center">
									<span class="text-4xl mb-4 block">🏢</span>
									{#if $sections.length === 0}
										<h3 class="text-xl font-medium text-gray-300 mb-2">No sections found</h3>
										<p class="text-gray-400 mb-4">Import sections data to see the floor plan</p>
										<button
											on:click={openImportModal}
											class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
										>
											Import Sections
										</button>
									{:else}
										<h3 class="text-xl font-medium text-gray-300 mb-2">No {floorPlanFilter === 'front' ? 'front of house' : floorPlanFilter === 'back' ? 'back of house' : floorPlanFilter === 'tables' ? 'table' : floorPlanFilter} sections</h3>
										<p class="text-gray-400 mb-4">Try selecting a different filter above</p>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Recent Table Updates -->
			<div class="mt-8">
				<h3 class="text-2xl font-bold mb-4">Recent Table Activity</h3>
				<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
					{#if $loading.tableUpdates}
						<div class="flex items-center justify-center py-8">
							<div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
						</div>
					{:else if recentTableUpdates.length === 0}
						<div class="text-center py-8">
							<span class="text-4xl mb-4 block">📋</span>
							<h4 class="text-xl font-medium text-gray-300 mb-2">No recent activity</h4>
							<p class="text-gray-400">Table updates will appear here</p>
						</div>
					{:else}
						<div class="space-y-3">
							{#each recentTableUpdates as update}
								<div class="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg border border-gray-600/50">
									<div class="flex items-center space-x-4">
										<div class="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center">
											<span class="text-blue-300 font-medium text-sm">{update.table_name}</span>
										</div>
										<div>
											<p class="text-white font-medium">
												{update.action_type || 'Update'} - Table {update.table_name}
											</p>
											<p class="text-gray-400 text-sm">
												{update.performed_by ? `by ${update.performed_by}` : 'Staff update'}
												{#if update.notes}
													• {update.notes}
												{/if}
											</p>
										</div>
									</div>
									<div class="text-gray-400 text-sm">
										{new Date(update.created).toLocaleTimeString()}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Floor Plan Legend -->
			<div class="mt-6 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
				<h4 class="text-lg font-medium mb-4">Legend</h4>
				<div class="flex flex-wrap gap-6 text-sm">
					<div class="flex items-center">
						<div class="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
						<span class="text-green-300">Available</span>
					</div>
					<div class="flex items-center">
						<div class="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
						<span class="text-yellow-300">Occupied</span>
					</div>
					<div class="flex items-center">
						<div class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
						<span class="text-red-300">Reserved</span>
					</div>
					<div class="flex items-center">
						<div class="w-3 h-3 bg-gray-500 rounded-full mr-2"></div>
						<span class="text-gray-300">Cleaning</span>
					</div>
					<div class="flex items-center">
						<div class="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
						<span class="text-purple-300">Out of Order</span>
					</div>
				</div>
			</div>
		{:else if activeTab === "sections"}
			<!-- Section Assignments -->
			<div class="mb-8 flex justify-between items-center">
				<div>
					<h2 class="text-3xl font-bold">Section Assignments</h2>
					<p class="text-gray-400 mt-2">
						Manage staff assignments to restaurant sections
					</p>
				</div>
			</div>



			<!-- Available Sections -->
			<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
				<h3 class="text-xl font-semibold mb-4">Available Sections</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{#each $sections as section}
						<div class="bg-gray-700/50 rounded-lg border border-gray-600 p-4">
							<div class="flex items-center justify-between mb-3">
								<div class="flex items-center space-x-2">
									<span class="text-lg">{getSectionIcon(section.area_type)}</span>
									<div>
										<h4 class="font-semibold text-white">{section.section_name}</h4>
										<p class="text-xs text-gray-400">{section.section_code} • {section.area_type}</p>
									</div>
								</div>
								<span class="px-2 py-1 text-xs rounded-full bg-gray-600 text-gray-300">
									Ready
								</span>
							</div>
							<p class="text-gray-400 text-sm">
								Tables: {section.table_count || 'N/A'} • Capacity: {section.max_capacity || 'N/A'}
							</p>
						</div>
					{/each}
				</div>
			</div>

		{:else if activeTab === "maintenance"}
			<!-- Maintenance & Cleaning -->
			<div class="mb-8 flex justify-between items-center">
				<div>
					<h2 class="text-3xl font-bold">Maintenance & Cleaning</h2>
					<p class="text-gray-400 mt-2">
						Manage cleaning schedules, equipment maintenance, and
						recurring services
					</p>
				</div>
				<div class="flex space-x-3">
					<button
						on:click={() => openMaintenanceModal()}
						class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
					>
						+ Schedule Task
					</button>
					<button
						class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
					>
						Mark Complete
					</button>
				</div>
			</div>

			<!-- Maintenance Overview Cards -->
			<div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
				<div
					class="bg-gradient-to-br from-red-900/50 to-red-800/30 backdrop-blur-sm rounded-xl border border-red-700/50 p-6"
				>
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-xl font-semibold text-red-200">
							Urgent Tasks
						</h3>
						<span class="text-2xl">🚨</span>
					</div>
					<div class="text-3xl font-bold text-red-100 mb-2">
						{urgentTasks.length}
					</div>
					<p class="text-red-200/80 text-sm">
						Requires immediate attention
					</p>
				</div>
			</div>

			<!-- Maintenance Tasks List -->
			<div class="space-y-6">
				<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
					<h3 class="text-xl font-semibold mb-4">Maintenance Tasks</h3>
					{#if $loading.maintenance}
						<div class="flex justify-center items-center h-32">
							<div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
						</div>
					{:else if $maintenanceTasks.length > 0}
						<div class="overflow-x-auto">
							<table class="w-full">
								<thead class="bg-gray-700/50">
									<tr>
										<th class="px-4 py-3 text-left text-sm font-medium text-gray-300">Task</th>
										<th class="px-4 py-3 text-left text-sm font-medium text-gray-300">Priority</th>
										<th class="px-4 py-3 text-left text-sm font-medium text-gray-300">Due Date</th>
										<th class="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
										<th class="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-700">
									{#each $maintenanceTasks as task}
										<tr class="hover:bg-gray-700/30">
											<td class="px-4 py-3 text-sm text-white">
												<div>
													<div class="font-medium">{task.task_name || 'Maintenance Task'}</div>
													{#if task.description}
														<div class="text-gray-400 text-xs">{task.description}</div>
													{/if}
												</div>
											</td>
											<td class="px-4 py-3 text-sm">
												<span class="px-2 py-1 rounded-full text-xs {task.priority === 'urgent' ? 'bg-red-900/50 text-red-300' : task.priority === 'high' ? 'bg-orange-900/50 text-orange-300' : task.priority === 'medium' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-gray-900/50 text-gray-300'}">
													{task.priority || 'medium'}
												</span>
											</td>
											<td class="px-4 py-3 text-sm text-gray-300">
												{task.due_date ? formatShortDate(task.due_date) : 'No due date'}
											</td>
											<td class="px-4 py-3 text-sm">
												<span class="px-2 py-1 rounded-full text-xs {task.status === 'completed' ? 'bg-green-900/50 text-green-300' : task.status === 'in_progress' ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-900/50 text-gray-300'}">
													{task.status || 'pending'}
												</span>
											</td>
											<td class="px-4 py-3 text-sm">
												<button
													on:click={() => openMaintenanceModal(task)}
													class="text-blue-400 hover:text-blue-300 mr-3"
												>
													Edit
												</button>
												<button
													on:click={() => handleDeleteMaintenance(task)}
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
					{:else}
						<div class="text-center py-8">
							<div class="text-gray-400 mb-4">No maintenance tasks scheduled</div>
							<button
								on:click={() => openMaintenanceModal()}
								class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
							>
								Schedule First Task
							</button>
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
					></div>
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
					<div class="flex items-center gap-2">
						<button
							on:click={() => openShiftModal()}
							class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
						>
							Schedule Shift
						</button>
						<button
							on:click={() => { console.log('open modal'); showScheduleModal = true; }}
							class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
						>
							AI Propose Week
						</button>
						{#if showScheduleModal}
							<span class="ml-2 text-teal-300 text-sm">Opening…</span>
						{/if}
					</div>
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
									>Section</th
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
										{getStaffMemberName(shift)}
									</td>
									<td class="px-6 py-4 text-sm text-gray-300">
										{#if shift.assigned_section && getSectionName(shift.assigned_section)}
											<span class="px-2 py-1 rounded-full text-xs bg-blue-900/50 text-blue-300">
												{getSectionName(shift.assigned_section)}
											</span>
										{:else}
											<span class="text-gray-500">No Section</span>
										{/if}
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

				<!-- Menu Filtering System -->
				<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
					<!-- Default Items Filtering (Multi-select checkboxes) -->
					<div class="mb-4">
						<button
							on:click={() => showMenuFilters = !showMenuFilters}
							class="flex items-center gap-2 text-lg font-semibold text-white hover:text-blue-400 transition-colors"
						>
							<span>⚙️</span>
							<span>Default Items</span>
							<span class="text-sm text-gray-400">
								{#if !showMenuFilters}
									Expand to set the current defaults • Example: if not Dinner uncheck and use Lunch
								{/if}
							</span>
							<span class="text-gray-400 ml-auto">{showMenuFilters ? '▼' : '▶'}</span>
						</button>
						
						{#if showMenuFilters}
							<div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
								{#each menuFilterCategories as category}
									<label class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-700/50 cursor-pointer">
										<input
											type="checkbox"
											bind:checked={selectedMenuCategories[category.id]}
											on:change={handleMenuCategoryChange}
											class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
										>
										<span class="text-lg">{category.icon}</span>
										<span class="text-sm font-medium text-white">{category.label}</span>
									</label>
								{/each}
							</div>
							
							<!-- Active filters display -->
							<div class="mt-3 flex flex-wrap gap-2">
								<span class="text-xs text-gray-400">
									({Object.values(selectedMenuCategories).filter(Boolean).length} active)
								</span>
								{#each menuFilterCategories as category}
									{#if selectedMenuCategories[category.id]}
										<span class="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs">
											{category.icon}
											{category.label}
										</span>
									{/if}
								{/each}
							</div>
						{/if}
					</div>

					<!-- Quick Filter Radio Buttons -->
					<div class="mb-4">
					<div class="flex items-center justify-between mb-2">
					{#if menuQuickFilterCategories}
					{@const enabledCategories = menuQuickFilterCategories.filter(cat => cat.id === 'all' || selectedMenuCategories[cat.id])}
					{@const disabledCount = menuQuickFilterCategories.length - enabledCategories.length}
					<p class="text-xs text-gray-400">
					{#if disabledCount > 0}
					{enabledCategories.length - 1} of {menuQuickFilterCategories.length - 1} categories enabled • {disabledCount} greyed out (not in defaults)
					{:else}
					All categories enabled • Change defaults above to limit options
					{/if}
					</p>
					{/if}
					</div>
					<div class="flex flex-wrap gap-2">
					{#each menuQuickFilterCategories as category}
					{@const isInDefaults = category.id === 'all' || selectedMenuCategories[category.id]}
					{@const isDisabled = !isInDefaults}
					<label class="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all {
					isDisabled 
					? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
					: menuQuickFilter === category.id 
					 ? 'bg-blue-600 border-blue-500 text-white' 
					  : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-600/50'
					}"
					 title={isDisabled ? 'Not in defaults - enable in Default Items above' : ''}
					 >
					  <input
					   type="radio"
					  name="menuQuickFilter"
					 value={category.id}
					  bind:group={menuQuickFilter}
					   on:change={handleMenuQuickFilterChange}
					    disabled={isDisabled}
										class="sr-only"
									>
									<span class="text-lg">{category.icon}</span>
									<span class="font-medium">{category.label}</span>
								</label>
								{/each}
							</div>
							
							{#if menuQuickFilter !== 'all'}
								<p class="text-xs text-gray-400 mt-2">
									Showing {menuQuickFilter} items • {filteredMenuItems.length} of {$menuItems.length} items
								</p>
							{/if}
						</div>

					<!-- Search Input -->
					<div class="relative">
						<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
							<svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
							</svg>
						</div>
						<input
							type="text"
							bind:value={menuSearchQuery}
							placeholder="Search menu items..."
							class="w-full pl-10 pr-12 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
						{#if speechSupported}
							<button
								type="button"
								on:click={() => (isRecordingSearch ? stopVoiceSearch() : startVoiceSearch())}
								class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors duration-200 {isRecordingSearch ? 'bg-red-600 text-white animate-pulse' : 'text-gray-400 hover:text-white hover:bg-gray-600'}"
								title="Voice search"
							>
								<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd"></path>
								</svg>
							</button>
						{/if}
					</div>
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
							{#each filteredMenuItems as item}
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

<!-- Maintenance Modal -->
<MaintenanceModal
	bind:show={showMaintenanceModal}
	bind:editItem={editMaintenanceItem}
	on:close={closeMaintenanceModal}
/>
