<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { authStore } from '$lib/auth.js';
	import pb from '$lib/pocketbase.js';
	import { collections, shifts, menuItems, sections, tables, tickets, ticketItems, loading } from '$lib/stores/collections.js';

	let activeTab = 'today';
	let orderTab = 'current'; // 'current' or 'history'
	let completedOrders = []; // Store completed order history
	let showHistoryModal = false;
	let user = null;
	let forcePaymentEnabled = false; // Server override for payment when items aren't ready

	// Shift timer state
	let shiftTimers = new Map(); // Map of shiftId -> timer data
	let currentTime = new Date();
	let timeInterval;

	// Reactive declarations
	$: myShifts = $shifts.filter(shift => {
		// Try matching by email as fallback
		const emailMatch = shift.expand?.staff_member?.email === user?.email;
		const userIdMatch = shift.expand?.staff_member?.user_id === user?.id;
		
		return userIdMatch || emailMatch;
	});
	
	// Get today's date in local timezone
	function getTodayString() {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	$: todayShifts = myShifts.filter(shift => {
		// Handle both "YYYY-MM-DD" and "YYYY-MM-DD HH:MM:SS" formats
		const shiftDateOnly = shift.shift_date.split(' ')[0];
		const today = getTodayString();
		return shiftDateOnly === today;
	});

	$: upcomingShifts = myShifts.filter(shift => {
		const shiftDateOnly = shift.shift_date.split(' ')[0];
		return new Date(shiftDateOnly) > new Date() && 
			shiftDateOnly !== getTodayString();
	}).sort((a, b) => new Date(a.shift_date.split(' ')[0]) - new Date(b.shift_date.split(' ')[0]));

	onMount(async () => {
		// Start time tracking interval
		timeInterval = setInterval(() => {
			currentTime = new Date();
		}, 1000);

		// Track if we've already handled this auth state to prevent loops
		let hasHandledAuth = false;
		
		// Check authentication and role
		const unsubscribe = authStore.subscribe(async (auth) => {
			console.log('🔐 Server Auth State:', { isLoading: auth.isLoading, isLoggedIn: auth.isLoggedIn, role: auth.role, hasHandledAuth });
			
			// Wait for auth to finish loading
			if (auth.isLoading) {
				return;
			}
			
			// Check if PocketBase has auth but store doesn't - force sync
			if (!auth.isLoggedIn && pb.authStore.isValid && !hasHandledAuth) {
				console.log('🔄 Auth mismatch detected - forcing store sync...');
				authStore.update(() => ({
					isLoggedIn: pb.authStore.isValid,
					user: pb.authStore.model,
					role: pb.authStore.model?.role || null,
					isLoading: false
				}));
				return;
			}
			
			// Prevent infinite loops
			if (hasHandledAuth) {
				return;
			}
			
			if (!auth.isLoggedIn) {
				console.log('❌ Not logged in, redirecting to login...');
				hasHandledAuth = true;
				goto('/');
				return;
			}
			
			const userRole = auth.role?.toLowerCase();
			
			// Redirect kitchen staff to kitchen dashboard
			if (auth.isLoggedIn && ['chef', 'kitchen_prep', 'dishwasher'].includes(userRole)) {
				console.log('🍳 Kitchen staff detected, redirecting to kitchen dashboard...');
				hasHandledAuth = true;
				goto('/dashboard/kitchen');
				return;
			}
			
			// Only allow front-of-house staff to access server dashboard
			if (auth.isLoggedIn && !['server', 'host', 'bartender', 'busser'].includes(userRole)) {
				console.log('👔 Manager/other role detected, redirecting to main dashboard...');
				hasHandledAuth = true;
				goto('/dashboard');
				return;
			}

			if (auth.isLoggedIn && auth.user) {
				console.log('✅ Server dashboard access granted for:', auth.user.email);
				hasHandledAuth = true;
				user = auth.user;
				// Load relevant data for servers
				try {
					await Promise.all([
						collections.getShifts(),
						collections.getMenuItems(),
						collections.getSections(),
						collections.getTables(),
						collections.getTickets(),
						collections.getTicketItems()
					]);
					
					// Table updates collection is optional for server dashboard
					// Skipping to avoid console errors - not needed for core functionality
					
					// Load any existing shift timers
					loadShiftTimers();
					
					// Load bar orders for bartenders
					await loadBarOrders();
				} catch (error) {
					console.error('Error loading dashboard data:', error);
				}
			}
		});

		// Initialize speech recognition
		initSpeechRecognition();

		return unsubscribe;
	});

	onDestroy(() => {
		if (timeInterval) {
			clearInterval(timeInterval);
		}
	});

	async function logout() {
		const { auth } = await import('$lib/auth.js');
		await auth.logout();
		goto('/');
	}

	function setActiveTab(tab) {
		activeTab = tab;
	}

	async function updateShiftStatus(shiftId, status) {
		try {
			if (status === 'in_progress') {
				// Start shift timer
				startShiftTimer(shiftId);
			} else if (status === 'completed') {
				// Stop shift timer
				stopShiftTimer(shiftId);
			}
			
			await collections.updateShift(shiftId, { status: status });
		} catch (error) {
			console.error('Error updating shift status:', error);
			alert('Failed to update shift status');
		}
	}

	function startShiftTimer(shiftId) {
		const now = new Date();
		const timerData = {
			startTime: now,
			breakReminded: false,
			autoCompleteChecked: false
		};
		shiftTimers.set(shiftId, timerData);
		shiftTimers = new Map(shiftTimers); // Trigger reactivity
		
		// Save to localStorage for persistence
		localStorage.setItem(`shift_timer_${shiftId}`, JSON.stringify({
			...timerData,
			startTime: now.toISOString()
		}));
	}

	function stopShiftTimer(shiftId) {
		shiftTimers.delete(shiftId);
		shiftTimers = new Map(shiftTimers); // Trigger reactivity
		localStorage.removeItem(`shift_timer_${shiftId}`);
	}

	// Reset break reminder for a shift (if it gets stuck)
	function resetBreakReminder(shiftId) {
		const timer = shiftTimers.get(shiftId);
		if (timer) {
			timer.breakReminded = false;
			shiftTimers.set(shiftId, timer);
			localStorage.setItem(`shift_timer_${shiftId}`, JSON.stringify({
				...timer,
				startTime: timer.startTime.toISOString()
			}));
		}
	}

	function loadShiftTimers() {
		// Load existing timers from localStorage
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key && key.startsWith('shift_timer_')) {
				const shiftId = key.replace('shift_timer_', '');
				const data = JSON.parse(localStorage.getItem(key));
				if (data) {
					shiftTimers.set(shiftId, {
						...data,
						startTime: new Date(data.startTime)
					});
				}
			}
		}
		shiftTimers = new Map(shiftTimers); // Trigger reactivity
	}

	function getShiftDuration(shiftId) {
		const timer = shiftTimers.get(shiftId);
		if (!timer) return null;
		
		const duration = currentTime - timer.startTime;
		const hours = Math.floor(duration / (1000 * 60 * 60));
		const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
		return { hours, minutes, duration };
	}

	function getCountdownInfo(shiftId) {
		const timer = shiftTimers.get(shiftId);
		const shift = todayShifts.find(s => s.id === shiftId);
		if (!timer || !shift) return null;
		
		const elapsed = currentTime - timer.startTime;
		const threeHours = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
		
		// Calculate elapsed time
		const elapsedHours = Math.floor(elapsed / (1000 * 60 * 60));
		const elapsedMinutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
		
		// Calculate scheduled shift duration
		const [startHour, startMinute] = shift.start_time.split(':').map(Number);
		const [endHour, endMinute] = shift.end_time.split(':').map(Number);
		const shiftDurationHours = endHour - startHour;
		const shiftDurationMinutes = endMinute - startMinute;
		const totalShiftMinutes = shiftDurationHours * 60 + shiftDurationMinutes;
		
		// Check if all tables are available (for post-break countdown)
		const myTables = getAllMyTables(shift.assigned_section);
		const allTablesAvailable = myTables.length === 0 || myTables.every(table => 
			table.status_field === 'available' || !table.status_field
		);
		const occupiedTables = myTables.filter(table => 
			table.status_field === 'occupied' || table.status_field === 'cleaning'
		).length;
		
		const baseMetadata = {
			elapsedTime: `${elapsedHours}h ${elapsedMinutes}m`,
			shiftDuration: `${Math.floor(totalShiftMinutes / 60)}h ${totalShiftMinutes % 60}m`,
			breakDuration: shift.break_duration ? `${shift.break_duration} min` : 'Not specified',
			tablesTotal: myTables.length,
			tablesOccupied: occupiedTables,
			tablesAvailable: myTables.length - occupiedTables
		};
		
		if (elapsed < threeHours) {
			// Countdown to break time
			const timeToBreak = threeHours - elapsed;
			const hours = Math.floor(timeToBreak / (1000 * 60 * 60));
			const minutes = Math.floor((timeToBreak % (1000 * 60 * 60)) / (1000 * 60));
			const seconds = Math.floor((timeToBreak % (1000 * 60)) / 1000);
			
			return {
				type: 'break',
				hours,
				minutes,
				seconds,
				message: 'Break time in',
				color: 'green',
				...baseMetadata
			};
		} else {
			// Past break time
			if (allTablesAvailable) {
				// Countdown to scheduled end time
				const [endHour, endMinute] = shift.end_time.split(':').map(Number);
				const today = new Date();
				const endTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endHour, endMinute);
				
				// If end time has passed, don't show countdown
				if (currentTime >= endTime) {
					return {
						type: 'overtime',
						hours: 0,
						minutes: 0,
						seconds: 0,
						message: 'Ready to clock out',
						color: 'blue',
						...baseMetadata
					};
				}
				
				const timeToEnd = endTime - currentTime;
				const hours = Math.floor(timeToEnd / (1000 * 60 * 60));
				const minutes = Math.floor((timeToEnd % (1000 * 60 * 60)) / (1000 * 60));
				const seconds = Math.floor((timeToEnd % (1000 * 60)) / 1000);
				
				return {
					type: 'clockout',
					hours,
					minutes,
					seconds,
					message: 'Clock out in',
					color: 'blue',
					...baseMetadata
				};
			} else {
				// Tables still occupied, show elapsed time since break
				const timeSinceBreak = elapsed - threeHours;
				const hours = Math.floor(timeSinceBreak / (1000 * 60 * 60));
				const minutes = Math.floor((timeSinceBreak % (1000 * 60 * 60)) / (1000 * 60));
				
				return {
					type: 'working',
					hours,
					minutes,
					seconds: 0,
					message: 'Working overtime',
					color: 'yellow',
					...baseMetadata
				};
			}
		}
	}

	function shouldShowBreakReminder(shiftId) {
		const timer = shiftTimers.get(shiftId);
		if (!timer || timer.breakReminded) return false;
		
		const duration = currentTime - timer.startTime;
		const threeHours = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
		
		if (duration >= threeHours && !timer.breakReminded) {
			timer.breakReminded = true;
			shiftTimers.set(shiftId, timer);
			
			// Save the updated timer to localStorage to persist the flag
			localStorage.setItem(`shift_timer_${shiftId}`, JSON.stringify({
				...timer,
				startTime: timer.startTime.toISOString()
			}));
			
			return true;
		}
		return false;
	}

	function isPastBreakTime(shiftId) {
		const timer = shiftTimers.get(shiftId);
		if (!timer) return false;
		
		const duration = currentTime - timer.startTime;
		const threeHours = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
		return duration > threeHours;
	}

	async function checkAutoComplete(shiftId) {
		const timer = shiftTimers.get(shiftId);
		if (!timer || !isPastBreakTime(shiftId)) return;
		
		// Check if all tables are available
		const shift = todayShifts.find(s => s.id === shiftId);
		if (!shift) return;
		
		const myTables = getAllMyTables(shift.assigned_section);
		const allTablesAvailable = myTables.every(table => 
			table.status_field === 'available' || !table.status_field
		);
		
		if (allTablesAvailable && !timer.autoCompleteChecked) {
			timer.autoCompleteChecked = true;
			shiftTimers.set(shiftId, timer);
			
			// Wait 15 minutes, then auto-complete if still all available
			setTimeout(async () => {
				const currentMyTables = getAllMyTables(shift.assigned_section);
				const stillAllAvailable = currentMyTables.every(table => 
					table.status_field === 'available' || !table.status_field
				);
				
				if (stillAllAvailable) {
					if (confirm('All your tables have been available for 15 minutes. Would you like to complete your shift automatically?')) {
						await updateShiftStatus(shiftId, 'completed');
					}
				}
			}, 15 * 60 * 1000); // 15 minutes
		}
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

	function formatTime(timeStr) {
		// Convert 24-hour format (14:00) to 12-hour format (2:00 pm)
		if (!timeStr) return timeStr;
		
		const [hours, minutes] = timeStr.split(':');
		const hour24 = parseInt(hours);
		const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
		const ampm = hour24 < 12 ? 'am' : 'pm';
		
		return `${hour12}:${minutes} ${ampm}`;
	}

	// Helper to get section name by ID
	function getSectionName(sectionId) {
		if (!sectionId || !$sections) return null;
		const section = $sections.find(s => s.id === sectionId);
		return section ? section.section_name : null;
	}

	// Helper to get tables for a given section
	function getTablesForSection(sectionId) {
		if (!sectionId || !$tables || !$sections) {
			return [];
		}
		const section = $sections.find(s => s.id === sectionId);
		if (!section || !section.section_code) {
			return [];
		}
		
		const filteredTables = $tables.filter(table => table.section_code === section.section_code);
		return filteredTables;
	}

	// Helper to get all tables the server is responsible for (assigned + helping sections)
	function getAllMyTables(assignedSectionId) {
		// Guard against undefined stores
		if (!$tables || !$sections) {
			console.warn('Tables or sections not loaded yet');
			return [];
		}
		
		let allTables = [];
		
		// Add tables from assigned section
		if (assignedSectionId) {
			allTables = [...getTablesForSection(assignedSectionId)];
		}
		
		// Add tables from sections they're helping with
		for (const sectionId of selectedAdditionalSections) {
			const helpingTables = getTablesForSection(sectionId);
			allTables = [...allTables, ...helpingTables];
		}
		
		return allTables;
	}

	// Helper to get all sections with their tables for expansion view
	function getAllSections() {
		if (!$sections || !$tables) return [];
		return $sections.map(section => ({
			...section,
			tables: $tables.filter(table => table.section_code === section.section_code)
		}));
	}

	// Toggle additional section selection
	function toggleAdditionalSection(sectionId) {
		console.log('🔧 Toggle section:', sectionId);
		console.log('📋 Current helping sections:', Array.from(selectedAdditionalSections));
		
		if (selectedAdditionalSections.has(sectionId)) {
			selectedAdditionalSections.delete(sectionId);
			console.log('❌ Removed section:', sectionId);
		} else {
			selectedAdditionalSections.add(sectionId);
			console.log('✅ Added section:', sectionId);
		}
		// Force reactivity update
		selectedAdditionalSections = new Set(selectedAdditionalSections);
		
		// Save to localStorage
		saveStateToLocalStorage();
		
		console.log('📋 New helping sections:', Array.from(selectedAdditionalSections));
		console.log('🔍 Tables for this section:', getTablesForSection(sectionId));
		console.log('🔄 Triggering reactive update...');
	}
	
	// Toggle filter visibility
	function toggleFilters() {
		showFilters = !showFilters;
		saveStateToLocalStorage();
	}
	
	// Handle quick filter change
	function handleQuickFilterChange() {
		// If selected category is not in defaults anymore, switch to 'all'
		if (quickFilter !== 'all' && !selectedCategories[quickFilter]) {
			quickFilter = 'all';
		}
		saveStateToLocalStorage();
	}
	


	// Update table status
	async function updateTableStatus(tableId, status, notes = '') {
		try {
			const table = $tables.find(t => t.id === tableId);
			const tableName = table?.table_name || table?.table_number_field || `Table ${tableId}`;
			
			console.log(`🏢 TABLE UPDATE: ${tableName} • ${table?.status_field || 'unknown'} → ${status}${notes ? ` • Notes: ${notes}` : ''}`);
			
			// Try to create table update record (optional - collection may not exist yet)
			try {
				const updateData = {
					table_id: tableId,
					status_field: status,
					updated_by: user?.id,
					notes_field: notes
				};
				await collections.createTableUpdate(updateData);
			} catch (tableUpdateError) {
				console.warn('Could not create table update record:', tableUpdateError.message);
			}
			
			// Update the table status in the tables collection
			await collections.updateTable(tableId, { status_field: status });
			
			// Show success feedback
			const statusMessages = {
				'available': 'Table marked as available',
				'occupied': 'Table marked as occupied', 
				'cleaning': 'Table marked for cleaning',
				'reserved': 'Table marked as reserved',
				'out_of_service': 'Table marked out of service'
			};
			
			// Simple visual feedback (could be replaced with toast notification)
			
		} catch (error) {
			console.error('Error updating table status:', error);
			alert('Failed to update table status');
		}
	}

	// State for expanded sections view
	let showAllSections = false;
	let selectedAdditionalSections = new Set(); // Track additional sections server is helping with
	let tableClickBehavior = 'direct'; // 'direct' or 'detailed' - preference for table click behavior
	
	// Restore state from localStorage on page load
	onMount(() => {
		if (typeof window !== 'undefined') {
			try {
				const savedSections = localStorage.getItem('selectedAdditionalSections');
				if (savedSections) {
					const parsed = JSON.parse(savedSections);
					if (Array.isArray(parsed)) {
						selectedAdditionalSections = new Set(parsed);
					}
				}
				
				const savedShowAllSections = localStorage.getItem('showAllSections');
				if (savedShowAllSections) {
					showAllSections = JSON.parse(savedShowAllSections) === true;
				}
				
				const savedTableClickBehavior = localStorage.getItem('tableClickBehavior');
				if (savedTableClickBehavior && ['direct', 'detailed'].includes(savedTableClickBehavior)) {
					tableClickBehavior = savedTableClickBehavior;
				}
				
				const savedShowFilters = localStorage.getItem('showFilters');
				if (savedShowFilters) {
					showFilters = JSON.parse(savedShowFilters) === true;
				}
				
				const savedQuickFilter = localStorage.getItem('quickFilter');
				if (savedQuickFilter && quickFilterCategories.some(cat => cat.id === savedQuickFilter)) {
					quickFilter = savedQuickFilter;
				}
				

			} catch (e) {
				console.warn('Failed to restore localStorage state:', e);
				// Reset to defaults on error
				selectedAdditionalSections = new Set();
				showAllSections = false;
				tableClickBehavior = 'direct';
			}
		}
	});
	
	// Save state to localStorage when it changes (non-reactive to prevent loops)
	function saveStateToLocalStorage() {
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('selectedAdditionalSections', JSON.stringify(Array.from(selectedAdditionalSections)));
				localStorage.setItem('showAllSections', JSON.stringify(showAllSections));
				localStorage.setItem('tableClickBehavior', tableClickBehavior);
				localStorage.setItem('showFilters', JSON.stringify(showFilters));
				localStorage.setItem('quickFilter', quickFilter);
			} catch (e) {
				console.warn('Failed to save to localStorage:', e);
			}
		}
	}
	
	// Ticket management state
	let showTicketModal = false;
	let selectedTable = null;
	let currentTicket = null;
	let currentTicketItems = [];
	let selectedMenuItem = null;
	let showItemModal = false;
	let selectedModifiers = [];
	let itemQuantity = 1;
	let specialInstructions = '';
	let selectedSeat = null;
	let seatNames = {}; // Map of seat numbers to names
	
	// Item edit modal state
	let showEditItemModal = false;
	let editingItem = null;
	let editQuantity = 1;
	let editModifiers = [];
	let editSpecialInstructions = '';
	let editSeat = null;
	
	// Dynamic seat management  
	let maxSeats = 10; // Default max seats (expandable) - generous for walk-ins
	
	// Voice recognition state
	let isRecording = false;
	let recognition = null;
	let speechSupported = false;
	let isRecordingEdit = false;
	let isRecordingSearch = false;
	
	// Calculate totals from current ticket items (reactive)
	$: calculatedSubtotal = currentTicketItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
	
	// Determine if payment should be allowed
	$: allItemsReady = currentTicketItems.every(item => item.status === 'ready' || item.status === 'preparing');
	$: paymentAllowed = allItemsReady || forcePaymentEnabled;
	$: calculatedTax = calculatedSubtotal * 0.08875; // NYC tax rate
	$: calculatedTotal = calculatedSubtotal + calculatedTax;
	
	// Reactive: Update bar orders when ticket items change (debounced)
	let barOrdersUpdateTimeout;
	$: if ($ticketItems && user?.role?.toLowerCase() === 'bartender') {
		// Debounce to prevent excessive updates
		clearTimeout(barOrdersUpdateTimeout);
		barOrdersUpdateTimeout = setTimeout(() => {
			loadBarOrders();
		}, 100);
	}
	
	// Menu modifiers (will be loaded from CSV later)
	const menuModifiers = [
		{ id: 1, name: "Saignant (Rare)", type: "cooking_style", price_change: 0, applicable_categories: ["main_course"] },
		{ id: 2, name: "À Point (Medium-Rare)", type: "cooking_style", price_change: 0, applicable_categories: ["main_course"] },
		{ id: 3, name: "Bien Cuit (Well Done)", type: "cooking_style", price_change: 0, applicable_categories: ["main_course"] },
		{ id: 4, name: "Sauce Béarnaise", type: "sauce", price_change: 3.50, applicable_categories: ["main_course"] },
		{ id: 5, name: "Sauce Hollandaise", type: "sauce", price_change: 3.00, applicable_categories: ["main_course"] },
		{ id: 6, name: "Extra Cheese (Gruyère)", type: "add_on", price_change: 4.50, applicable_categories: ["appetizer", "main_course"] },
		{ id: 7, name: "Truffle Oil Drizzle", type: "add_on", price_change: 8.00, applicable_categories: ["appetizer", "main_course"] },
		{ id: 8, name: "Double Portion", type: "size", price_change: 18.00, applicable_categories: ["main_course"] },
		{ id: 9, name: "Champagne Upgrade", type: "size", price_change: 15.00, applicable_categories: ["beverage"] },
		{ id: 10, name: "Extra Garlic", type: "add_on", price_change: 1.50, applicable_categories: ["appetizer", "main_course"] }
	];
	
	function getApplicableModifiers(menuItem) {
		const category = menuItem.category_field || menuItem.category;
		return menuModifiers.filter(modifier => 
			modifier.applicable_categories.includes(category)
		);
	}
	let guestCount = 2;
	// Category selection for filtering (multi-select checkboxes)
	let selectedCategories = {
		brunch: false,
		lunch: false,
		dinner: true,    // Default checked
		wine: true,      // Default checked
		cocktails: true, // Default checked
		happy_hour: false,
		beer: true,      // Default checked
		desserts: false
	};
	let searchQuery = '';
	let showModifiers = false;
	let showFilters = false; // Collapsed by default to save space
	
	// New separate quick filter system (single-select radio buttons)
	let quickFilter = 'all'; // Default to show all categories
	
	// Quick filter categories
	const quickFilterCategories = [
		{ id: 'all', label: 'All Defaults', icon: '📋' },
		{ id: 'brunch', label: 'Brunch', icon: '🥐' },
		{ id: 'lunch', label: 'Lunch', icon: '🥗' },
		{ id: 'dinner', label: 'Dinner', icon: '🍽️' },
		{ id: 'wine', label: 'Wine', icon: '🍷' },
		{ id: 'cocktails', label: 'Cocktails', icon: '🍸' },
		{ id: 'happy_hour', label: 'Happy Hour', icon: '🍻' },
		{ id: 'beer', label: 'Beer', icon: '🍺' },
		{ id: 'desserts', label: 'Desserts', icon: '🍰' }
	];
	
	// Reactive statement for current shift's tables (updates when selectedAdditionalSections changes)
	$: currentShiftTables = (todayShifts.length > 0 && todayShifts[0] && selectedAdditionalSections !== undefined) 
		? getAllMyTables(todayShifts[0].assigned_section) 
		: [];
		
	// Auto-switch to 'all' if current quick filter is not in selected defaults
	$: if (quickFilter !== 'all' && !selectedCategories[quickFilter]) {
		quickFilter = 'all';
		handleQuickFilterChange();
	}
		


	// Reactive checks for break reminders and auto-completion
	$: {
		if (currentTime && todayShifts.length > 0) {
			todayShifts.forEach(shift => {
				const timer = shiftTimers.get(shift.id);
				if (timer) {
					// Check for break reminder (only if shift is still in progress)
					if (shift.status === 'in_progress' && shouldShowBreakReminder(shift.id)) {
						const takeBreak = confirm('Time for your break! You\'ve been working for 3 hours.\n\nWould you like to mark yourself as on break?');
						if (takeBreak) {
							// Optional: Update shift status to 'on_break' if that status exists
							console.log('User chose to take break');
						}
					}
					
					// Check for auto-completion
					checkAutoComplete(shift.id);
				}
			});
		}
	}

	// Force reactivity for timer displays
	$: timerDisplayKey = currentTime.getTime();

	// Table click handler for ticket management
	async function handleTableClick(table) {
		selectedTable = table;
		
		// Check if table has an existing open ticket
		const existingTicket = $tickets.find(ticket => 
			ticket.table_id === table.id && 
			!['closed', 'payment_processing'].includes(ticket.status)
		);
		
		if (existingTicket) {
			currentTicket = existingTicket;
			// Load ticket items
			currentTicketItems = await collections.getTicketItems(existingTicket.id);
		} else {
			currentTicket = null;
			currentTicketItems = [];
		}
		
		showTicketModal = true;
	}

	async function createNewTicket(customerCount = 2) {
	if (!selectedTable || !user) return;
	
	try {
	const tableName = selectedTable?.table_name || selectedTable?.table_number_field || 'Unknown Table';
	console.log(`🎫 CREATING TICKET: ${tableName} • ${customerCount} guests • Server: ${user.email}`);
	
	const ticketData = {
	 table_id: selectedTable.id,
	 server_id: user.id,
	 customer_count: customerCount
	};
	
	currentTicket = await collections.createTicket(ticketData);
	currentTicketItems = [];
	 
	console.log(`✅ TICKET CREATED: #${currentTicket.ticket_number} • ${tableName} • Ready for orders`);
	
	 // Update table status to occupied
	  await updateTableStatus(selectedTable.id, 'occupied');
		} catch (error) {
			console.error('❌ ERROR creating ticket:', error);
			alert('Failed to create ticket');
		}
	}

	function openItemModal(menuItem) {
		selectedMenuItem = menuItem;
		itemQuantity = 1;
		selectedModifiers = [];
		specialInstructions = '';
		selectedSeat = null;
		showItemModal = true;
	}
	
	function closeItemModal() {
		showItemModal = false;
		selectedMenuItem = null;
		itemQuantity = 1;
		selectedModifiers = [];
		specialInstructions = '';
		selectedSeat = null;
	}
	
	function openEditItemModal(item) {
		editingItem = item;
		editQuantity = item.quantity;
		editSpecialInstructions = item.special_instructions || '';
		editSeat = item.seat_number || null;
		
		// Parse existing modifiers from modifications string
		editModifiers = [];
		if (item.modifications) {
			const modifierText = item.modifications.split(' | ')[0]; // Get modifiers part (before special instructions)
			editModifiers = menuModifiers.filter(mod => 
				modifierText.includes(mod.name)
			);
		}
		
		showEditItemModal = true;
	}
	
	function closeEditItemModal() {
		showEditItemModal = false;
		editingItem = null;
		editQuantity = 1;
		editModifiers = [];
		editSpecialInstructions = '';
		editSeat = null;
	}
	
	async function saveEditedItem() {
		if (!editingItem) return;
		
		try {
			// Build new modifications string
			const modifierNames = editModifiers.map(m => m.name).join(', ');
			const modifications = [modifierNames, editSpecialInstructions].filter(Boolean).join(' | ');
			
			// Calculate new prices with modifiers
			const basePrice = editingItem.unit_price - (editingItem.modifier_total || 0); // Remove old modifier cost
			const modifierTotal = editModifiers.reduce((sum, mod) => sum + (mod.price_change || 0), 0);
			const newUnitPrice = basePrice + modifierTotal;
			const newTotalPrice = newUnitPrice * editQuantity;
			
			// Update the item
			const updateData = {
				quantity: editQuantity,
				unit_price: newUnitPrice,
				total_price: newTotalPrice,
				modifications: modifications,
				seat_number: editSeat,
				seat_name: editSeat ? seatNames[editSeat] || '' : '',
				special_instructions: editSpecialInstructions
			};
			
			// Update local state immediately
			currentTicketItems = currentTicketItems.map(item => 
				item.id === editingItem.id 
					? { ...item, ...updateData, modifier_total: modifierTotal }
					: item
			);
			
			// Update backend
			await collections.updateTicketItem(editingItem.id, updateData);
			
			// Update backend totals
			updateTicketTotals();
			
			closeEditItemModal();
		} catch (error) {
			console.error('Error updating item:', error);
		}
	}
	
	function toggleModifier(modifier) {
		const index = selectedModifiers.findIndex(m => m.id === modifier.id);
		if (index >= 0) {
			selectedModifiers.splice(index, 1);
		} else {
			selectedModifiers.push(modifier);
		}
		selectedModifiers = [...selectedModifiers];
	}
	
	function toggleEditModifier(modifier) {
		const index = editModifiers.findIndex(m => m.id === modifier.id);
		if (index >= 0) {
			editModifiers.splice(index, 1);
		} else {
			editModifiers.push(modifier);
		}
		editModifiers = [...editModifiers];
	}
	
	function calculateItemTotal() {
		if (!selectedMenuItem) return 0;
		const basePrice = selectedMenuItem.price_field || selectedMenuItem.price || 0;
		const modifierTotal = selectedModifiers.reduce((sum, mod) => sum + (mod.price_change || 0), 0);
		return (basePrice + modifierTotal) * itemQuantity;
	}
	
	function updateSeatName(seatNumber, name) {
		if (name.trim()) {
			seatNames[seatNumber] = name.trim();
		} else {
			delete seatNames[seatNumber];
		}
		seatNames = { ...seatNames }; // Trigger reactivity
	}
	
	function getSeatDisplay(seatNumber) {
		if (!seatNumber) return '';
		const name = seatNames[seatNumber];
		return name ? `Seat ${seatNumber} (${name})` : `Seat ${seatNumber}`;
	}
	
	function addExtraSeat() {
		maxSeats = maxSeats + 1;
	}
	
	function getAvailableSeats() {
		// Use the larger of guest count or maxSeats for flexibility
		const guestCount = currentTicket?.customer_count || 2;
		return Math.max(guestCount, maxSeats);
	}
	
	async function updateTicketTotals() {
		if (currentTicket) {
			try {
				await collections.updateTicket(currentTicket.id, {
					subtotal_amount: calculatedSubtotal,
					tax_amount: calculatedTax,
					total_amount: calculatedTotal
				});
				// Refresh the ticket in the store
				await collections.getTickets();
				currentTicket = $tickets.find(t => t.id === currentTicket.id);
			} catch (error) {
				console.error('Error updating ticket totals:', error);
			}
		}
	}

	async function addItemToTicket(menuItem, quantity = 1, modifications = '') {
		if (!currentTicket) return;
		
		try {
			const category = menuItem.category_field || menuItem.category;
			const itemData = {
				ticket_id: currentTicket.id,
				menu_item_id: menuItem.id,
				quantity: quantity,
				unit_price: menuItem.price_field || menuItem.price || 0,
				total_price: (menuItem.price_field || menuItem.price || 0) * quantity,
				modifications: modifications,
				course: mapCategoryToCourse(category),
				kitchen_station: getKitchenStation(category)
			};
			
			const newItem = await collections.addTicketItem(itemData);
			currentTicketItems = [...currentTicketItems, newItem];
			
			// Refresh current ticket to get updated totals
			await collections.getTickets();
			currentTicket = $tickets.find(t => t.id === currentTicket.id);
		} catch (error) {
			console.error('Error adding item to ticket:', error);
			// Collection may not exist yet - check admin panel
		}
	}
	
	async function addCustomizedItemToTicket() {
		if (!selectedMenuItem || !currentTicket) return;
		
		// Build modifications string
		const modifierNames = selectedModifiers.map(m => m.name).join(', ');
		const modifications = [modifierNames, specialInstructions].filter(Boolean).join(' | ');
		
		// Calculate adjusted price
		const basePrice = selectedMenuItem.price_field || selectedMenuItem.price || 0;
		const modifierTotal = selectedModifiers.reduce((sum, mod) => sum + (mod.price_change || 0), 0);
		const unitPrice = basePrice + modifierTotal;
		
		try {
			const category = selectedMenuItem.category_field || selectedMenuItem.category;
			const itemData = {
				ticket_id: currentTicket.id,
				menu_item_id: selectedMenuItem.id,
				quantity: itemQuantity,
				unit_price: unitPrice,
				total_price: unitPrice * itemQuantity,
				modifications: modifications,
				course: mapCategoryToCourse(category),
				kitchen_station: getKitchenStation(category),
				seat_number: selectedSeat,
				seat_name: selectedSeat ? seatNames[selectedSeat] || '' : ''
			};
			
			const newItem = await collections.addTicketItem(itemData);
			currentTicketItems = [...currentTicketItems, newItem];
			
			// Update backend totals (non-blocking)
			updateTicketTotals();
			
			closeItemModal();
		} catch (error) {
			console.error('Error adding customized item to ticket:', error);
		}
	}
	
	async function updateItemQuantity(itemId, newQuantity) {
		if (newQuantity < 1) return;
		
		try {
			// Find the item to get its unit price
			const item = currentTicketItems.find(i => i.id === itemId);
			if (!item) return;
			
			const newTotalPrice = item.unit_price * newQuantity;
			
			// Update local state immediately for responsive UI
			currentTicketItems = currentTicketItems.map(i => 
				i.id === itemId 
					? { ...i, quantity: newQuantity, total_price: newTotalPrice }
					: i
			);
			
			// Update the backend
			await collections.updateTicketItem(itemId, {
				quantity: newQuantity,
				total_price: newTotalPrice
			});
			
			// Update backend totals (non-blocking)
			updateTicketTotals();
		} catch (error) {
			console.error('Error updating item quantity:', error);
			// Revert local state if backend update failed
			const item = currentTicketItems.find(i => i.id === itemId);
			if (item) {
				currentTicketItems = currentTicketItems.map(i => 
					i.id === itemId 
						? { ...i, quantity: item.quantity, total_price: item.unit_price * item.quantity }
						: i
				);
			}
		}
	}

	function getKitchenStation(category) {
		switch (category) {
			case 'beverage': return 'bar';
			case 'appetizer': return 'cold_station';
			case 'main_course': return 'kitchen';
			case 'main': return 'kitchen';
			case 'dessert': return 'cold_station';
			default: return 'kitchen';
		}
	}
	
	function mapCategoryToCourse(category) {
		switch (category) {
			case 'main_course': return 'main';
			case 'beverage': return 'drink';
			case 'appetizer': return 'appetizer';
			case 'dessert': return 'dessert';
			case 'side_dish': return 'side';
			default: return 'main';
		}
	}
	
	function getCategoryIcon(category) {
		switch (category) {
			case 'appetizer': return '🥗';
			case 'main_course': return '🍽️';
			case 'beverage': return '🍷';
			case 'dessert': return '🍰';
			case 'side_dish': return '🥖';
			default: return '🍽️';
		}
	}
	
	function getCategoryCheckboxIcon(category) {
		switch (category) {
			case 'brunch': return '🥐';
			case 'lunch': return '🥗';
			case 'dinner': return '🍽️';
			case 'wine': return '🍷';
			case 'cocktails': return '🍸';
			case 'happy_hour': return '🍻';
			case 'beer': return '🍺';
			case 'desserts': return '🍰';
			default: return '🍴';
		}
	}
	


	function closeTicketModal() {
		showTicketModal = false;
		selectedTable = null;
		currentTicket = null;
		currentTicketItems = [];
		selectedMenuItem = null;
		guestCount = 2; // Reset to default
		searchQuery = '';
		showModifiers = false;
		selectedModifiers = [];
	}

	// Filter menu items based on quick filter, selected categories, and search
	$: filteredMenuItems = $menuItems.filter(item => {
		// First apply quick filter
		let matchesQuickFilter = false;
		
		if (quickFilter === 'all') {
			matchesQuickFilter = true;
		} else if (quickFilter === 'brunch') {
			matchesQuickFilter = item.category === 'brunch';
		} else if (quickFilter === 'lunch') {
			matchesQuickFilter = item.category === 'lunch';
		} else if (quickFilter === 'dinner') {
			matchesQuickFilter = item.category === 'dinner';
		} else if (quickFilter === 'wine') {
			matchesQuickFilter = ['wine_red', 'wine_white', 'wine_sparkling'].includes(item.subcategory);
		} else if (quickFilter === 'cocktails') {
			matchesQuickFilter = ['cocktail_classic', 'cocktail_signature'].includes(item.subcategory);
		} else if (quickFilter === 'happy_hour') {
			matchesQuickFilter = item.category === 'happy_hour';
		} else if (quickFilter === 'beer') {
			matchesQuickFilter = ['beer_draft', 'beer_bottle'].includes(item.subcategory);
		} else if (quickFilter === 'desserts') {
			matchesQuickFilter = item.category === 'desserts' || ['dessert_cake', 'dessert_ice_cream'].includes(item.subcategory);
		}
		
		// If quick filter doesn't match, exclude item
		if (!matchesQuickFilter) {
			return false;
		}
		
		// Then apply multi-select category filters (within quick filter results)
		const anySelectedCategories = Object.values(selectedCategories).some(checked => checked);
		
		// If no categories are selected in multi-select, show all items that passed quick filter
		if (!anySelectedCategories) {
			const matchesSearch = !searchQuery || 
				item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
			return matchesSearch && item.available;
		}
		
		let matchesCategory = false;
		
		// Check each selected category in multi-select
		if (selectedCategories.brunch && item.category === 'brunch') {
			matchesCategory = true;
		}
		if (selectedCategories.lunch && item.category === 'lunch') {
			matchesCategory = true;
		}
		if (selectedCategories.dinner && item.category === 'dinner') {
			matchesCategory = true;
		}
		if (selectedCategories.wine && ['wine_red', 'wine_white', 'wine_sparkling'].includes(item.subcategory)) {
			matchesCategory = true;
		}
		if (selectedCategories.cocktails && ['cocktail_classic', 'cocktail_signature'].includes(item.subcategory)) {
			matchesCategory = true;
		}
		if (selectedCategories.happy_hour && item.category === 'happy_hour') {
			matchesCategory = true;
		}
		if (selectedCategories.beer && ['beer_draft', 'beer_bottle'].includes(item.subcategory)) {
			matchesCategory = true;
		}
		if (selectedCategories.desserts && (item.category === 'desserts' || ['dessert_cake', 'dessert_ice_cream'].includes(item.subcategory))) {
			matchesCategory = true;
		}
		
		const matchesSearch = !searchQuery || 
			item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			item.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
		return matchesCategory && matchesSearch && item.available;
	});

	// Send ticket to kitchen and bar
	async function sendToKitchen() {
		if (!currentTicket || !currentTicketItems.length) return;

		console.log('🚀 SEND ORDERS DEBUG - Starting send to kitchen process');
		console.log('📋 Ticket:', currentTicket);
		console.log('🍽️ Items to send:', currentTicketItems);

		try {
			// Update ticket status
			await collections.updateTicket(currentTicket.id, { 
				status: 'sent_to_kitchen',
				subtotal_amount: calculatedSubtotal,
				tax_amount: calculatedTax,
				total_amount: calculatedTotal
			});
			console.log('✅ Ticket status updated to sent_to_kitchen');

			// Process each item and assign to appropriate station with timestamps
			const now = new Date().toISOString();
			const kitchenItems = [];
			const barItems = [];
			
			for (const item of currentTicketItems) {
				// Get the menu item data to determine category and station
				const menuItem = $menuItems.find(m => m.id === item.menu_item_id);
				const category = menuItem?.category || item.category || 'unknown';
				
				// Determine kitchen station based on category
				let station = 'kitchen'; // default
				if (category === 'beverage' || category === 'drink') {
					station = 'bar';
					barItems.push(item);
				} else if (category === 'appetizer' || category === 'side_dish') {
					station = 'cold_station';
					kitchenItems.push(item);
				} else if (category === 'main_course') {
					station = 'grill';
					kitchenItems.push(item);
				} else if (category === 'dessert') {
					station = 'cold_station';
					kitchenItems.push(item);
				} else {
					kitchenItems.push(item);
				}

				console.log(`📍 Item "${menuItem?.name || 'Unknown'}" → ${station} (category: ${category})`);

				// Update each ticket item with station assignment and timestamp
				await collections.updateTicketItem(item.id, {
					status: 'sent_to_kitchen',
					kitchen_station: station,
					ordered_at: now
				});
			}

			console.log(`🍳 Kitchen items: ${kitchenItems.length}, 🍹 Bar items: ${barItems.length}`);

			// Trigger drink ticket printing for bar items
			if (barItems.length > 0) {
				printDrinkTickets(barItems);
				console.log('🖨️ Drink tickets printed');
			}

			// Refresh data to update table status displays
			await collections.getTickets();
			await collections.getTicketItems();
			console.log('🔄 Data refreshed for table status updates');

			// Close modal and update table status to show it has active orders
			closeTicketModal();
			console.log('✅ SEND ORDERS COMPLETE - Check table for status change');

		} catch (error) {
			console.error('❌ SEND ORDERS ERROR:', error);
			alert('Error sending order to kitchen. Please try again.');
		}
	}

	// Print drink tickets for bar
	function printDrinkTickets(barItems) {
		const ticketContent = generateDrinkTicketContent(barItems);
		
		// Open print dialog with formatted drink tickets
		const printWindow = window.open('', '_blank');
		printWindow.document.write(ticketContent);
		printWindow.document.close();
		printWindow.print();
		printWindow.close();
	}

	// Generate formatted drink ticket content
	function generateDrinkTicketContent(barItems) {
		const ticketNumber = currentTicket?.ticket_number || 'N/A';
		const tableNumber = currentTicket?.table_id || 'N/A';
		const timestamp = new Date().toLocaleTimeString('en-US', { 
			hour12: false, 
			hour: '2-digit', 
			minute: '2-digit' 
		});

		let content = `
			<html>
			<head>
				<style>
					body { font-family: monospace; font-size: 12px; margin: 0; }
					.ticket { width: 3in; margin: 0.25in 0; padding: 0.1in; border: 1px dashed #000; }
					.header { text-align: center; font-weight: bold; margin-bottom: 0.1in; }
					.item { margin: 0.05in 0; }
					.modifications { font-size: 10px; color: #666; margin-left: 0.1in; }
					.footer { margin-top: 0.1in; border-top: 1px solid #000; text-align: center; font-size: 10px; }
				</style>
			</head>
			<body>
		`;

		barItems.forEach((item, index) => {
			const seatInfo = item.seat_number ? `Seat ${item.seat_number}` : '';
			const guestName = item.seat_name ? `(${item.seat_name})` : '';
			const modifications = item.modifications || '';
			const specialInstructions = item.special_instructions || '';

			content += `
				<div class="ticket">
					<div class="header">
						BAR ORDER #${ticketNumber}<br>
						Table ${tableNumber} | ${timestamp}
					</div>
					<div class="item">
						<strong>${item.quantity}x ${item.name}</strong><br>
						${seatInfo} ${guestName}
					</div>
					${modifications ? `<div class="modifications">Mods: ${modifications}</div>` : ''}
					${specialInstructions ? `<div class="modifications">Special: ${specialInstructions}</div>` : ''}
					<div class="footer">
						Item ${index + 1} of ${barItems.length}
					</div>
				</div>
			`;
		});

		content += `
			</body>
			</html>
		`;

		return content;
	}

	// Get table order status and details
	function getTableOrderStatus(tableId) {
		// DEBUG: Check what data we have
		console.log('🔍 DEBUG TABLE STATUS for tableId:', tableId);
		console.log('📋 All tickets:', $tickets);
		console.log('🍽️ All ticket items:', $ticketItems);
		
		const tableTickets = $tickets.filter(ticket => 
			ticket.table_id === tableId && 
			['sent_to_kitchen', 'preparing', 'ready'].includes(ticket.status)
		);
		
		console.log('🎯 Matching tickets for table', tableId + ':', tableTickets);
		
		if (tableTickets.length === 0) {
			console.log('❌ No matching tickets found for table', tableId);
			return null;
		}
		
		const ticket = tableTickets[0]; // Most recent active ticket
		const items = $ticketItems.filter(item => item.ticket_id === ticket.id);
		
		// Calculate overall status based on items
		const statuses = items.map(item => item.status);
		let overallStatus = 'sent_to_kitchen';
		
		if (statuses.every(s => s === 'ready')) {
			overallStatus = 'ready';
		} else if (statuses.some(s => s === 'preparing')) {
			overallStatus = 'preparing';
		}
		
		// Calculate estimated time remaining
		const now = new Date();
		const maxEstimated = Math.max(...items.map(item => {
			const menuItem = $menuItems.find(m => m.id === item.menu_item_id);
			const prepTime = menuItem?.preparation_time || 12;
			const orderedAt = new Date(item.ordered_at);
			const elapsed = Math.floor((now - orderedAt) / (1000 * 60));
			return Math.max(0, prepTime - elapsed);
		}));
		
		return {
			ticket,
			items,
			status: overallStatus,
			estimatedTimeRemaining: maxEstimated,
			itemCount: items.length
		};
	}

	// Get table status color and icon
	function getTableStatusDisplay(tableId) {
		const orderStatus = getTableOrderStatus(tableId);
		
		if (!orderStatus) {
			return {
				color: 'bg-gray-500',
				icon: '○',
				text: 'Available'
			};
		}
		
		const { status, estimatedTimeRemaining } = orderStatus;
		
		switch (status) {
			case 'sent_to_kitchen':
				return {
					color: 'bg-orange-500',
					icon: '🍳',
					text: `Cooking (${estimatedTimeRemaining}m)`
				};
			case 'preparing':
				return {
					color: 'bg-blue-500',
					icon: '⏳',
					text: `Preparing (${estimatedTimeRemaining}m)`
				};
			case 'ready':
				return {
					color: 'bg-green-500 animate-pulse',
					icon: '✅',
					text: 'Ready for Pickup'
				};
			case 'served':
				return {
					color: 'bg-purple-500',
					icon: '🍽️',
					text: 'Served'
				};
			case 'payment_processing':
				return {
					color: 'bg-yellow-500',
					icon: '💳',
					text: 'Processing Payment'
				};
			default:
				return {
					color: 'bg-gray-500',
					icon: '○',
					text: 'Available'
				};
		}
	}

	// Get simple dot indicator for condensed view
	function getTableDotStatus(tableId) {
		const table = $tables.find(t => t.id === tableId);
		const existingTicket = $tickets.find(t => t.table_id === tableId && !['closed'].includes(t.status));
		
		// Check table status first (cleaning takes priority)
		if (table?.status_field === 'cleaning') {
			return {
				color: 'bg-gray-500',
				title: 'Table being cleaned',
				animate: ''
			};
		}
		
		if (!existingTicket) {
			return {
				color: 'bg-green-500',
				title: 'Available for new orders',
				animate: ''
			};
		}
		
		switch (existingTicket.status) {
			case 'open':
				return {
					color: 'bg-orange-500',
					title: 'Order in progress',
					animate: ''
				};
			case 'sent_to_kitchen':
				return {
					color: 'bg-blue-500',
					title: 'Sent to kitchen',
					animate: ''
				};
			case 'preparing':
				return {
					color: 'bg-blue-500',
					title: 'Being prepared',
					animate: ''
				};
			case 'ready':
				return {
					color: 'bg-blue-500',
					title: 'Ready for pickup',
					animate: 'slow-pulse'
				};
			case 'served':
				return {
					color: 'bg-purple-500',
					title: 'Served to guests',
					animate: ''
				};
			case 'payment_processing':
				return {
					color: 'bg-yellow-500',
					title: 'Processing payment',
					animate: ''
				};
			default:
				return {
					color: 'bg-gray-500',
					title: 'Unknown status',
					animate: ''
				};
		}
	}

	// Show table order details modal
	let showTableDetailsModal = false;
	let selectedTableDetails = null;
	
	// Bar orders for bartenders
	let barOrders = [];
	
	// Payment processing
	let showPaymentModal = false;
	let selectedTableForPayment = null;
	let paymentAmount = 0;
	let paymentMethod = 'card';
	let stripe = null;
	let cardElement = null;
	let stripeElements = null;
	
	// Tip handling
	let tipAmount = 0;
	
	// Reactive statement to ensure UI updates when tip changes
	$: totalWithTip = paymentAmount + tipAmount;
	let tipPercentage = 18; // Default 18%
	let customTipAmount = '';
	let tipMethod = 'percentage'; // 'percentage', 'custom', 'none', 'guest_signed'
	let guestSignedTip = '';
	let showGuestTipEntry = false;
	
	// Payment workflow state
	let paymentWorkflowStep = 'initial'; // 'initial', 'card_authorized', 'awaiting_tip', 'finalizing'
	let authorizedPaymentIntent = null;
	let authorizedAmount = 0;

	function showTableOrderDetails(table) {
		const orderStatus = getTableOrderStatus(table.id);
		if (!orderStatus) return;
		
		console.log('🍽️ Opening table details for:', table.table_name || table.table_number_field);
		console.log('📋 Order status:', orderStatus);
		console.log('🍴 Menu items:', $menuItems);
		
		selectedTableDetails = {
			table,
			...orderStatus
		};
		showTableDetailsModal = true;
	}

	function closeTableDetailsModal() {
		showTableDetailsModal = false;
		selectedTableDetails = null;
	}



	// Load bar orders for bartenders
	async function loadBarOrders() {
		if (user?.role?.toLowerCase() !== 'bartender') {
			barOrders = [];
			return;
		}

		try {
			// Get all active ticket items that are bar orders
			const allItems = get(ticketItems) || [];
			console.log('🍹 DEBUG: All ticket items for bar filtering:', allItems);
			
			const drinkItems = allItems.filter(item => item.course === 'drink');
			console.log('🍸 DEBUG: Drink items:', drinkItems);
			
			const activeBarItems = allItems.filter(item => 
				item.kitchen_station === 'bar' &&
				(item.status === 'sent_to_kitchen' || item.status === 'preparing' || item.status === 'ready')
			);
			
			console.log('🍹 DEBUG: Active bar items after filtering:', activeBarItems);

			// Add metadata to items and filter by 7-minute visibility window
			const now = new Date();
			barOrders = activeBarItems
				.map(item => {
					const orderedAt = new Date(item.ordered_at);
					const preparedAt = item.prepared_at ? new Date(item.prepared_at) : null;
					const elapsedMinutes = Math.floor((now - orderedAt) / (1000 * 60));
					const estimatedMinutes = 3; // Bar items typically 3 minutes
					const remainingMinutes = Math.max(0, estimatedMinutes - elapsedMinutes);
					
					// Calculate display time - 7 minutes from when marked ready
					const displayUntil = preparedAt ? 
						new Date(preparedAt.getTime() + 7 * 60 * 1000) : // 7 minutes after ready
						new Date(orderedAt.getTime() + 10 * 60 * 1000); // 10 minutes after ordered if not ready yet
					
					const shouldDisplay = now < displayUntil;
					const minutesUntilHidden = Math.max(0, Math.floor((displayUntil - now) / (1000 * 60)));
					
					console.log(`🍹 DEBUG Item ${item.id}:`, {
						status: item.status,
						ordered_at: item.ordered_at,
						prepared_at: item.prepared_at,
						elapsedMinutes,
						shouldDisplay,
						displayUntil: displayUntil.toISOString(),
						now: now.toISOString()
					});
					
					return {
						...item,
						elapsedMinutes,
						estimatedMinutes,
						remainingMinutes,
						isOverdue: elapsedMinutes > estimatedMinutes,
						shouldDisplay,
						minutesUntilHidden,
						displayUntil
					};
				})
				.filter(item => {
					console.log(`🍹 Filtering item ${item.id}: shouldDisplay = ${item.shouldDisplay}`);
					// Temporarily disable time filtering for debugging
					return true; // Show all bar items regardless of timing
				}); // Only show items within display window
			
		} catch (error) {
			console.error('Error loading bar orders:', error);
		}
	}

	// Mark bar item as preparing
	async function markBarItemPreparing(item) {
		try {
			await collections.updateTicketItem(item.id, {
				status: 'preparing'
			});
			await loadBarOrders();
		} catch (error) {
			console.error('Error marking bar item preparing:', error);
		}
	}

	// Mark bar item as ready
	async function markBarItemReady(item) {
		try {
			await collections.updateTicketItem(item.id, {
				status: 'ready',
				prepared_at: new Date().toISOString()
			});
			await loadBarOrders();
		} catch (error) {
			console.error('Error marking bar item ready:', error);
		}
	}

	// Send reminder to server about uncollected drink
	async function sendDrinkReminder(item) {
		try {
			// Create a simple notification system (could be enhanced with real notifications)
			const tableInfo = item.expand?.ticket_id?.table_id || 'Unknown Table';
			const drinkName = item.expand?.menu_item_id?.name || 'Drink';
			
			alert(`🔔 REMINDER: ${item.quantity}x ${drinkName} ready for pickup at ${tableInfo}!\n\nDrink has been ready for ${item.elapsedMinutes}+ minutes.`);
			
			// Could also:
			// - Send to server's device notification
			// - Add to a reminder queue
			// - Log in notification system
			console.log(`📱 Reminder sent: ${drinkName} ready at ${tableInfo}`);
			
		} catch (error) {
			console.error('Error sending drink reminder:', error);
		}
	}

	// Payment processing functions
	async function openPaymentModal(table, orderStatus) {
		selectedTableForPayment = table;
		paymentAmount = orderStatus.ticket.total_amount || 0;
		
		// Reset tip values
		tipAmount = 0;
		tipPercentage = 18;
		customTipAmount = '';
		guestSignedTip = '';
		tipMethod = 'percentage';
		showGuestTipEntry = false;
		calculateTip();
		
		showPaymentModal = true;
		
		// Initialize Stripe Elements when modal opens
		await setupStripeElements();
	}

	// Handle cash payment directly in table details view
	async function handleDirectCashPayment(table, orderStatus) {
		try {
			const ticket = orderStatus.ticket;
			const totalAmount = ticket.total_amount;
			
			// Show confirmation before processing
			const confirmed = confirm(`Process cash payment of $${totalAmount.toFixed(2)} for Table ${table.table_name || table.table_number_field}?`);
			
			if (!confirmed) return;
			
			console.log('💵 Processing direct cash payment for:', table.table_name);
			
			// Update ticket status to closed and mark as cash payment
			await collections.updateTicket(ticket.id, {
				status: 'closed',
				payment_method: 'cash',
				payment_status: 'completed',
				payment_amount: totalAmount,
				completed_at: new Date().toISOString()
			});
			
			// Update table status to cleaning
			await collections.updateTable(table.id, {
				status_field: 'cleaning'
			});
			
			// Auto-mark as available after 5 seconds (simulate cleaning)
			setTimeout(async () => {
				await collections.updateTable(table.id, {
					status_field: 'available'
				});
			}, 5000);
			
			console.log('✅ Cash payment processed successfully');
			
			// Close table details modal and show success
			showTableDetailsModal = false;
			selectedTableDetails = null;
			
			alert(`Cash payment of $${totalAmount.toFixed(2)} processed successfully!\nTable ready for cleaning.`);
			
			// Refresh data
			await collections.getTickets();
			await collections.getTables();
			
		} catch (error) {
			console.error('❌ Error processing cash payment:', error);
			alert('Error processing cash payment. Please try again.');
		}
	}

	// Handle card payment directly in table details view
	async function handleDirectCardPayment(table, orderStatus) {
		try {
			const ticket = orderStatus.ticket;
			const totalAmount = ticket.total_amount;
			
			// Show confirmation before processing
			const confirmed = confirm(`Process card payment of $${totalAmount.toFixed(2)} for Table ${table.table_name || table.table_number_field}?`);
			
			if (!confirmed) return;
			
			console.log('💳 Processing direct card payment for:', table.table_name);
			
			// Simulate card processing (in real app, this would call Stripe)
			await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time
			
			// Update ticket status to closed and mark as card payment
			await collections.updateTicket(ticket.id, {
				status: 'closed',
				payment_method: 'card',
				payment_status: 'completed',
				payment_amount: totalAmount,
				completed_at: new Date().toISOString()
			});
			
			// Update table status to cleaning
			await collections.updateTable(table.id, {
				status_field: 'cleaning'
			});
			
			// Auto-mark as available after 5 seconds (simulate cleaning)
			setTimeout(async () => {
				await collections.updateTable(table.id, {
					status_field: 'available'
				});
			}, 5000);
			
			console.log('✅ Card payment processed successfully');
			
			// Close table details modal and show success
			showTableDetailsModal = false;
			selectedTableDetails = null;
			
			alert(`Card payment of $${totalAmount.toFixed(2)} processed successfully!\nTable ready for cleaning.`);
			
			// Refresh data
			await collections.getTickets();
			await collections.getTables();
			
		} catch (error) {
			console.error('❌ Error processing card payment:', error);
			alert('Error processing card payment. Please try again.');
		}
	}

	function closePaymentModal() {
		showPaymentModal = false;
		selectedTableForPayment = null;
		paymentAmount = 0;
		paymentMethod = 'card';
		
		// Reset tip values
		tipAmount = 0;
		tipPercentage = 18;
		customTipAmount = '';
		guestSignedTip = '';
		tipMethod = 'percentage';
		showGuestTipEntry = false;
		
		// Clean up Stripe Elements
		if (cardElement) {
			cardElement.unmount();
			cardElement = null;
		}
		stripeElements = null;
	}

	function calculateTip() {
		console.log('🔍 calculateTip debug:', { tipMethod, guestSignedTip, customTipAmount, tipPercentage, paymentAmount });
		if (tipMethod === 'percentage') {
			tipAmount = Math.round((paymentAmount * tipPercentage / 100) * 100) / 100;
		} else if (tipMethod === 'custom') {
			tipAmount = parseFloat(customTipAmount) || 0;
		} else if (tipMethod === 'guest_signed') {
			tipAmount = parseFloat(guestSignedTip) || 0;
		} else {
			tipAmount = 0;
		}
		console.log('🔍 calculateTip result:', { tipAmount });
	}

	function selectTipPercentage(percentage) {
		tipMethod = 'percentage';
		tipPercentage = percentage;
		calculateTip();
	}

	function selectCustomTip() {
		tipMethod = 'custom';
		calculateTip();
	}

	function selectNoTip() {
		tipMethod = 'none';
		tipAmount = 0;
		showGuestTipEntry = false;
	}

	function selectGuestSignedTip() {
		tipMethod = 'guest_signed';
		showGuestTipEntry = true;
		calculateTip();
	}

	function getTotalAmount() {
		console.log('🔍 getTotalAmount debug:', { paymentAmount, tipAmount, total: paymentAmount + tipAmount });
		return paymentAmount + tipAmount;
	}

	// Step 1: Swipe card and authorize payment
	// Simulate swiping a test card (for development)
	async function simulateCardSwipe() {
		if (!currentTicket || !currentTicketItems.length) {
			console.error('❌ Missing currentTicket or currentTicketItems');
			return;
		}
		
		// Ensure selectedTableForPayment is set for the payment workflow
		if (!selectedTableForPayment && selectedTable) {
			selectedTableForPayment = selectedTable;
		}
		
		try {
			console.log('🧪 Simulating card swipe with test data...');
			
			// Import Stripe dynamically
			const { loadStripe } = await import('@stripe/stripe-js');
			const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
			
			if (!stripe) {
				throw new Error('Stripe failed to load - check your publishable key');
			}

			const baseAmount = currentTicket?.total_amount || 0;
			// Authorize 30% more to allow for tips (common restaurant practice)
			const authAmount = Math.round(baseAmount * 1.3 * 100) / 100;
			authorizedAmount = baseAmount; // Keep track of original amount for display
			
			const tableToUse = selectedTableForPayment || selectedTable;
		const paymentData = {
			amount: Math.round(authAmount * 100), // Stripe uses cents - authorize with tip buffer
				currency: 'usd',
				table_id: tableToUse.id,
				ticket_id: currentTicket.id,
				description: `Authorization for Table ${selectedTable?.table_name || selectedTable?.table_number_field}`,
				capture_method: 'manual' // Authorize only, capture later with tip
			};

			console.log('🔍 Debug: Payment data being sent:', paymentData);

			// Create payment intent for authorization
			const response = await fetch('/api/create-payment-intent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(paymentData)
			});

			console.log('🔍 Debug: Response status:', response.status);

			if (!response.ok) {
				throw new Error('Failed to create payment intent');
			}

			const { client_secret } = await response.json();
			
			// Use test payment method token for simulation
			const { error, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
				payment_method: 'pm_card_visa' // Stripe test payment method
			});

			if (error) {
				throw new Error(error.message);
			}

			if (paymentIntent.status === 'requires_capture') {
				console.log('✅ Test card authorized successfully');
				authorizedPaymentIntent = paymentIntent;
				paymentWorkflowStep = 'card_authorized';
				
				// Auto-advance to print slip step
				setTimeout(() => {
					printTipSlip();
				}, 1000);
			}
		} catch (error) {
			console.error('❌ Test card authorization failed:', error);
			alert(`Test card authorization failed: ${error.message}`);
		}
	}

	async function swipeCard() {
		if (!currentTicket || !currentTicketItems.length) {
			console.error('❌ Missing currentTicket or currentTicketItems');
			return;
		}
		
		try {
			console.log('💳 Step 1: Swiping card and authorizing payment...');
			console.log('🎯 Current workflow step:', paymentWorkflowStep);
			console.log('🔍 Debug: Current ticket:', currentTicket);
			console.log('🔍 Debug: Selected table:', selectedTable);
			console.log('🔍 Debug: Environment check:', {
				publishable_key: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ? 'EXISTS' : 'MISSING',
				pocketbase_url: import.meta.env.VITE_POCKETBASE_URL
			});
			
			// Import Stripe dynamically
			const { loadStripe } = await import('@stripe/stripe-js');
			const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
			
			if (!stripe) {
				throw new Error('Stripe failed to load - check your publishable key');
			}

			const baseAmount = currentTicket?.total_amount || 0;
			authorizedAmount = baseAmount;
			
			const paymentData = {
				amount: Math.round(baseAmount * 100), // Stripe uses cents
				currency: 'usd',
				table_id: selectedTable.id,
				ticket_id: currentTicket.id,
				description: `Authorization for Table ${selectedTable?.table_name || selectedTable?.table_number_field}`,
				capture_method: 'manual' // Authorize only, capture later with tip
			};

			console.log('🔍 Debug: Payment data being sent:', paymentData);

			// Create payment intent for authorization
			const response = await fetch('/api/create-payment-intent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(paymentData)
			});

			console.log('🔍 Debug: Response status:', response.status);
			console.log('🔍 Debug: Response headers:', Object.fromEntries(response.headers.entries()));

			if (!response.ok) {
				throw new Error('Failed to create payment intent');
			}

			const { client_secret } = await response.json();
			
			// Setup Stripe Elements if not already done
			await setupStripeElements();
			
			// Confirm payment (authorize only)
			const { error, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
				payment_method: {
					card: cardElement,
					billing_details: {
						name: 'Restaurant Customer'
					}
				}
			});

			if (error) {
				throw new Error(error.message);
			}

			if (paymentIntent.status === 'requires_capture') {
				console.log('✅ Card authorized successfully');
				authorizedPaymentIntent = paymentIntent;
				paymentWorkflowStep = 'card_authorized';
				
				// Auto-advance to print slip step
				setTimeout(() => {
					printTipSlip();
				}, 1000);
			}
		} catch (error) {
			console.error('❌ Card authorization failed:', error);
			alert(`Card authorization failed: ${error.message}`);
		}
	}

	// Step 2: Print receipt slip for guest to add tip
	function printTipSlip() {
		if (!currentTicket || !currentTicketItems.length) return;
		
		const slipContent = generateTipSlipContent();
		const printWindow = window.open('', '_blank');
		printWindow.document.write(slipContent);
		printWindow.document.close();
		printWindow.print();
		printWindow.close();
		
		// Move to next step
		paymentWorkflowStep = 'awaiting_tip';
	}

	// Capture payment with tip (after card is already authorized)
	async function capturePaymentWithTip() {
		if (!authorizedPaymentIntent) {
			console.error('❌ No authorized payment intent found');
			return;
		}

		try {
			const finalAmount = Math.round(totalWithTip * 100); // Convert to cents
			const tableToUse = selectedTableForPayment || selectedTable;
			
			// Clear status logging
			console.log(`💳 PAYMENT CAPTURE: Attempting to finalize payment for $${totalWithTip.toFixed(2)}`);
			console.log(`📋 ORDER STATE: Table=${selectedTable?.table_name || 'none'} • Items=${currentTicketItems.length} • Ticket=${currentTicket?.ticket_number || 'none'}`);
			
			if (currentTicket) {
				console.log(`🎫 TICKET INFO: #${currentTicket.ticket_number} • Status=${currentTicket.status || 'unknown'} • Server=${user?.email}`);
			}
			
			if (currentTicketItems.length === 0) {
				// Debug the authorized payment intent structure
				console.log('🔍 DEBUG authorizedPaymentIntent:', authorizedPaymentIntent);
				console.log('🔍 DEBUG authorizedPaymentIntent keys:', Object.keys(authorizedPaymentIntent || {}));
				
				// Try to find the order by looking for active tickets
				console.log(`🔍 RECOVERY: Searching for active tickets to match payment of $${(authorizedPaymentIntent.amount / 100).toFixed(2)}`);
				
				try {
					// Find tickets that are ready for payment (sent_to_kitchen with items ready/preparing)
					const matchingTickets = $tickets.filter(ticket => {
						return ticket.status === 'sent_to_kitchen' || ticket.status === 'payment_processing';
					});
					
					console.log(`🔍 RECOVERY: Found ${matchingTickets.length} active tickets`);
					
					if (matchingTickets.length === 1) {
						// If only one active ticket, use it
						const ticket = matchingTickets[0];
						const table = $tables.find(t => t.id === ticket.table_id);
						
						console.log(`✅ RECOVERY SUCCESS: Using active ticket #${ticket.ticket_number} for table ${table?.table_name}`);
						
						// Restore the order context
						selectedTable = table;
						currentTicket = ticket;
						currentTicketItems = await collections.getTicketItems(ticket.id);
						
						console.log(`📋 RESTORED ORDER: Table=${selectedTable?.table_name} • Items=${currentTicketItems.length} • Ticket=#${currentTicket.ticket_number}`);
					} else if (matchingTickets.length > 1) {
						// Multiple active tickets - show them for selection
						const ticketOptions = matchingTickets.map(ticket => {
							const table = $tables.find(t => t.id === ticket.table_id);
							return `• Table ${table?.table_name || table?.table_number_field} - Ticket #${ticket.ticket_number}`;
						}).join('\n');
						
						const choice = confirm(`Found ${matchingTickets.length} active tickets:\n\n${ticketOptions}\n\nWould you like to:\n• OK = Use first ticket (Table ${$tables.find(t => t.id === matchingTickets[0].table_id)?.table_name})\n• Cancel = Manually select table first`);
						
						if (choice) {
							// Use first ticket
							const ticket = matchingTickets[0];
							const table = $tables.find(t => t.id === ticket.table_id);
							
							console.log(`✅ USER CHOICE: Using ticket #${ticket.ticket_number} for table ${table?.table_name}`);
							
							// Restore the order context
							selectedTable = table;
							currentTicket = ticket;
							currentTicketItems = await collections.getTicketItems(ticket.id);
							
							console.log(`📋 RESTORED ORDER: Table=${selectedTable?.table_name} • Items=${currentTicketItems.length} • Ticket=#${currentTicket.ticket_number}`);
						} else {
							throw new Error('Please select the correct table first, then retry payment');
						}
					} else {
						// No active tickets found
						throw new Error('No active tickets found to match this payment');
					}
				} catch (recoveryError) {
					console.error('❌ RECOVERY FAILED:', recoveryError);
					alert(`❌ Cannot find order data for payment.\n\nError: ${recoveryError.message}\n\nPlease:\n1. Cancel this payment\n2. Select the correct table\n3. Try payment again`);
					
					authorizedPaymentIntent = null;
					paymentWorkflowStep = 'initial';
					showPaymentModal = false;
					return;
				}
			}
			
			// Create ticket if none exists (for cases where items were added without creating a ticket)
			if (!currentTicket?.id && currentTicketItems.length > 0) {
				console.log('🎫 Creating ticket for payment processing...');
				try {
					await createNewTicket(2); // Default customer count
					console.log('🎫 Ticket created:', currentTicket);
				} catch (error) {
					console.error('❌ Failed to create ticket:', error);
					throw new Error(`Failed to create ticket: ${error.message}`);
				}
			}
			
			// Validate required data before processing payment
			if (!currentTicket?.id || !currentTicket?.ticket_number) {
				throw new Error('No ticket found - please create a ticket with items before processing payment');
			}
			
			// Save ticket data BEFORE any async operations that might clear it
			const ticketToSave = { ...currentTicket };
			const itemsToSave = [...currentTicketItems];
			
			const response = await fetch('/api/capture-payment', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					payment_intent_id: authorizedPaymentIntent.id,
					final_amount: totalWithTip,
					tip_amount: Math.round(tipAmount * 100),
					table_id: tableToUse?.id,
					ticket_id: currentTicket?.id
				})
			});

			if (!response.ok) {
				throw new Error('Failed to capture payment');
			}

			const result = await response.json();
			console.log('✅ Payment captured successfully:', result);
			
			// Update ticket and table status for restaurant workflow
			if (tableToUse) {
				try {
					// Update ticket to payment processing, then paid
					if (currentTicket) {
						await collections.updateTicket(currentTicket.id, {
							status: 'payment_processing',
							tip_amount: tipAmount,
							total_amount: totalWithTip
						});
						
						// After a brief delay, mark as paid
						setTimeout(async () => {
						if (ticketToSave?.id) {
						await collections.updateTicket(ticketToSave.id, {
						  status: 'paid'
						 });
						  console.log('✅ Ticket marked as paid');
						}
					}, 2000);
					}
					
					// Set table to cleaning state for bussers
					await collections.updateTable(tableToUse.id, { 
						status_field: 'cleaning',
						current_party_size: 0
					});
					
					// After a brief cleaning period, set to available
					setTimeout(async () => {
						await collections.updateTable(tableToUse.id, { 
							status_field: 'available'
						});
						console.log('✅ Table marked as available for new guests');
					}, 5000); // 5 seconds cleaning time
					
					console.log('✅ Table set to cleaning - ready for bussers');
				} catch (error) {
					console.error('❌ Error updating table/ticket status:', error);
				}
			}
			
			// Save to database for persistence FIRST (before clearing data)
			try {
				console.log('🔍 Debug objects before saving:', {
					tableToUse: tableToUse,
					ticketToSave: ticketToSave,
					user: user,
					tableToUse_id: tableToUse?.id,
					ticketToSave_id: ticketToSave?.id,
					user_id: user?.id
				});
				
				const orderData = {
					table_id: tableToUse?.id,
					ticket_id: ticketToSave?.id,
					server_id: user?.id,
					ticket_number: ticketToSave?.ticket_number,
					table_name: tableToUse?.table_name || tableToUse?.table_number_field,
					subtotal_amount: authorizedAmount,
					tip_amount: tipAmount,
					total_amount: totalWithTip,
					payment_method: 'card',
					items_json: JSON.stringify(itemsToSave),
					completed_at: new Date().toISOString()
				};
				console.log('🔍 Attempting to save order data:', orderData);
				
				await collections.createCompletedOrder(orderData);
				console.log('✅ Order saved to database');
				
				// Create payment record
				const paymentData = {
					ticket_id: ticketToSave?.id,
					amount: authorizedAmount, // Subtotal without tip
					payment_method: 'card',
					tip_amount: tipAmount,
					processed_by: user?.id,
					transaction_id: result.payment_intent_id,
					status: 'completed',
					notes: `Payment captured successfully - Table ${tableToUse?.table_name}`,
					processed_at: new Date().toISOString(),
					stripe_id: authorizedPaymentIntent.id
				};
				
				await collections.createPayment(paymentData);
				console.log('💳 Payment record created in database');
			} catch (error) {
				console.error('❌ Failed to save order/payment to database:', error.message, error);
				// Continue anyway - don't block the payment flow
			}
			
			// Save completed order to local history
			const completedOrder = {
				id: ticketToSave?.id || Date.now().toString(),
				ticket_number: ticketToSave?.ticket_number,
				table_name: tableToUse?.table_name || tableToUse?.table_number_field,
				items: [...itemsToSave],
				subtotal: authorizedAmount,
				tip: tipAmount,
				total: totalWithTip,
				timestamp: new Date().toISOString(),
				status: 'paid'
			};
			
			completedOrders = [completedOrder, ...completedOrders]; // Add to beginning of array
			
			// Reset for new order
			showPaymentModal = false;
			authorizedPaymentIntent = null;
			paymentWorkflowStep = 'initial';
			showGuestTipEntry = false;
			
			// Clear current order for new ticket
			console.log('🧹 Clearing current order data...');
			currentTicket = null;
			currentTicketItems = [];
			orderTab = 'current'; // Switch back to current order tab
			
			// Also clear any cached ticket data
			tickets.update(items => items.filter(ticket => ticket.id !== currentTicket?.id));
			ticketItems.update(items => items.filter(item => item.ticket_id !== currentTicket?.id));
			
			console.log('✅ Order data cleared. currentTicket:', currentTicket, 'currentTicketItems:', currentTicketItems);
			
			alert(`Payment successful! Total charged: $${totalWithTip.toFixed(2)}\nTable ready for cleaning.`);
			
		} catch (error) {
			console.error('❌ Payment capture failed:', error);
			console.error('❌ Error details:', {
				message: error.message,
				stack: error.stack,
				cause: error.cause
			});
			alert(`Payment capture failed: ${error.message}`);
		}
	}

	// Step 3: Enter tip and finalize payment
	async function finalizePaymentWithTip() {
		closeTicketModal();
		const tableToUse = selectedTableForPayment || selectedTable;
		if (!tableToUse) {
			console.error('❌ No table selected for payment');
			return;
		}
		const orderStatus = getTableOrderStatus(tableToUse.id);
		if (orderStatus) {
			// Set flag to indicate we're in tip entry mode
			paymentAmount = authorizedAmount;
			showGuestTipEntry = true;
			tipMethod = 'guest_signed';
			calculateTip(); // Update tip calculation
			showPaymentModal = true;
		}
	}

	// Generate tip slip content (for after card authorization)
	function generateTipSlipContent() {
		const restaurantName = "PARC Bistro";
		const tableNumber = selectedTable?.table_name || selectedTable?.table_number_field || 'N/A';
		const ticketNumber = currentTicket?.ticket_number || 'N/A';
		const serverName = user?.name || 'Server';
		const timestamp = new Date().toLocaleString('en-US', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});

		const total = authorizedAmount;

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<title>Customer Receipt - ${restaurantName}</title>
				<style>
					body { 
						font-family: monospace; 
						font-size: 14px; 
						line-height: 1.4; 
						margin: 20px;
						width: 300px;
					}
					.header { text-align: center; margin-bottom: 15px; }
					.restaurant-name { font-size: 18px; font-weight: bold; }
					.details { margin-bottom: 15px; }
					.amount-line { display: flex; justify-content: space-between; margin: 8px 0; font-size: 16px; }
					.tip-section { margin: 25px 0; border-top: 2px solid #000; padding-top: 15px; }
					.tip-line { display: flex; justify-content: space-between; align-items: center; margin: 12px 0; }
					.write-line { border-bottom: 2px solid #000; width: 120px; height: 25px; display: inline-block; }
					.signature-section { margin-top: 25px; border-top: 1px solid #000; padding-top: 15px; }
					.signature-line { margin: 15px 0; border-bottom: 2px solid #000; height: 25px; }
					.total-box { border: 2px solid #000; padding: 10px; margin: 15px 0; text-align: center; }
					.footer { text-align: center; margin-top: 20px; font-size: 12px; }
					@media print {
						body { margin: 0; }
					}
				</style>
			</head>
			<body>
				<div class="header">
					<div class="restaurant-name">${restaurantName}</div>
					<div>Customer Copy</div>
				</div>
				
				<div class="details">
					<div>Table: ${tableNumber} | Check: ${ticketNumber}</div>
					<div>Server: ${serverName}</div>
					<div>Date: ${timestamp}</div>
				</div>
				
				<div class="amount-line">
					<span><strong>Subtotal:</strong></span>
					<span><strong>$${total.toFixed(2)}</strong></span>
				</div>
				
				<div class="tip-section">
					<div style="text-align: center; margin-bottom: 15px; font-weight: bold;">
						ADD TIP & TOTAL BELOW
					</div>
					
					<div class="tip-line">
						<span>Tip: $</span>
						<div class="write-line"></div>
					</div>
					
					<div class="total-box">
						<div style="font-size: 12px; margin-bottom: 5px;">TOTAL AMOUNT</div>
						<div style="font-size: 18px; font-weight: bold;">
							$ <span class="write-line" style="width: 150px;"></span>
						</div>
					</div>
				</div>
				
				<div class="signature-section">
					<div style="margin-bottom: 10px;">Signature:</div>
					<div class="signature-line"></div>
					
					<div style="font-size: 12px; margin-top: 15px;">
						□ I agree to pay the above total amount according to my card issuer agreement.
					</div>
				</div>
				
				<div class="footer">
					<div><strong>Thank you for dining with us!</strong></div>
					<div>Card ending in ****${authorizedPaymentIntent?.payment_method?.card?.last4 || '****'}</div>
					<div style="margin-top: 10px; font-size: 11px;">
						Please add tip and sign above.<br>
						Return to server when complete.
					</div>
				</div>
			</body>
			</html>
		`;
	}

	// Generate guest check content
	function generateGuestCheckContent() {
		const restaurantName = "PARC Bistro";
		const tableNumber = selectedTable?.table_name || selectedTable?.table_number_field || 'N/A';
		const ticketNumber = currentTicket?.ticket_number || 'N/A';
		const serverName = user?.name || 'Server';
		const timestamp = new Date().toLocaleString('en-US', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});

		const subtotal = currentTicket?.subtotal_amount || 0;
		const tax = currentTicket?.tax_amount || 0;
		const total = currentTicket?.total_amount || 0;

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<title>Guest Check - ${restaurantName}</title>
				<style>
					body { 
						font-family: monospace; 
						font-size: 12px; 
						line-height: 1.4; 
						margin: 20px;
						width: 300px;
					}
					.header { text-align: center; margin-bottom: 20px; }
					.restaurant-name { font-size: 16px; font-weight: bold; }
					.details { margin-bottom: 10px; }
					.items { margin: 20px 0; }
					.item { display: flex; justify-content: space-between; margin: 5px 0; }
					.totals { margin-top: 20px; border-top: 1px solid #000; padding-top: 10px; }
					.total-line { display: flex; justify-content: space-between; margin: 3px 0; }
					.signature-section { margin-top: 30px; border-top: 1px solid #000; padding-top: 20px; }
					.signature-line { margin: 15px 0; border-bottom: 1px solid #000; height: 20px; }
					.tip-section { margin-top: 20px; }
					.final-total { font-weight: bold; font-size: 14px; }
					@media print {
						body { margin: 0; }
					}
				</style>
			</head>
			<body>
				<div class="header">
					<div class="restaurant-name">${restaurantName}</div>
					<div>Authentic French Cuisine</div>
				</div>
				
				<div class="details">
					<div>Table: ${tableNumber}</div>
					<div>Check #: ${ticketNumber}</div>
					<div>Server: ${serverName}</div>
					<div>Date: ${timestamp}</div>
					<div>Guests: ${currentTicket?.customer_count || 1}</div>
				</div>
				
				<div class="items">
					${currentTicketItems.map(item => {
						const menuItem = $menuItems.find(m => m.id === item.menu_item_id);
						const itemName = menuItem?.name_field || item.item_name || 'Item';
						const modifications = item.modifications ? ` (${item.modifications})` : '';
						const seatInfo = item.seat_number ? ` - Seat ${item.seat_number}` : '';
						
						return `
							<div class="item">
								<span>${item.quantity}x ${itemName}${modifications}${seatInfo}</span>
								<span>$${(item.unit_price * item.quantity).toFixed(2)}</span>
							</div>
						`;
					}).join('')}
				</div>
				
				<div class="totals">
					<div class="total-line">
						<span>Subtotal:</span>
						<span>$${subtotal.toFixed(2)}</span>
					</div>
					<div class="total-line">
						<span>Tax (8.875%):</span>
						<span>$${tax.toFixed(2)}</span>
					</div>
					<div class="total-line final-total">
						<span>Total:</span>
						<span>$${total.toFixed(2)}</span>
					</div>
				</div>
				
				<div class="signature-section">
					<div class="tip-section">
						<div class="total-line">
							<span>Subtotal:</span>
							<span>$${total.toFixed(2)}</span>
						</div>
						<div style="margin: 10px 0;">
							<span>Tip: $</span>
							<div class="signature-line" style="display: inline-block; width: 100px; margin-left: 10px;"></div>
						</div>
						<div class="total-line final-total" style="border-top: 1px solid #000; padding-top: 5px;">
							<span>Total: $</span>
							<div class="signature-line" style="display: inline-block; width: 100px; margin-left: 10px;"></div>
						</div>
					</div>
					
					<div style="margin-top: 20px;">
						<div>Signature:</div>
						<div class="signature-line"></div>
					</div>
					
					<div style="text-align: center; margin-top: 20px; font-size: 10px;">
						<div>Thank you for dining with us!</div>
						<div>Gratuity not included</div>
					</div>
				</div>
			</body>
			</html>
		`;
	}

	async function setupStripeElements() {
		try {
			const { loadStripe } = await import('@stripe/stripe-js');
			stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
			
			if (!stripe) {
				console.error('Failed to load Stripe');
				return;
			}

			// Create Stripe Elements instance
			stripeElements = stripe.elements({
				appearance: {
					theme: 'night',
					variables: {
						colorPrimary: '#3b82f6',
						colorBackground: '#374151',
						colorText: '#ffffff',
						colorDanger: '#ef4444',
						fontFamily: 'Inter, system-ui, sans-serif',
						spacingUnit: '4px',
						borderRadius: '8px'
					}
				}
			});

			// Create card element
			cardElement = stripeElements.create('card', {
				style: {
					base: {
						color: '#ffffff',
						fontFamily: 'Inter, system-ui, sans-serif',
						fontSize: '16px',
						'::placeholder': {
							color: '#9ca3af'
						}
					}
				}
			});

			// Mount card element
			setTimeout(() => {
				const cardContainer = document.getElementById('stripe-card-element');
				if (cardContainer && cardElement) {
					cardElement.mount('#stripe-card-element');
				}
			}, 100);
		} catch (error) {
			console.error('Error setting up Stripe Elements:', error);
		}
	}

	async function processPayment() {
		if (!selectedTableForPayment) return;

		try {
			console.log('💳 Processing payment:', {
				table: selectedTableForPayment,
				amount: paymentAmount,
				method: paymentMethod
			});

			if (paymentMethod === 'card') {
				// Integrate with Stripe here
				await processStripePayment();
			} else if (paymentMethod === 'cash') {
				await processCashPayment();
			} else if (paymentMethod === 'split') {
				await processSplitPayment();
			}

		} catch (error) {
			console.error('Error processing payment:', error);
			alert('Payment processing failed. Please try again.');
		}
	}

	async function processStripePayment() {
		console.log('🔄 Processing Stripe payment...');
		
		// Update ticket status to payment_processing at start of payment
		if (currentTicket?.id) {
			try {
				await collections.updateTicket(currentTicket.id, { status: 'payment_processing' });
				console.log(`🎫 TICKET STATUS: Updated #${currentTicket.ticket_number} to payment_processing`);
			} catch (error) {
				console.warn('Failed to update ticket status to payment_processing:', error);
			}
		}
		
		try {
			// Import Stripe dynamically
			const { loadStripe } = await import('@stripe/stripe-js');
			const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
			
			if (!stripe) {
				throw new Error('Stripe failed to load - check your publishable key');
			}

			const totalAmount = getTotalAmount();
			const paymentData = {
				amount: Math.round(totalAmount * 100), // Stripe uses cents
				currency: 'usd',
				table_id: selectedTableForPayment.id,
				ticket_id: selectedTableForPayment.ticketId,
				description: `Payment for Table ${selectedTableForPayment.number}`,
				subtotal: paymentAmount,
				tip_amount: tipAmount,
				tip_percentage: tipMethod === 'percentage' ? tipPercentage : null
			};

			// Create payment intent
			const response = await fetch('/api/create-payment-intent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(paymentData)
			});

			if (!response.ok) {
				throw new Error('Failed to create payment intent');
			}

			const { client_secret } = await response.json();
			
			// Confirm payment with Stripe Elements
			const { error, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
				payment_method: {
					card: cardElement,
					billing_details: {
						name: 'Restaurant Customer'
					}
				}
			});

			if (error) {
				throw new Error(error.message);
			}

			if (paymentIntent.status === 'succeeded') {
				console.log('✅ Stripe payment processed successfully');
				
				// Finalize table closure with Stripe data
				await finalizeTableClosure('card', {
					...paymentData,
					stripe_payment_intent_id: paymentIntent.id,
					amount: paymentAmount // Convert back to dollars for display
				});
			} else if (paymentIntent.status === 'requires_capture' && authorizedPaymentIntent) {
				// This is a tip addition to an existing authorization
				console.log('✅ Capturing payment with tip...');
				
				const finalAmount = getTotalAmount();
				const captureResponse = await fetch('/api/capture-payment', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						payment_intent_id: authorizedPaymentIntent.id,
						tip_amount: tipAmount,
						final_amount: finalAmount
					})
				});

				if (!captureResponse.ok) {
					throw new Error('Failed to capture payment with tip');
				}

				const { payment_intent: capturedPayment } = await captureResponse.json();
				
				console.log('✅ Payment captured with tip successfully');
				
				// Finalize table closure
				await finalizeTableClosure('card', {
					amount: finalAmount,
					subtotal: paymentAmount,
					tip_amount: tipAmount,
					stripe_payment_intent_id: capturedPayment.id,
					currency: 'usd',
					table_id: selectedTableForPayment.id,
					ticket_id: selectedTableForPayment.ticketId
				});
			}
		} catch (error) {
			console.error('❌ Stripe payment failed:', error);
			alert(`Payment failed: ${error.message}`);
			throw error;
		}
	}

	async function processCashPayment() {
		console.log('💵 Processing cash payment...');
		
		const totalAmount = getTotalAmount();
		const paymentData = {
			amount: totalAmount,
			currency: 'usd',
			table_id: selectedTableForPayment.id,
			method: 'cash',
			subtotal: paymentAmount,
			tip_amount: tipAmount,
			tip_percentage: tipMethod === 'percentage' ? tipPercentage : null
		};

		await finalizeTableClosure('cash', paymentData);
	}

	async function processSplitPayment() {
		console.log('🔄 Processing split payment...');
		// Split payment logic would go here
		alert('Split payment feature coming soon!');
	}

	async function finalizeTableClosure(method, paymentData) {
		try {
			// 1. Update ticket status to 'paid'
			const orderStatus = getTableOrderStatus(selectedTableForPayment.id);
			if (orderStatus && orderStatus.ticket) {
				await collections.updateTicket(orderStatus.ticket.id, {
					status: 'paid',
					payment_method: method,
					payment_amount: paymentAmount,
					payment_timestamp: new Date().toISOString()
				});
			}

			// 2. Update all ticket items to 'completed'
			const currentTicketItems = get(ticketItems).filter(item => 
				item.ticket_id === orderStatus.ticket.id
			);
			
			for (const item of currentTicketItems) {
				await collections.updateTicketItem(item.id, {
					status: 'completed'
				});
			}

			// 3. Update table status to 'cleaning' then 'available'
			await collections.updateTable(selectedTableForPayment.id, {
				status_field: 'cleaning'
			});

			// 4. Auto-mark as available after 5 seconds (simulate cleaning)
			setTimeout(async () => {
				await collections.updateTable(selectedTableForPayment.id, {
					status_field: 'available'
				});
				
				// Refresh data
				await Promise.all([
					collections.getTickets(),
					collections.getTables()
				]);
				
			}, 5000);

			// 5. Close modal and show success
			closePaymentModal();
			alert(`✅ Payment successful! Table ${selectedTableForPayment.table_name || selectedTableForPayment.table_number_field} will be available in 5 seconds.`);

			// 6. Refresh data immediately
			await Promise.all([
				collections.getTickets(),
				collections.getTables()
			]);

		} catch (error) {
			console.error('Error finalizing table closure:', error);
			alert('Error closing table. Please try again.');
		}
	}



	// Speech Recognition Functions
	function initSpeechRecognition() {
		if (typeof window !== 'undefined') {
			const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
			if (SpeechRecognition) {
				speechSupported = true;
				recognition = new SpeechRecognition();
				recognition.continuous = false;
				recognition.interimResults = false;
				recognition.lang = 'en-US';
				
				recognition.onresult = (event) => {
					const transcript = event.results[0][0].transcript;
					if (isRecording) {
						specialInstructions = (specialInstructions + ' ' + transcript).trim();
						isRecording = false;
					} else if (isRecordingEdit) {
						editSpecialInstructions = (editSpecialInstructions + ' ' + transcript).trim();
						isRecordingEdit = false;
					} else if (isRecordingSearch) {
						searchQuery = transcript;
						isRecordingSearch = false;
					}
				};
				
				recognition.onerror = (event) => {
					console.error('Speech recognition error:', event.error);
					isRecording = false;
					isRecordingEdit = false;
					isRecordingSearch = false;
				};
				
				recognition.onend = () => {
					isRecording = false;
					isRecordingEdit = false;
					isRecordingSearch = false;
				};
			} else {
				speechSupported = false;
				console.log('Speech recognition not supported');
			}
		}
	}

	function startVoiceRecording(isEdit = false, isSearch = false) {
		if (!recognition || !speechSupported) return;
		
		if (isSearch) {
			isRecordingSearch = true;
			isRecording = false;
			isRecordingEdit = false;
		} else if (isEdit) {
			isRecordingEdit = true;
			isRecording = false;
			isRecordingSearch = false;
		} else {
			isRecording = true;
			isRecordingEdit = false;
			isRecordingSearch = false;
		}
		
		try {
			recognition.start();
		} catch (error) {
			console.error('Error starting speech recognition:', error);
			isRecording = false;
			isRecordingEdit = false;
			isRecordingSearch = false;
		}
	}

	function stopVoiceRecording() {
		if (recognition) {
			recognition.stop();
		}
		isRecording = false;
		isRecordingEdit = false;
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100">
	<!-- Header -->
	<header class="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center py-6">
				<div class="flex items-center space-x-4">
					<div class="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
						<span class="font-bold text-xl">P</span>
					</div>
					<div>
						<h1 class="text-2xl font-bold">PARC Portal</h1>
						<p class="text-sm text-green-400">Server Dashboard</p>
					</div>
				</div>
				<div class="flex items-center space-x-4">
					{#if user}
						<div class="flex items-center space-x-2">
							<div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
								<span class="font-medium">{user.name?.charAt(0) || user.email?.charAt(0) || 'S'}</span>
							</div>
							<div class="hidden md:block">
								<p class="font-medium">{user.name || user.email}</p>
								<p class="text-sm text-green-400">Server</p>
							</div>
						</div>
					{/if}

					{#if todayShifts.length > 0 && todayShifts.some(s => s.status === 'in_progress')}
						<button
							on:click={() => {
								todayShifts.forEach(shift => {
									if (shift.status === 'in_progress') {
										resetBreakReminder(shift.id);
									}
								});
								alert('Break reminder reset!');
							}}
							class="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors text-xs font-medium"
							title="Reset break reminder if it's stuck"
						>
							🔄 Reset Break
						</button>
					{/if}
					<button
						on:click={logout}
						class="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm font-medium text-white"
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
			<div class="flex space-x-8">
				{#each [
					{ id: 'today', name: 'Today\'s Shifts', icon: '📅' },
					{ id: 'schedule', name: 'My Schedule', icon: '🗓️' },
					{ id: 'menu', name: 'Menu Reference', icon: '🍽️' },
					{ id: 'profile', name: 'My Profile', icon: '👤' }
				] as tab}
					<button
						class="flex items-center space-x-2 py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap {
							activeTab === tab.id 
								? 'border-green-500 text-green-400' 
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
		{#if activeTab === 'today'}
			<!-- Today's Shifts -->
			<div class="mb-8">
				<h2 class="text-3xl font-bold">Today's Shifts</h2>
				<p class="text-gray-400 mt-2">{formatDate(getTodayString())}</p>
			</div>

			<!-- Bar Orders Section (for bartenders only) -->
			{#if user?.role?.toLowerCase() === 'bartender'}
				<div class="mb-8">
					<div class="mb-6">
						<h2 class="text-3xl font-bold">🍹 Bar Orders ({barOrders.length})</h2>
						<p class="text-gray-400 mt-2">Drinks waiting to be prepared</p>
						<button
							on:click={() => {
								console.log('🔍 DEBUG BAR ORDERS:');
								console.log('User role:', user?.role);
								console.log('All ticket items:', $ticketItems);
								console.log('Bar orders:', barOrders);
								loadBarOrders();
							}}
							class="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm mt-2"
						>
							🔍 Debug Bar Orders
						</button>
					</div>

					{#if barOrders.length > 0}
						<div class="grid gap-4">
							{#each barOrders as item}
								<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 {
									item.isOverdue ? 'border-red-500 bg-red-900/10' : 
									item.remainingMinutes <= 1 ? 'border-orange-500 bg-orange-900/10' : 
									''
								}">
									<div class="flex justify-between items-start">
										<div class="flex-1">
											<h3 class="text-xl font-medium text-white">
												{item.quantity}x {item.expand?.menu_item_id?.name || 'Unknown Drink'}
											</h3>
											
											<div class="text-sm text-gray-400 mt-1">
												Table {item.expand?.ticket_id?.table_id || 'Unknown'} • 
												Ticket #{item.expand?.ticket_id?.ticket_number || 'N/A'}
											</div>

											{#if item.seat_number}
												<div class="text-sm text-blue-300 mt-1">
													Seat {item.seat_number} {item.seat_name ? `(${item.seat_name})` : ''}
												</div>
											{/if}

											{#if item.modifications}
												<div class="text-sm text-yellow-300 mt-2">
													<strong>Modifications:</strong> {item.modifications}
												</div>
											{/if}

											{#if item.expand?.ticket_id?.notes}
												<div class="text-sm text-blue-300 mt-2">
													<strong>Table Notes:</strong> {item.expand.ticket_id.notes}
												</div>
											{/if}
										</div>

										<!-- Timer Display -->
										<div class="text-right min-w-0">
											{#if item.isOverdue}
												<div class="text-red-400 font-bold text-sm">
													OVERDUE
												</div>
												<div class="text-sm text-gray-400">
													{item.elapsedMinutes}m elapsed
												</div>
											{:else if item.remainingMinutes <= 1}
												<div class="text-orange-400 font-bold text-sm">
													DUE NOW
												</div>
												<div class="text-sm text-gray-400">
													{item.elapsedMinutes}m elapsed
												</div>
											{:else if item.remainingMinutes <= 3}
												<div class="text-yellow-400 font-bold text-sm">
													{item.remainingMinutes}m left
												</div>
												<div class="text-sm text-gray-400">
													{item.elapsedMinutes}m elapsed
												</div>
											{/if}
											<div class="text-xs text-gray-500">
												Est. {item.estimatedMinutes}m total
											</div>
										</div>
									</div>

									<div class="flex space-x-3 mt-4">
										{#if item.status === 'sent_to_kitchen'}
											<button
												on:click={() => markBarItemPreparing(item)}
												class="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm font-medium transition-colors"
											>
												🍹 Start Making
											</button>
										{/if}
										
										{#if item.status !== 'ready'}
											<button
												on:click={() => markBarItemReady(item)}
												class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
											>
												✅ Ready for Pickup
											</button>
										{:else}
											<button
												on:click={() => sendDrinkReminder(item)}
												class="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-medium transition-colors"
											>
												🔔 Send Reminder
											</button>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="text-center py-8 text-gray-400">
							<div class="text-4xl mb-2">🍹</div>
							<p>No pending drink orders</p>
							<p class="text-sm mt-1">Orders appear here when servers send drinks to the bar</p>
						</div>
					{/if}
				</div>
			{/if}

			{#if $loading.shifts}
				<div class="flex justify-center items-center h-64">
					<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
				</div>
			{:else if todayShifts.length === 0}
				<div class="text-center py-12">
					<div class="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-700/50 flex items-center justify-center">
						<span class="text-4xl">😴</span>
					</div>
					<h3 class="text-xl font-medium mb-2">No shifts today</h3>
					<p class="text-gray-400">Enjoy your day off!</p>
				</div>
			{:else}
				<div class="grid gap-6">
					{#each todayShifts as shift}
						<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
							<div class="flex justify-between items-start mb-4">
								<div>
									<h3 class="text-xl font-bold">{shift.expand?.staff_member?.first_name || shift.position}</h3>
									<p class="text-gray-400">
										{formatTime(shift.start_time)} - {formatTime(shift.end_time)}
										{#if shift.break_duration}
											<span class="ml-2 text-sm">(Break: {shift.break_duration} min)</span>
										{/if}
									</p>
								</div>
								<span class="px-3 py-1 rounded-full text-sm {
									shift.status === 'confirmed' ? 'bg-green-900/50 text-green-300' :
									shift.status === 'scheduled' ? 'bg-blue-900/50 text-blue-300' :
									shift.status === 'completed' ? 'bg-gray-700/50 text-gray-300' :
									'bg-yellow-900/50 text-yellow-300'
								}">
									{shift.status}
								</span>
							</div>

							{#if shift.notes}
								<div class="mb-4 p-3 bg-gray-700/30 rounded-lg">
									<p class="text-sm text-gray-300">{shift.notes}</p>
								</div>
							{/if}

							<!-- Show assigned section and tables for confirmed shifts -->
							{#if shift.status === 'confirmed' && shift.assigned_section && getSectionName(shift.assigned_section)}
								<div class="mb-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
									<div class="flex justify-between items-start mb-3">
										<div class="flex-1">
											<h4 class="text-green-300 font-medium flex items-center mb-1">
												<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
												</svg>
												{showAllSections ? 'Your Section' : 'Assigned Section'}: {getSectionName(shift.assigned_section)}
											</h4>
											{#if !showAllSections}
												<p class="text-xs text-gray-400 ml-6">
													Condensed view for larger table display. Use "Expand Sections" to customize your default view by expanding to view larger detailed display.
												</p>
												
												<!-- Table Click Behavior Preference -->
												<div class="ml-6 mt-2 space-y-1">
													<p class="text-xs text-gray-500 font-medium">Table Click Behavior:</p>
													<div class="flex gap-4 text-xs">
														<label class="flex items-center gap-1 cursor-pointer">
															<input 
																type="radio" 
																bind:group={tableClickBehavior} 
																value="direct"
																on:change={saveStateToLocalStorage}
																class="w-3 h-3 text-green-600 bg-gray-700 border-gray-600 focus:ring-green-500 focus:ring-2"
															>
															<span class="text-gray-400">Direct Access (fewer clicks)</span>
														</label>
														<label class="flex items-center gap-1 cursor-pointer">
															<input 
																type="radio" 
																bind:group={tableClickBehavior} 
																value="detailed"
																on:change={saveStateToLocalStorage}
																class="w-3 h-3 text-green-600 bg-gray-700 border-gray-600 focus:ring-green-500 focus:ring-2"
															>
															<span class="text-gray-400">Show Details First (more control)</span>
														</label>
													</div>
												</div>
											{/if}
										</div>
										<button
											on:click={() => {
												showAllSections = !showAllSections;
												saveStateToLocalStorage();
											}}
											class="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 hover:text-white transition-colors"
										>
											{showAllSections ? 'Hide' : 'Expand'} Sections
										</button>
									</div>
									
									{#if $loading.tables}
										<p class="text-sm text-green-400">Section assigned (tables loading...)</p>
									{:else}
										{#if currentShiftTables.length > 0}
										 <div class="space-y-2">
										 <p class="text-sm text-green-400 font-medium">Your Tables: ({currentShiftTables.length} total, helping {selectedAdditionalSections.size} sections)</p>
										<div class="flex flex-wrap gap-2">
										 {#each currentShiftTables as table}
										 {@const tableSection = $sections.find(s => s.section_code === table.section_code)}
										 {@const dotStatus = getTableDotStatus(table.id)}
										 <button 
										 on:click={() => {
											 const hasOrders = $tickets.find(t => t.table_id === table.id && !['closed'].includes(t.status));
											 if (tableClickBehavior === 'direct') {
												 handleTableClick(table);
											 } else {
												 hasOrders ? showTableOrderDetails(table) : handleTableClick(table);
											 }
										 }}
										 class="px-3 py-1 bg-gray-800/50 border rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-700/50 transition-colors cursor-pointer border-green-600 text-green-300"
										 >
										 <span>{table.table_name || table.table_number_field}</span>
										 {#if table.capacity || table.seats_field}
										 <span class="text-xs text-gray-400">({table.capacity || table.seats_field} seats)</span>
										 {/if}
										 <span class="text-xs px-1 py-0.5 rounded {tableSection?.id === shift.assigned_section ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/50 text-blue-400'}">
										 {tableSection?.section_name || table.section_code || 'Unknown Section'}
										 </span>
										 
										 <!-- Enhanced table status indicator -->
										 <div 
										 class="w-2 h-2 rounded-full {dotStatus.color} {dotStatus.animate || ''}" 
										 title={dotStatus.title}
										 ></div>
										 </button>
										 {/each}
												</div>
											</div>
										{:else if !showAllSections}
										<div class="space-y-2">
										 {#if $tables && $tables.length > 0}
										  <div class="space-y-1">
										   <p class="text-sm text-blue-400 font-medium">All Available Tables:</p>
										   <div class="flex flex-wrap gap-2">
										    {#each $tables as table}
										     {@const existingTicket = $tickets.find(t => t.table_id === table.id && !['closed'].includes(t.status))}
										     <button 
										      on:click={() => handleTableClick(table)}
										      class="px-2 py-1 bg-gray-700/50 border rounded text-xs font-medium flex items-center gap-1 hover:bg-gray-600/50 transition-colors cursor-pointer border-blue-600 text-blue-300"
										     >
										      <span>{table.table_name || table.table_number_field}</span>
										      <span class="text-xs text-gray-400">({table.section_code})</span>
										      {#if existingTicket}
										       <div class="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
										      {:else}
										       <div class="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
										      {/if}
										     </button>
										    {/each}
										   </div>
										  </div>
										 {:else}
										  <p class="text-sm text-red-400">No tables found in database</p>
										 {/if}
										</div>
										{/if}
									{/if}

									<!-- Expanded sections view -->
									{#if showAllSections}
										<div class="mt-4 pt-4 border-t border-green-700/50">
											<div class="mb-3">
												<p class="text-sm text-green-400 font-medium">All Restaurant Sections:</p>
											</div>
											<div class="space-y-3">
												{#each getAllSections() as section}
													<div class="bg-gray-800/30 rounded-lg p-3 {selectedAdditionalSections.has(section.id) ? 'ring-2 ring-blue-500' : ''}">
														<div class="flex justify-between items-center mb-2">
															<h5 class="text-sm font-medium text-gray-300 flex items-center">
																<span class="w-2 h-2 rounded-full mr-2 {
																	section.id === shift.assigned_section ? 'bg-green-500' : 
																	selectedAdditionalSections.has(section.id) ? 'bg-blue-500' : 'bg-gray-500'
																}"></span>
																{section.section_name}
																{#if section.id === shift.assigned_section}
																	<span class="ml-2 text-xs text-green-400">(Your Section)</span>
																{:else if selectedAdditionalSections.has(section.id)}
																	<span class="ml-2 text-xs text-blue-400">(Helping)</span>
																{/if}
															</h5>
															{#if section.id !== shift.assigned_section}
																<button
																	on:click={() => toggleAdditionalSection(section.id)}
																	class="px-2 py-1 text-xs rounded {
																		selectedAdditionalSections.has(section.id) 
																			? 'bg-blue-600 text-white' 
																			: 'bg-gray-600 hover:bg-gray-500 text-gray-300'
																	}"
																>
																	{selectedAdditionalSections.has(section.id) ? 'Stop Helping' : 'Help Here'}
																</button>
															{/if}
														</div>
														{#if section.tables && section.tables.length > 0}
															<!-- Table Grid View -->
															<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
																{#each section.tables as table}
																	{@const statusDisplay = getTableStatusDisplay(table.id)}
																	{@const hasOrders = getTableOrderStatus(table.id) !== null}
																	{@const orderStatus = getTableOrderStatus(table.id)}
									{@const debugOrderStatus = (() => {
										const status = getTableOrderStatus(table.id);
										console.log(`🔍 Table ${table.table_name} click check:`, status ? 'HAS ORDERS' : 'NO ORDERS', status);
										return status;
									})()}
																	
																	<button
																		on:click={() => {
																			console.log('🔥 CLICKED TABLE:', table.table_name || table.table_number_field);
																			console.log('🔥 HAS ORDERS:', hasOrders);
																			console.log('🔥 ORDER STATUS:', orderStatus);
																			console.log('🔥 CLICK BEHAVIOR:', tableClickBehavior);
																			
																			if (tableClickBehavior === 'direct') {
																				return handleTableClick(table);
																			} else {
																				return hasOrders ? showTableOrderDetails(table) : handleTableClick(table);
																			}
																		}}
																		class="relative p-4 rounded-xl border-2 transition-all hover:scale-105 bg-gray-800/50 backdrop-blur-sm {
																			section.id === shift.assigned_section ? 'border-green-500' : 
																			selectedAdditionalSections.has(section.id) ? 'border-blue-500' : 'border-gray-600'
																		} {hasOrders ? 'cursor-pointer shadow-lg' : 'hover:border-gray-500'}"
																		title={hasOrders ? 'Click to view order details' : 'Click to create new order'}
																	>
																		<!-- Status Indicator (Top Right) -->
																		<div class="absolute -top-2 -right-2 w-6 h-6 rounded-full {statusDisplay.color} border-2 border-gray-800 flex items-center justify-center shadow-lg">
																			<span class="text-xs font-bold">{statusDisplay.icon}</span>
																		</div>
																		
																		<!-- Table Content -->
																		<div class="text-center">
																			<!-- Table Number -->
																			<div class="text-xl font-bold text-white mb-1">
																				{table.table_name || table.table_number_field}
																			</div>
																			
																			<!-- Seats -->
																			<div class="text-sm text-gray-400 mb-2">
																				{table.capacity || table.seats_field} seats
																			</div>
																			
																			<!-- Section Name -->
																			<div class="text-xs font-medium text-gray-300 mb-2">
																				{section.area_name || 'Available'}
																			</div>
																			
																			<!-- Order Status -->
																			{#if hasOrders && orderStatus}
																				<div class="space-y-1">
																					<div class="text-xs font-medium {
																						statusDisplay.status === 'ready' ? 'text-green-400' : 
																						statusDisplay.status === 'preparing' ? 'text-blue-400' : 
																						'text-orange-400'
																					}">
																						{statusDisplay.text}
																					</div>
																					<div class="text-xs text-gray-500">
																						{orderStatus.itemCount} items
																					</div>
																				</div>
																			{:else}
																				<div class="text-xs text-gray-500">
																					Available
																				</div>
																			{/if}
																		</div>
																	</button>
																{/each}
															</div>
														{:else}
															<p class="text-xs text-gray-500">No tables assigned</p>
														{/if}
													</div>
												{/each}
											</div>
											
											{#if selectedAdditionalSections.size > 0}
												<div class="mt-3 p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
													<p class="text-sm text-blue-300 font-medium">
														You're helping in {selectedAdditionalSections.size} additional section{selectedAdditionalSections.size > 1 ? 's' : ''}
													</p>
													<p class="text-xs text-blue-400 mt-1">
														You can manage tables in these sections using the management tools above
													</p>
												</div>
											{/if}
										</div>
									{/if}
								</div>
							{/if}

							<div class="flex flex-col space-y-3">
								<!-- Shift Timer Display -->
								{#if shiftTimers.has(shift.id)}
									{#key timerDisplayKey}
										{@const countdown = getCountdownInfo(shift.id)}
										{#if countdown}
											<div class="p-4 rounded-lg border {
												countdown.color === 'green' ? 'bg-green-900/20 border-green-700' :
												countdown.color === 'blue' ? 'bg-blue-900/20 border-blue-700' :
												countdown.color === 'yellow' ? 'bg-yellow-900/20 border-yellow-700' :
												'bg-gray-900/20 border-gray-700'
											}">
												<!-- Main Timer Display -->
												<div class="flex items-center space-x-3 mb-3">
													<svg class="w-6 h-6 {
														countdown.color === 'green' ? 'text-green-400' :
														countdown.color === 'blue' ? 'text-blue-400' :
														countdown.color === 'yellow' ? 'text-yellow-400' :
														'text-gray-400'
													}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
													</svg>
													<div class="flex-1">
														<p class="text-sm font-medium {
															countdown.color === 'green' ? 'text-green-300' :
															countdown.color === 'blue' ? 'text-blue-300' :
															countdown.color === 'yellow' ? 'text-yellow-300' :
															'text-gray-300'
														}">{countdown.message}</p>
														<p class="text-2xl font-mono font-bold {
															countdown.color === 'green' ? 'text-green-400' :
															countdown.color === 'blue' ? 'text-blue-400' :
															countdown.color === 'yellow' ? 'text-yellow-400' :
															'text-gray-400'
														}">
															{#if countdown.type === 'break' || countdown.type === 'clockout'}
																{countdown.hours.toString().padStart(2, '0')}:{countdown.minutes.toString().padStart(2, '0')}:{countdown.seconds.toString().padStart(2, '0')}
															{:else}
																{countdown.hours}h {countdown.minutes}m
															{/if}
														</p>
													</div>
												</div>
												
												<!-- Metadata Grid -->
												<div class="grid grid-cols-2 gap-3 text-xs">
													<div class="space-y-1">
														<div class="flex justify-between">
															<span class="text-gray-400">Time Worked:</span>
															<span class="font-medium text-gray-300">{countdown.elapsedTime}</span>
														</div>
														<div class="flex justify-between">
															<span class="text-gray-400">Shift Length:</span>
															<span class="font-medium text-gray-300">{countdown.shiftDuration}</span>
														</div>
														<div class="flex justify-between">
															<span class="text-gray-400">Break Time:</span>
															<span class="font-medium text-gray-300">{countdown.breakDuration}</span>
														</div>
													</div>
													<div class="space-y-1">
														<div class="flex justify-between">
															<span class="text-gray-400">Total Tables:</span>
															<span class="font-medium text-gray-300">{countdown.tablesTotal}</span>
														</div>
														<div class="flex justify-between">
															<span class="text-gray-400">Occupied:</span>
															<span class="font-medium {countdown.tablesOccupied > 0 ? 'text-red-400' : 'text-green-400'}">{countdown.tablesOccupied}</span>
														</div>
														<div class="flex justify-between">
															<span class="text-gray-400">Available:</span>
															<span class="font-medium {countdown.tablesAvailable === countdown.tablesTotal ? 'text-green-400' : 'text-yellow-400'}">{countdown.tablesAvailable}</span>
														</div>
													</div>
												</div>

												<!-- Status Indicator -->
												{#if countdown.type === 'break'}
													<div class="mt-3 text-center">
														<span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-900/50 text-green-300">
															🍕 Break due soon
														</span>
													</div>
												{:else if countdown.type === 'clockout'}
													<div class="mt-3 text-center">
														<span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-900/50 text-blue-300">
															✅ All tables clear - ready to clock out
														</span>
													</div>
												{:else if countdown.type === 'working'}
													<div class="mt-3 text-center">
														<span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-900/50 text-yellow-300">
															⚠️ {countdown.tablesOccupied} table{countdown.tablesOccupied !== 1 ? 's' : ''} still occupied
														</span>
													</div>
												{:else if countdown.type === 'overtime'}
													<div class="mt-3 text-center">
														<span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-900/50 text-blue-300">
															🎯 Shift complete - ready to clock out
														</span>
													</div>
												{/if}
											</div>
										{/if}
									{/key}
								{/if}

								<!-- Action Buttons -->
								<div class="flex space-x-3">
									{#if shift.status === 'scheduled'}
										<button
											on:click={() => updateShiftStatus(shift.id, 'confirmed')}
											class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium"
										>
											Confirm Attendance
										</button>
									{:else if shift.status === 'confirmed'}
										{@const timer = shiftTimers.get(shift.id)}
										{@const inProgress = timer !== undefined}
										{@const pastBreakTime = isPastBreakTime(shift.id)}
										
										{#if !inProgress}
											<!-- Start Shift Button -->
											<button
												on:click={() => updateShiftStatus(shift.id, 'in_progress')}
												class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium flex items-center space-x-2"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
												</svg>
												<span>Start Shift</span>
											</button>
										{:else}
											{@const timer = shiftTimers.get(shift.id)}
											{@const elapsed = currentTime - timer.startTime}
											{@const threeHours = 3 * 60 * 60 * 1000}
											{@const atBreakTime = elapsed >= threeHours && !timer.breakReminded}
											
											<!-- Take Break Button (prominent when it's break time) -->
											{#if atBreakTime}
												<button
													on:click={() => {
														timer.breakReminded = true;
														shiftTimers.set(shift.id, timer);
														alert('Enjoy your 30-minute break! Remember to mark your tables as available when you step away.');
													}}
													class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium flex items-center space-x-2"
												>
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
													</svg>
													<span>Take Your Break</span>
												</button>
											{/if}
											
											<!-- Mark Complete Button (dynamic size based on time) -->
											<button
												on:click={() => updateShiftStatus(shift.id, 'completed')}
												class="px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-all {
													pastBreakTime 
														? 'bg-blue-600 hover:bg-blue-700 text-white' 
														: 'bg-gray-600 hover:bg-gray-500 text-gray-300 text-xs px-3 py-1'
												}"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
												</svg>
												<span>{pastBreakTime ? 'Complete Shift' : 'End Early'}</span>
											</button>
											
											<!-- Additional Options (when not past break time) -->
											{#if !pastBreakTime}
												<div class="flex space-x-2">
													<!-- Take Break Button -->
													<button
														on:click={() => {
															const timer = shiftTimers.get(shift.id);
															if (timer) {
																timer.breakReminded = true;
																shiftTimers.set(shift.id, timer);
																alert('Enjoy your break! Remember to mark your tables as available when you step away.');
															}
														}}
														class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium flex items-center space-x-1"
													>
														<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
														</svg>
														<span>Break</span>
													</button>
													
													<!-- Emergency Options -->
													<button
														on:click={() => {
															if (confirm('Are you feeling sick and need to end your shift early?')) {
																updateShiftStatus(shift.id, 'completed');
															}
														}}
														class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium flex items-center space-x-1"
													>
														<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
														</svg>
														<span>Sick</span>
													</button>
													<button
														on:click={() => {
															if (confirm('Have you transferred all your sections to another server?')) {
																updateShiftStatus(shift.id, 'completed');
															}
														}}
														class="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs font-medium flex items-center space-x-1"
													>
														<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
														</svg>
														<span>Transfer</span>
													</button>
												</div>
											{/if}
										{/if}
									{:else if shift.status === 'in_progress'}
										<!-- This shouldn't happen, but just in case -->
										<button
											on:click={() => updateShiftStatus(shift.id, 'completed')}
											class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center space-x-2"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
											</svg>
											<span>Complete Shift</span>
										</button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Bar Orders Section (for bartenders only) -->
			{#if user?.role?.toLowerCase() === 'bartender'}
			<!-- Debug: Always show for bartenders to debug -->
			<div class="mt-8">
					<div class="mb-6">
						<!-- Bar Orders moved to correct position -->
						<p class="text-gray-400 mt-2">Drinks waiting to be prepared</p>
						<button
							on:click={() => {
								console.log('🔍 DEBUG BAR ORDERS:');
								console.log('User role:', user?.role);
								console.log('All ticket items:', $ticketItems);
								console.log('Bar orders:', barOrders);
								loadBarOrders();
							}}
							class="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm mt-2"
						>
							🔍 Debug Bar Orders
						</button>
					</div>

				{#if barOrders.length > 0}

					<div class="grid gap-4">
						{#each barOrders as item}
							<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 {
								item.isOverdue ? 'border-red-500 bg-red-900/10' : 
								item.remainingMinutes <= 1 ? 'border-orange-500 bg-orange-900/10' : 
								''
							}">
								<div class="flex justify-between items-start">
									<div class="flex-1">
										<h3 class="text-xl font-medium text-white">
											{item.quantity}x {item.expand?.menu_item_id?.name || 'Unknown Drink'}
										</h3>
										
										<div class="text-sm text-gray-400 mt-1">
											Table {item.expand?.ticket_id?.table_id || 'Unknown'} • 
											Ticket #{item.expand?.ticket_id?.ticket_number || 'N/A'}
										</div>

										{#if item.seat_number}
											<div class="text-sm text-blue-300 mt-1">
												Seat {item.seat_number} {item.seat_name ? `(${item.seat_name})` : ''}
											</div>
										{/if}

										{#if item.modifications}
											<div class="text-sm text-yellow-300 mt-2">
												<strong>Modifications:</strong> {item.modifications}
											</div>
										{/if}

										{#if item.special_instructions}
											<div class="text-sm text-orange-300 mt-2">
												<strong>Special Instructions:</strong> {item.special_instructions}
											</div>
										{/if}
									</div>

									<div class="text-right ml-4">
										{#if item.status === 'ready'}
											<div class="text-2xl font-bold text-green-400 mb-2">
												✅ READY
											</div>
											<div class="text-sm text-orange-400">
												Hides in {item.minutesUntilHidden}m
											</div>
										{:else}
											<div class="text-3xl font-bold {item.isOverdue ? 'text-red-400' : 'text-green-400'} mb-2">
												{item.remainingMinutes}m
											</div>
											<div class="text-sm text-gray-400">
												{item.elapsedMinutes}m elapsed
											</div>
										{/if}
										<div class="text-xs text-gray-500">
											Est. {item.estimatedMinutes}m total
										</div>
									</div>
								</div>

								<div class="flex space-x-3 mt-4">
									{#if item.status === 'sent_to_kitchen'}
										<button
											on:click={() => markBarItemPreparing(item)}
											class="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm font-medium transition-colors"
										>
											🍹 Start Making
										</button>
									{/if}
									
									{#if item.status !== 'ready'}
										<button
											on:click={() => markBarItemReady(item)}
											class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
										>
											✅ Ready for Pickup
										</button>
									{:else}
										<button
											on:click={() => sendDrinkReminder(item)}
											class="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-medium transition-colors"
										>
											🔔 Send Reminder
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-center py-8 text-gray-400">
						<div class="text-4xl mb-2">🍹</div>
						<p>No pending drink orders</p>
						<p class="text-sm mt-1">Orders appear here when servers send drinks to the bar</p>
					</div>
				{/if}
				</div>
			{/if}

		{:else if activeTab === 'schedule'}
			<!-- My Schedule -->
			<div class="mb-8">
				<h2 class="text-3xl font-bold">My Schedule</h2>
				<p class="text-gray-400 mt-2">View your upcoming shifts</p>
			</div>

			{#if $loading.shifts}
				<div class="flex justify-center items-center h-64">
					<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
				</div>
			{:else}
				<div class="grid gap-4">
					{#each upcomingShifts as shift}
						<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
							<div class="flex justify-between items-start">
								<div>
									<h3 class="text-lg font-medium">{formatDate(shift.shift_date)}</h3>
									<p class="text-gray-400">{shift.position}</p>
									<p class="text-sm text-gray-300">{formatTime(shift.start_time)} - {formatTime(shift.end_time)}</p>
								</div>
								<span class="px-3 py-1 rounded-full text-sm {
									shift.status === 'confirmed' ? 'bg-green-900/50 text-green-300' :
									shift.status === 'scheduled' ? 'bg-blue-900/50 text-blue-300' :
									'bg-gray-700/50 text-gray-300'
								}">
									{shift.status}
								</span>
							</div>
							{#if shift.notes}
								<div class="mt-3 p-3 bg-gray-700/30 rounded-lg">
									<p class="text-sm text-gray-300">{shift.notes}</p>
								</div>
							{/if}
						</div>
					{/each}

					{#if upcomingShifts.length === 0}
						<div class="text-center py-12">
							<div class="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-700/50 flex items-center justify-center">
								<span class="text-4xl">📅</span>
							</div>
							<h3 class="text-xl font-medium mb-2">No upcoming shifts</h3>
							<p class="text-gray-400">Check with your manager for new schedule assignments</p>
						</div>
					{/if}
				</div>
			{/if}

		{:else if activeTab === 'menu'}
			<!-- Menu Reference -->
			<div class="mb-8">
				<h2 class="text-3xl font-bold">Menu Reference</h2>
				<p class="text-gray-400 mt-2">Quick reference for menu items and allergens</p>
			</div>

			{#if $loading.menu}
				<div class="flex justify-center items-center h-64">
					<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
				</div>
			{:else}
				<div class="grid gap-4">
					{#each Object.entries($menuItems.reduce((acc, item) => {
						if (!acc[item.category]) acc[item.category] = [];
						acc[item.category].push(item);
						return acc;
					}, {})) as [category, items]}
						<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
							<h3 class="text-xl font-bold mb-4 capitalize">{category.replace('_', ' ')}</h3>
							<div class="grid gap-3">
								{#each items as item}
									<div class="flex justify-between items-start p-3 bg-gray-700/30 rounded-lg">
										<div class="flex-1">
											<h4 class="font-medium">{item.name}</h4>
											{#if item.description}
												<p class="text-sm text-gray-400 mt-1">{item.description}</p>
											{/if}
											{#if item.allergens && item.allergens.length > 0}
												<div class="flex flex-wrap gap-1 mt-2">
													{#each item.allergens as allergen}
														<span class="px-2 py-1 text-xs rounded bg-red-900/50 text-red-300">
															{allergen}
														</span>
													{/each}
												</div>
											{/if}
											{#if item.preparation_time}
												<p class="text-xs text-gray-400 mt-1">Prep time: {item.preparation_time} min</p>
											{/if}
										</div>
										<div class="text-right ml-4">
											<p class="font-bold">${item.price}</p>
											{#if !item.available}
												<span class="text-xs text-red-400">Unavailable</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}

		{:else if activeTab === 'profile'}
			<!-- My Profile -->
			<div class="mb-8">
				<h2 class="text-3xl font-bold">My Profile</h2>
				<p class="text-gray-400 mt-2">View and update your information</p>
			</div>

			<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 max-w-2xl">
				<div class="space-y-6">
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2">Name</label>
						<p class="text-lg">{user?.name || 'Not provided'}</p>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2">Email</label>
						<p class="text-lg">{user?.email || 'Not provided'}</p>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2">Role</label>
						<span class="px-3 py-1 rounded-full text-sm bg-green-900/50 text-green-300">
							{user?.role || 'server'}
						</span>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2">Phone</label>
						<p class="text-lg">{user?.phone || 'Not provided'}</p>
					</div>
				</div>

				<div class="mt-8 pt-6 border-t border-gray-700">
					<button class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium">
						Update Profile
					</button>
				</div>
			</div>
		{/if}
	</main>
</div>

<!-- Full-Screen POS System -->
{#if showTicketModal && selectedTable}
	<div class="fixed inset-0 bg-gray-900 z-50 flex flex-col">
		<!-- POS Header -->
		<div class="bg-gray-800 border-b border-gray-700 p-4">
			<div class="flex justify-between items-center">
				<div class="flex items-center space-x-4">
					<button
						on:click={closeTicketModal}
						class="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
						</svg>
						<span>Back</span>
					</button>
					
					{#if currentTicket}
						<button
							on:click={() => {
								console.log('🔥 DEBUG ORDER STATUS:');
								console.log('📋 Current Ticket:', currentTicket);
								console.log('🍽️ Ticket Items:', currentTicketItems);
								console.log('🍴 Menu Items:', $menuItems);
								
								// Show what getTableOrderStatus would return
								const orderStatus = getTableOrderStatus(selectedTable.id);
								console.log('📊 Table Order Status:', orderStatus);
								
								// Calculate prep times for each item
								console.log('\n⏰ PREP TIME BREAKDOWN:');
								currentTicketItems.forEach((item, index) => {
									const menuItem = $menuItems.find(m => m.id === item.menu_item_id);
									
									// Better prep time defaults based on kitchen station
									let prepTime = menuItem?.preparation_time;
									if (!prepTime) {
										switch(item.kitchen_station) {
											case 'bar': prepTime = 3; break;
											case 'cold_station': prepTime = 5; break;
											case 'fryer': prepTime = 8; break;
											case 'grill': prepTime = 15; break;
											case 'kitchen': prepTime = 12; break;
											default: prepTime = 10; break;
										}
									}
									
									const orderedAt = new Date(item.ordered_at);
									const now = new Date();
									const elapsed = Math.floor((now - orderedAt) / (1000 * 60));
									const remaining = Math.max(0, prepTime - elapsed);
									
									// Calculate realistic status based on elapsed time
									let calculatedStatus = item.status;
									if (item.status === 'sent_to_kitchen') {
										if (elapsed >= prepTime * 1.5) {
											calculatedStatus = 'OVERDUE';
										} else if (elapsed >= prepTime) {
											calculatedStatus = 'READY';
										} else if (elapsed >= prepTime * 0.7) {
											calculatedStatus = 'PREPARING';
										}
									}
									
									console.log(`  ${index + 1}. ${menuItem?.name || 'Unknown Item'}`);
									console.log(`     Stored Status: ${item.status}`);
									console.log(`     Calculated Status: ${calculatedStatus}`);
									console.log(`     Prep Time: ${prepTime} min`);
									console.log(`     Ordered: ${orderedAt.toLocaleTimeString()}`);
									console.log(`     Elapsed: ${elapsed} min`);
									console.log(`     Remaining: ${remaining} min`);
									console.log(`     Kitchen Station: ${item.kitchen_station}`);
								});
								
								// Try to open the order details modal manually
								if (orderStatus) {
									selectedTableDetails = {
										table: selectedTable,
										...orderStatus
									};
									showTableDetailsModal = true;
									console.log('🎯 Opened table details modal');
								} else {
									console.log('❌ No order status found - cannot open details modal');
								}
							}}
							class="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm transition-colors"
						>
							📊 Order Status
						</button>
					{/if}
					{#if completedOrders.length > 0}
						<button
							on:click={() => showHistoryModal = true}
							class="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-white text-sm transition-colors"
						>
							📋 Order History ({completedOrders.length})
						</button>
					{/if}
					<div>
						<h1 class="text-xl font-bold text-white">
							{selectedTable.table_name || selectedTable.table_number_field}
							{#if currentTicket}
								- #{currentTicket.ticket_number}
							{:else}
								- New Order
							{/if}
						</h1>
						<p class="text-gray-400 text-sm">
							{selectedTable.capacity || selectedTable.seats_field} seats
							{#if currentTicket}
								• {currentTicket.customer_count} guests • <span class="capitalize">{currentTicket.status}</span>
							{/if}
						</p>
					</div>
				</div>
				
				{#if currentTicket}
					<div class="text-right">
						<p class="text-2xl font-bold text-green-400">${calculatedTotal.toFixed(2)}</p>
						<p class="text-sm text-gray-400">{currentTicketItems.length} item{currentTicketItems.length !== 1 ? 's' : ''}</p>
					</div>
				{/if}
			</div>
		</div>

		<div class="flex-1 flex overflow-hidden">
			<!-- Left Side: Menu Selection -->
			<div class="flex-1 flex flex-col bg-gray-900">
				{#if !currentTicket}
					<!-- Guest Count Setup -->
					<div class="p-8 flex-1 flex items-center justify-center">
						<div class="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
							<h2 class="text-2xl font-bold text-white mb-6">Start New Order</h2>
							<div class="space-y-4">
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-2">Number of Guests</label>
									<input 
										type="number" 
										min="1" 
										max="12" 
										bind:value={guestCount}
										class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-xl font-bold"
									>
								</div>
								<button
									on:click={() => createNewTicket(guestCount)}
									class="w-full px-6 py-4 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold text-lg transition-colors"
								>
									Start Order
								</button>
							</div>
						</div>
					</div>
				{:else}
					<!-- Category Navigation -->
					<div class="p-4 bg-gray-800 border-b border-gray-700">
						<!-- Filter Toggle Header -->
						<button
							on:click={toggleFilters}
							class="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-700 transition-colors mb-4"
						>
							<div class="flex items-center space-x-2">
								<span class="text-lg">⚙️</span>
								<div>
									<h3 class="text-sm font-medium text-gray-300">Default Items</h3>
									<p class="text-xs text-gray-400">Expand to set the current defaults • Example: if not Dinner uncheck and use Lunch</p>
								</div>
								<span class="text-xs text-gray-500">
									({Object.values(selectedCategories).filter(Boolean).length} active)
								</span>
								{#if Object.values(selectedCategories).filter(Boolean).length > 0}
									<div class="flex items-center space-x-1 ml-2">
										{#each Object.entries(selectedCategories) as [category, isSelected], index}
											{#if isSelected}
												<span class="text-xs text-gray-300 flex items-center space-x-1">
													<span>{getCategoryCheckboxIcon(category)}</span>
													<span class="capitalize">{category.replace('_', ' ')}</span>
													{#if index < Object.entries(selectedCategories).filter(([c, sel]) => sel).length - 1}
														<span class="text-gray-500 mx-1">-</span>
													{/if}
												</span>
											{/if}
										{/each}
									</div>
								{/if}
							</div>
							<svg 
								class="w-5 h-5 text-gray-400 transition-transform duration-200 {showFilters ? 'rotate-180' : ''}"
								fill="none" 
								stroke="currentColor" 
								viewBox="0 0 24 24"
							>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
							</svg>
						</button>
						
						<!-- Collapsible Filter Checkboxes -->
						{#if showFilters}
							<div class="mb-4 transition-all duration-200">
								<div class="grid grid-cols-2 gap-2">
									{#each Object.keys(selectedCategories) as category}
										<label class="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors">
											<input
												type="checkbox"
												bind:checked={selectedCategories[category]}
												class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
											/>
											<span class="text-lg">{getCategoryCheckboxIcon(category)}</span>
											<span class="text-sm font-medium text-gray-300 capitalize">
												{category.replace('_', ' ')}
											</span>
										</label>
									{/each}
								</div>
							</div>
						{/if}
						
						<!-- Search Bar -->
						<div class="relative mb-4">
							<svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
							</svg>
							<input
								type="text"
								placeholder="Search menu items..."
								bind:value={searchQuery}
								class="w-full pl-10 pr-12 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
							>
							{#if speechSupported}
								<button
									type="button"
									on:click={() => startVoiceRecording(false, true)}
									class="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full transition-colors duration-200
										{isRecordingSearch ? 'bg-red-600 text-white animate-pulse' : 'text-gray-400 hover:text-white hover:bg-gray-600'}"
									title="Voice search"
								>
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd"></path>
									</svg>
								</button>
							{/if}
						</div>
						
						<!-- Menu Category Section -->
						<div class="mb-4">
							<div class="flex items-center justify-between mb-3">
								{#if quickFilterCategories}
									{@const enabledCategories = quickFilterCategories.filter(cat => cat.id === 'all' || selectedCategories[cat.id])}
									{@const disabledCount = quickFilterCategories.length - enabledCategories.length}
									<p class="text-xs text-gray-400">
										{#if disabledCount > 0}
											{enabledCategories.length - 1} of {quickFilterCategories.length - 1} categories enabled • {disabledCount} greyed out (not in defaults)
										{:else}
											All categories enabled • Change defaults above to limit options
										{/if}
									</p>
								{/if}
								{#if quickFilter !== 'all'}
									{@const currentQuickFilter = quickFilterCategories.find(cat => cat.id === quickFilter)}
									{#if currentQuickFilter}
										<span class="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">
											{currentQuickFilter.icon} {currentQuickFilter.label}
										</span>
									{/if}
								{/if}
							</div>
							<div class="flex flex-wrap gap-2">
								{#each quickFilterCategories as category}
									{@const isInDefaults = category.id === 'all' || selectedCategories[category.id]}
									{@const isDisabled = !isInDefaults}
									<label class="flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors relative group {
										isDisabled 
											? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
											: quickFilter === category.id 
												? 'bg-blue-600 text-white cursor-pointer' 
												: 'bg-gray-700 hover:bg-gray-600 text-gray-300 cursor-pointer'
									}" title={isDisabled ? `Not in defaults - enable in Default Items above` : ''}>
										<input
											type="radio"
											bind:group={quickFilter}
											value={category.id}
											on:change={handleQuickFilterChange}
											disabled={isDisabled}
											class="sr-only"
										/>
										<span class="text-sm">{category.icon}</span>
										<span class="text-xs font-medium">{category.label}</span>
										{#if isDisabled}
											<span class="text-xs text-gray-600">•</span>
										{/if}
									</label>
								{/each}
							</div>
						</div>
					</div>

					<!-- Menu Items Grid -->
					<div class="flex-1 overflow-y-auto p-4">
						<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
							{#each filteredMenuItems as item}
								<button
									on:click={() => openItemModal(item)}
									class="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 transition-colors text-left group"
								>
									<div class="aspect-square bg-gray-700 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
										{#if item.image}
											<img src={item.image} alt={item.name} class="w-full h-full object-cover">
										{:else}
											<span class="text-3xl">{getCategoryIcon(item.category)}</span>
										{/if}
									</div>
									
									<h3 class="font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">
										{item.name}
									</h3>
									
									{#if item.description}
										<p class="text-xs text-gray-400 mb-2 line-clamp-2">{item.description}</p>
									{/if}
									
									<div class="flex justify-between items-center">
										<span class="text-lg font-bold text-green-400">${item.price}</span>
										{#if item.featured}
											<span class="text-xs bg-yellow-600 text-yellow-100 px-2 py-1 rounded">⭐ Featured</span>
										{/if}
									</div>
									
									{#if item.tags && item.tags.length > 0}
										<div class="flex flex-wrap gap-1 mt-2">
											{#each item.tags.slice(0, 2) as tag}
												<span class="text-xs bg-gray-600 text-gray-300 px-2 py-1 rounded">
													{tag}
												</span>
											{/each}
										</div>
									{/if}
									
									{#if item.allergens && item.allergens.length > 0}
										<div class="flex flex-wrap gap-1 mt-2">
											{#each item.allergens.slice(0, 3) as allergen}
												<span class="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded">
													{allergen}
												</span>
											{/each}
										</div>
									{/if}
								</button>
							{/each}
						</div>
						
						{#if filteredMenuItems.length === 0}
							<div class="text-center py-12">
								<div class="text-6xl mb-4">🔍</div>
								<h3 class="text-xl font-bold text-gray-400 mb-2">No items found</h3>
								<p class="text-gray-500">Try adjusting your search or category filter</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Right Side: Order Summary -->
			{#if currentTicket}
				<div class="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
					<div class="p-4 border-b border-gray-700">
						<h2 class="text-lg font-bold text-white">Current Order</h2>
					</div>

					<!-- Order Items -->
					<div class="flex-1 overflow-y-auto p-4 space-y-3">
						{#each currentTicketItems as item}
							<div class="bg-gray-700 rounded-lg overflow-hidden">
								<!-- Clickable item area -->
								<button
									on:click={() => openEditItemModal(item)}
									class="w-full p-3 text-left hover:bg-gray-600 transition-colors"
								>
									<div class="flex justify-between items-start mb-2">
										<div class="flex-1">
											<div class="flex items-center gap-2">
												<p class="font-medium text-white">
													{item.expand?.menu_item_id?.name || 'Unknown Item'}
												</p>
												{#if item.seat_number}
													<span class="text-xs bg-blue-600 text-blue-100 px-2 py-1 rounded-full">
														🪑 {item.seat_name ? `${item.seat_name} (${item.seat_number})` : `Seat ${item.seat_number}`}
													</span>
												{/if}
											</div>
											{#if item.modifications}
												<p class="text-sm text-yellow-400 mt-1">🔧 {item.modifications}</p>
											{/if}
										</div>
										<div class="flex items-center gap-2">
											<span class="text-xs text-gray-400">click to edit</span>
										</div>
									</div>
								</button>
								
								<!-- Quantity controls and delete (non-clickable area) -->
								<div class="px-3 pb-3">
									<div class="flex justify-between items-center">
										<div class="flex items-center space-x-2">
											<button
												on:click|stopPropagation={() => updateItemQuantity(item.id, Math.max(1, item.quantity - 1))}
												class="w-6 h-6 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center text-white text-sm font-bold"
												disabled={item.quantity <= 1}
											>
												−
											</button>
											<span class="font-medium text-white w-8 text-center">{item.quantity}</span>
											<button
												on:click|stopPropagation={() => updateItemQuantity(item.id, item.quantity + 1)}
												class="w-6 h-6 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center text-white text-sm font-bold"
											>
												+
											</button>
											<span class="text-sm text-gray-400 capitalize ml-2">• {item.status}</span>
										</div>
										<div class="flex items-center gap-2">
											<span class="font-bold text-green-400">${item.total_price?.toFixed(2)}</span>
											<button
												on:click={async (e) => {
													e.stopPropagation();
													console.log('Removing ticket item:', item.id, item);
													try {
														await collections.removeTicketItem(item.id);
														// Update local currentTicketItems immediately
														currentTicketItems = currentTicketItems.filter(i => i.id !== item.id);
													} catch (error) {
														console.error('Error removing item:', error);
														// Still remove from UI even if backend fails
														currentTicketItems = currentTicketItems.filter(i => i.id !== item.id);
													}
												}}
												class="text-red-400 hover:text-red-300 p-1"
												title="Remove item"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
												</svg>
											</button>
										</div>
									</div>
								</div>
							</div>
						{/each}
						
						{#if currentTicketItems.length === 0}
							<div class="text-center py-8 text-gray-400">
								<div class="text-4xl mb-2">🛒</div>
								<p>No items added yet</p>
							</div>
						{/if}
					</div>

					<!-- Order Totals & Actions -->
					<div class="p-4 border-t border-gray-700 space-y-4">
						<div class="space-y-2">
							<div class="flex justify-between text-gray-300">
								<span>Subtotal:</span>
								<span>${calculatedSubtotal.toFixed(2)}</span>
							</div>
							<div class="flex justify-between text-gray-300">
								<span>Tax (8.875%):</span>
								<span>${calculatedTax.toFixed(2)}</span>
							</div>
							<div class="flex justify-between text-xl font-bold text-white border-t border-gray-600 pt-2">
								<span>Total:</span>
								<span>${calculatedTotal.toFixed(2)}</span>
							</div>
						</div>

						<div class="space-y-2">
							{#if currentTicketItems.length > 0}
								{#if currentTicketItems.some(item => !item.status || item.status === 'pending' || item.status === 'ordered')}
									<button
										on:click={sendToKitchen}
										class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold"
									>
										📋 Send Orders
									</button>
								{/if}
								
								<!-- Payment Override Checkbox (when items aren't ready) - Manager/Admin only -->
								<!-- Debug: Show current state -->
								{#if currentTicketItems.length > 0}
									<div class="text-xs text-gray-400 p-2 bg-gray-800 rounded">
										Debug: allItemsReady={allItemsReady}, userRole={user?.role}, itemStatuses={currentTicketItems.map(i => i.status).join(', ')}
									</div>
								{/if}
								
								{#if !allItemsReady && currentTicketItems.length > 0}
									<!-- Temporarily show for all roles for testing -->
									<!-- TODO: Restore role check: (user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner') -->
									<div class="p-3 bg-yellow-800/20 border border-yellow-600 rounded-lg">
										<label class="flex items-center space-x-2 text-yellow-300">
											<input 
												type="checkbox" 
												bind:checked={forcePaymentEnabled}
												on:change={async () => {
													if (forcePaymentEnabled) {
														// Update all non-ready items to 'ready' status
														console.log('🔧 FORCE READY: Updating item statuses to ready');
														for (const item of currentTicketItems) {
															if (item.status !== 'ready') {
																try {
																	await collections.updateTicketItem(item.id, { status: 'ready' });
																	console.log(`✅ Updated ${item.id} to ready status`);
																} catch (error) {
																	console.error('Failed to update item status:', error);
																}
															}
														}
														// Refresh current items to show updated statuses
														currentTicketItems = await collections.getTicketItems(currentTicket.id);
													}
												}}
												class="rounded bg-gray-700 border-yellow-600 text-yellow-500 focus:ring-yellow-500"
											>
											<span class="text-sm">⚠️ Force ready & enable payment</span>
										</label>
										<p class="text-xs text-yellow-400 mt-1">Updates items to 'ready' status when kitchen forgets</p>
									</div>
								{/if}
								
								{#if paymentAllowed && currentTicketItems.length > 0}
									<div class="space-y-2">
										{#if paymentWorkflowStep === 'completed'}
							<!-- Payment Completed - Show Summary -->
							<div class="p-4 bg-green-800/20 border border-green-600 rounded-lg text-green-300">
								<div class="flex justify-between items-center mb-2">
									<h4 class="font-semibold">✅ Payment Completed</h4>
									<button
										on:click={() => paymentWorkflowStep = 'initial'}
										class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
									>
										New Payment
									</button>
								</div>
								<div class="text-sm space-y-1">
									<div>Subtotal: ${authorizedAmount.toFixed(2)}</div>
									<div>Tip: ${tipAmount.toFixed(2)}</div>
									<div class="font-bold">Total Charged: ${totalWithTip.toFixed(2)}</div>
									<div class="text-xs text-green-400 mt-2">Table ready for cleaning by bussers</div>
								</div>
								<button
									on:click={() => {
										// Allow tip adjustment
										paymentWorkflowStep = 'initial';
										// Reset for new transaction but keep history
									}}
									class="w-full mt-3 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
								>
									Adjust Tip (if needed)
								</button>
							</div>
						{:else if paymentWorkflowStep === 'initial'}
											<!-- Step 1: Swipe Card (Authorize) -->
											<button
												on:click={() => {
													if (showTableDetailsModal) {
														handleDirectCardPayment(selectedTable, getTableOrderStatus(selectedTable.id));
													} else {
														swipeCard();
													}
												}}
												class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold flex items-center justify-center"
											>
												💳 Swipe Customer Card - ${(currentTicket?.total_amount || currentTicketItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0) * 1.08875).toFixed(2)}
											</button>
											
											<!-- Test Card Simulation (Development) -->
											<button
												on:click={() => {
													if (showTableDetailsModal) {
														handleDirectCardPayment(selectedTable, getTableOrderStatus(selectedTable.id));
													} else {
														simulateCardSwipe();
													}
												}}
												class="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-bold flex items-center justify-center"
											>
												🧪 Simulate Test Card - ${(currentTicket?.total_amount || currentTicketItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0) * 1.08875).toFixed(2)}
											</button>
											
											<!-- Cash Option -->
											<button
												on:click={() => {
													const orderStatus = getTableOrderStatus(selectedTable.id);
													if (orderStatus) {
														// If we're in table details modal, handle payment directly here
														if (showTableDetailsModal) {
															handleDirectCashPayment(selectedTable, orderStatus);
														} else {
															closeTicketModal();
															openPaymentModal(selectedTable, orderStatus);
														}
													}
												}}
												class="w-full px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold flex items-center justify-center"
											>
												💵 Cash Payment
											</button>
										{:else if paymentWorkflowStep === 'card_authorized'}
											<!-- Step 2: Print Slip for Guest -->
											<div class="bg-blue-900/20 border border-blue-600 rounded-lg p-3 mb-2">
												<div class="text-sm text-blue-300 mb-2">✅ Card Authorized - Print slip for guest</div>
											</div>
											<button
												on:click={() => printTipSlip()}
												class="w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-white font-bold flex items-center justify-center"
											>
												🖨️ Print Receipt for Guest Tip
											</button>
										{:else if paymentWorkflowStep === 'awaiting_tip'}
											<!-- Step 3: Enter Tip and Finalize -->
											<div class="bg-yellow-900/20 border border-yellow-600 rounded-lg p-3 mb-2">
												<div class="text-sm text-yellow-300 mb-2">📝 Guest signed receipt - Enter tip amount</div>
											</div>
											<button
												on:click={() => finalizePaymentWithTip()}
												class="w-full px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold flex items-center justify-center"
											>
												✅ Add Tip & Finalize Payment
											</button>
										{/if}
									</div>
								{/if}
							{/if}
							<button
								on:click={closeTicketModal}
								class="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-medium"
							>
								Save & Close
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Item Customization Modal -->
{#if showItemModal && selectedMenuItem}
	<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
		<div class="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
			<!-- Header -->
			<div class="p-6 border-b border-gray-700">
				<div class="flex justify-between items-start">
					<div>
						<h2 class="text-2xl font-bold text-white">{selectedMenuItem.name_field || selectedMenuItem.name}</h2>
						<p class="text-gray-400 mt-1">{selectedMenuItem.description_field || selectedMenuItem.description}</p>
						<p class="text-green-400 text-xl font-bold mt-2">${selectedMenuItem.price_field || selectedMenuItem.price}</p>
					</div>
					<button
						on:click={closeItemModal}
						class="text-gray-400 hover:text-white p-2"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6 space-y-6">
				<!-- Quantity -->
				<div>
					<h3 class="text-lg font-semibold text-white mb-3">Quantity</h3>
					<div class="flex items-center space-x-4">
						<button
							on:click={() => itemQuantity = Math.max(1, itemQuantity - 1)}
							class="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white font-bold text-xl"
						>
							−
						</button>
						<span class="text-2xl font-bold text-white w-8 text-center">{itemQuantity}</span>
						<button
							on:click={() => itemQuantity = itemQuantity + 1}
							class="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white font-bold text-xl"
						>
							+
						</button>
					</div>
				</div>

				<!-- Seat Assignment (Optional) -->
				<div>
					<h3 class="text-lg font-semibold text-white mb-3">🪑 Seat Assignment <span class="text-sm text-gray-400">(Optional)</span></h3>
					<div class="space-y-3">
						<div class="space-y-2">
							<select
								bind:value={selectedSeat}
								class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
							>
								<option value={null}>No specific seat</option>
								{#each Array.from({length: getAvailableSeats()}, (_, i) => i + 1) as seatNum}
									<option value={seatNum}>
										{getSeatDisplay(seatNum) || `Seat ${seatNum}`}
									</option>
								{/each}
							</select>
							
							<button
								on:click={addExtraSeat}
								class="w-full p-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors"
							>
								+ Add Extra Seat (currently {getAvailableSeats()} seats)
							</button>
						</div>
						
						{#if selectedSeat}
							<div>
								<label class="block text-sm text-gray-300 mb-1">Guest Name (Optional)</label>
								<input
									type="text"
									placeholder="e.g., Joe, Sarah, etc."
									value={seatNames[selectedSeat] || ''}
									on:input={(e) => updateSeatName(selectedSeat, e.target.value)}
									class="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
								>
								<p class="text-xs text-gray-400 mt-1">
									💡 Helps food runners deliver to the right person
								</p>
							</div>
						{/if}
					</div>
				</div>

				<!-- Modifiers -->
				{#if getApplicableModifiers(selectedMenuItem).length > 0}
					<div>
						<h3 class="text-lg font-semibold text-white mb-3">Customize</h3>
						
						{#each ['cooking_style', 'sauce', 'add_on', 'size', 'substitution'] as modifierType}
							{@const typeModifiers = getApplicableModifiers(selectedMenuItem).filter(m => m.type === modifierType)}
							{#if typeModifiers.length > 0}
								<div class="mb-4">
									<h4 class="text-sm font-medium text-gray-300 mb-2 capitalize">
										{modifierType.replace('_', ' ')}
										{#if modifierType === 'cooking_style'}🔥{/if}
										{#if modifierType === 'sauce'}🍯{/if}
										{#if modifierType === 'add_on'}➕{/if}
										{#if modifierType === 'size'}📏{/if}
										{#if modifierType === 'substitution'}🔄{/if}
									</h4>
									<div class="grid grid-cols-1 gap-2">
										{#each typeModifiers as modifier}
											<label class="flex items-center p-3 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-colors">
												<input
													type="checkbox"
													checked={selectedModifiers.some(m => m.id === modifier.id)}
													on:change={() => toggleModifier(modifier)}
													class="mr-3 text-blue-600"
												>
												<div class="flex-1">
													<span class="text-white">{modifier.name}</span>
													{#if modifier.price_change > 0}
														<span class="text-green-400 ml-2">+${modifier.price_change}</span>
													{/if}
												</div>
											</label>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}

				<!-- Special Instructions -->
				<div>
					<h3 class="text-lg font-semibold text-white mb-3">Special Instructions</h3>
					<div class="relative">
						<textarea
							bind:value={specialInstructions}
							placeholder="Any special requests or notes..."
							class="w-full p-3 pr-12 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none"
							rows="3"
						></textarea>
						{#if speechSupported}
							<button
								on:click={() => isRecording ? stopVoiceRecording() : startVoiceRecording(false)}
								class="absolute right-2 top-2 p-2 rounded-lg transition-colors {isRecording ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}"
								title={isRecording ? 'Stop recording' : 'Start voice recording'}
								type="button"
							>
								{#if isRecording}
									🔴
								{:else}
									🎤
								{/if}
							</button>
						{/if}
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="p-6 border-t border-gray-700 bg-gray-750">
				<div class="flex justify-between items-center mb-4">
					<span class="text-gray-300">Total:</span>
					<span class="text-2xl font-bold text-green-400">${calculateItemTotal().toFixed(2)}</span>
				</div>
				<div class="flex space-x-3">
					<button
						on:click={closeItemModal}
						class="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
					>
						Cancel
					</button>
					<button
						on:click={addCustomizedItemToTicket}
						class="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
					>
						Add to Order
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Edit Item Modal -->
{#if showEditItemModal && editingItem}
	<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
		<div class="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
			<!-- Header -->
			<div class="p-6 border-b border-gray-700">
				<div class="flex justify-between items-start">
					<div>
						<h2 class="text-2xl font-bold text-white">Edit Order Item</h2>
						<p class="text-xl font-semibold text-blue-400 mt-1">{editingItem.expand?.menu_item_id?.name || 'Unknown Item'}</p>
						<p class="text-gray-400 mt-1">{editingItem.expand?.menu_item_id?.description || ''}</p>
					</div>
					<button
						on:click={closeEditItemModal}
						class="text-gray-400 hover:text-white p-2"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6 space-y-6">
				<!-- Current Status -->
				<div class="bg-gray-700 p-4 rounded-lg">
					<div class="flex justify-between items-center">
						<div>
							<span class="text-gray-300">Status:</span>
							<span class="text-white font-medium ml-2 capitalize">{editingItem.status}</span>
						</div>
						<div>
							<span class="text-gray-300">Original Price:</span>
							<span class="text-green-400 font-bold ml-2">${editingItem.unit_price?.toFixed(2)}</span>
						</div>
					</div>
				</div>

				<!-- Quantity -->
				<div>
					<h3 class="text-lg font-semibold text-white mb-3">Quantity</h3>
					<div class="flex items-center space-x-4">
						<button
							on:click={() => editQuantity = Math.max(1, editQuantity - 1)}
							class="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white font-bold text-xl"
						>
							−
						</button>
						<span class="text-2xl font-bold text-white w-8 text-center">{editQuantity}</span>
						<button
							on:click={() => editQuantity = editQuantity + 1}
							class="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white font-bold text-xl"
						>
							+
						</button>
					</div>
				</div>

				<!-- Seat Assignment -->
				<div>
					<h3 class="text-lg font-semibold text-white mb-3">🪑 Seat Assignment</h3>
					<div class="space-y-3">
						<div class="space-y-2">
							<select
								bind:value={editSeat}
								class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
							>
								<option value={null}>No specific seat</option>
								{#each Array.from({length: getAvailableSeats()}, (_, i) => i + 1) as seatNum}
									<option value={seatNum}>
										{getSeatDisplay(seatNum) || `Seat ${seatNum}`}
									</option>
								{/each}
							</select>
							
							<button
								on:click={addExtraSeat}
								class="w-full p-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors"
							>
								+ Add Extra Seat (currently {getAvailableSeats()} seats)
							</button>
						</div>
						
						{#if editSeat}
							<div>
								<label class="block text-sm text-gray-300 mb-1">Guest Name (Optional)</label>
								<input
									type="text"
									placeholder="e.g., Joe, Sarah, etc."
									value={seatNames[editSeat] || ''}
									on:input={(e) => updateSeatName(editSeat, e.target.value)}
									class="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
								>
							</div>
						{/if}
					</div>
				</div>

				<!-- Modifiers -->
				{#if getApplicableModifiers(editingItem.expand?.menu_item_id || {}).length > 0}
					<div>
						<h3 class="text-lg font-semibold text-white mb-3">Customize</h3>
						
						{#each ['cooking_style', 'sauce', 'add_on', 'size', 'substitution'] as modifierType}
							{@const typeModifiers = getApplicableModifiers(editingItem.expand?.menu_item_id || {}).filter(m => m.type === modifierType)}
							{#if typeModifiers.length > 0}
								<div class="mb-4">
									<h4 class="text-sm font-medium text-gray-300 mb-2 capitalize">
										{modifierType.replace('_', ' ')}
										{#if modifierType === 'cooking_style'}🔥{/if}
										{#if modifierType === 'sauce'}🍯{/if}
										{#if modifierType === 'add_on'}➕{/if}
										{#if modifierType === 'size'}📏{/if}
										{#if modifierType === 'substitution'}🔄{/if}
									</h4>
									<div class="grid grid-cols-1 gap-2">
										{#each typeModifiers as modifier}
											<label class="flex items-center p-3 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-colors">
												<input
													type="checkbox"
													checked={editModifiers.some(m => m.id === modifier.id)}
													on:change={() => toggleEditModifier(modifier)}
													class="mr-3 text-blue-600"
												>
												<div class="flex-1">
													<span class="text-white">{modifier.name}</span>
													{#if modifier.price_change > 0}
														<span class="text-green-400 ml-2">+${modifier.price_change}</span>
													{/if}
												</div>
											</label>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}

				<!-- Special Instructions -->
				<div>
					<h3 class="text-lg font-semibold text-white mb-3">Special Instructions</h3>
					<div class="relative">
						<textarea
							bind:value={editSpecialInstructions}
							placeholder="Any special requests or notes..."
							class="w-full p-3 pr-12 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none"
							rows="3"
						></textarea>
						{#if speechSupported}
							<button
								on:click={() => isRecordingEdit ? stopVoiceRecording() : startVoiceRecording(true)}
								class="absolute right-2 top-2 p-2 rounded-lg transition-colors {isRecordingEdit ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}"
								title={isRecordingEdit ? 'Stop recording' : 'Start voice recording'}
								type="button"
							>
								{#if isRecordingEdit}
									🔴
								{:else}
									🎤
								{/if}
							</button>
						{/if}
					</div>
					<p class="text-xs text-gray-400 mt-1">
						💡 Examples: "Add a candle it is a birthday", "Extra crispy", "On the side"
					</p>
				</div>
			</div>

			<!-- Footer -->
			<div class="p-6 border-t border-gray-700 bg-gray-750">
				<div class="flex justify-between items-center mb-4">
					<span class="text-gray-300">Updated Total:</span>
					<span class="text-2xl font-bold text-green-400">
						${((((editingItem.unit_price || 0) - (editingItem.modifier_total || 0)) + editModifiers.reduce((sum, mod) => sum + (mod.price_change || 0), 0)) * editQuantity).toFixed(2)}
					</span>
				</div>
				<div class="flex space-x-3">
					<button
						on:click={closeEditItemModal}
						class="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
					>
						Cancel
					</button>
					<button
						on:click={saveEditedItem}
						class="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
					>
						Update Item
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Table Order Details Modal -->
{#if showTableDetailsModal && selectedTableDetails}
	<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
		<div class="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
			<!-- Header -->
			<div class="flex justify-between items-center p-6 border-b border-gray-700">
				<div>
					<h2 class="text-2xl font-bold">
						{selectedTableDetails.table.table_name || selectedTableDetails.table.table_number_field}
					</h2>
					<p class="text-gray-400">
						({selectedTableDetails.table.capacity || selectedTableDetails.table.seats_field} seats) • 
						Ticket #{selectedTableDetails.ticket.ticket_number}
					</p>
				</div>
				<button
					on:click={closeTableDetailsModal}
					class="text-gray-400 hover:text-white p-2"
				>
					✕
				</button>
			</div>

			<!-- Order Status -->
			<div class="p-6 border-b border-gray-700">
			{#if selectedTableDetails}
			 {@const statusDisplay = getTableStatusDisplay(selectedTableDetails.table.id)}
			<div class="flex items-center gap-4 mb-4">
			<div class="w-6 h-6 rounded-full {statusDisplay.color} flex items-center justify-center">
			  <span class="text-sm">{statusDisplay.icon}</span>
			 </div>
			<div>
			 <h3 class="text-lg font-semibold">{statusDisplay.text}</h3>
			<p class="text-gray-400">
			 {selectedTableDetails.itemCount} items • 
			  {selectedTableDetails.estimatedTimeRemaining}m remaining
			  </p>
			  </div>
				</div>

			 <!-- Progress Bar -->
			{@const totalEstimated = Math.max(...selectedTableDetails.items.map(item => {
			 const menuItem = $menuItems.find(m => m.id === item.menu_item_id);
			  return menuItem?.preparation_time || 12;
			 }))}
			 {@const progress = Math.max(0, Math.min(100, ((totalEstimated - selectedTableDetails.estimatedTimeRemaining) / totalEstimated) * 100))}
			<div class="w-full bg-gray-700 rounded-full h-3">
			<div 
			class="h-3 rounded-full transition-all duration-300 {
			 selectedTableDetails.status === 'ready' ? 'bg-green-500' :
			 selectedTableDetails.status === 'preparing' ? 'bg-blue-500' :
			  'bg-orange-500'
			 }"
			  style="width: {progress}%"
			  ></div>
			  </div>
			{/if}
		</div>

			<!-- Order Items -->
			<div class="p-6">
				<h3 class="text-lg font-semibold mb-4">Order Items</h3>
				<div class="space-y-3">
					{#each selectedTableDetails.items as item}
						{@const menuItem = $menuItems.find(m => m.id === item.menu_item_id)}
						{@const prepTime = (() => {
							if (menuItem?.preparation_time) return menuItem.preparation_time;
							switch(item.kitchen_station) {
								case 'bar': return 3;
								case 'cold_station': return 5;
								case 'fryer': return 8;
								case 'grill': return 15;
								case 'kitchen': return 12;
								default: return 10;
							}
						})()}
						{@const orderedAt = new Date(item.ordered_at)}
						{@const elapsed = Math.floor((currentTime - orderedAt) / (1000 * 60))}
						{@const remaining = Math.max(0, prepTime - elapsed)}
						{@const calculatedStatus = (() => {
							if (item.status !== 'sent_to_kitchen') return item.status;
							if (elapsed >= prepTime * 1.5) return 'overdue';
							if (elapsed >= prepTime) return 'ready';
							if (elapsed >= prepTime * 0.7) return 'preparing';
							return 'sent_to_kitchen';
						})()}
						
						<div class="bg-gray-700 rounded-lg p-4">
							<div class="flex justify-between items-start mb-2">
								<div>
									<h4 class="font-medium">
										{item.quantity}x {menuItem?.name || 'Unknown Item'}
									</h4>
									{#if item.seat_number}
										<p class="text-sm text-blue-300">
											Seat {item.seat_number} {item.seat_name ? `(${item.seat_name})` : ''}
										</p>
									{/if}
								</div>
								<div class="text-right">
									<span class="px-2 py-1 rounded text-xs font-medium {
										calculatedStatus === 'ready' ? 'bg-green-900 text-green-300' :
										calculatedStatus === 'preparing' ? 'bg-blue-900 text-blue-300' :
										calculatedStatus === 'overdue' ? 'bg-red-900 text-red-300 animate-pulse' :
										'bg-orange-900 text-orange-300'
									}">
										{calculatedStatus.replace('_', ' ').toUpperCase()}
									</span>
									<p class="text-sm text-gray-400 mt-1">
										{calculatedStatus === 'overdue' ? `${elapsed - prepTime}m overdue` : 
										 calculatedStatus === 'ready' ? 'Ready now!' :
										 `${remaining}m remaining`}
									</p>
								</div>
							</div>

							{#if item.modifications}
								<p class="text-sm text-yellow-300">
									<strong>Mods:</strong> {item.modifications}
								</p>
							{/if}

							{#if item.special_instructions}
								<p class="text-sm text-orange-300">
									<strong>Special:</strong> {item.special_instructions}
								</p>
							{/if}

							<div class="mt-2 flex justify-between items-center text-sm text-gray-400">
								<span>Kitchen Station: {item.kitchen_station?.replace('_', ' ')}</span>
								<span>Est. {prepTime} min • {elapsed}m elapsed</span>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Footer -->
			<div class="p-6 border-t border-gray-700 flex justify-between">
				<button
					on:click={closeTableDetailsModal}
					class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-medium"
				>
					Close
				</button>
				
				{#if selectedTableDetails && selectedTableDetails.status === 'ready' && selectedTableDetails.table}
					<button
						on:click={() => {
							console.log('🔧 Process Payment clicked');
							console.log('📋 selectedTableDetails:', selectedTableDetails);
							
							if (!selectedTableDetails?.table?.id) {
								console.error('❌ selectedTableDetails.table is null');
								return;
							}
							
							console.log('🍽️ Table ID:', selectedTableDetails.table.id);
							const table = selectedTableDetails.table;
							const orderStatus = getTableOrderStatus(selectedTableDetails.table.id);
							console.log('📊 Order Status:', orderStatus);
							
							if (orderStatus) {
								console.log('✅ Opening full order interface for payment');
								closeTableDetailsModal();
								handleTableClick(table);
							} else {
								console.error('❌ No order status found - cannot process payment');
							}
						}}
						class="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium flex items-center space-x-2"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v2a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
						</svg>
						<span>Process Payment</span>
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Payment Processing Modal -->
{#if showPaymentModal && selectedTableForPayment}
	<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
		<div class="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-md">
			<!-- Header -->
			<div class="flex justify-between items-center p-6 border-b border-gray-700">
				<div>
					<h2 class="text-xl font-bold">Process Payment</h2>
					<p class="text-gray-400">
						{selectedTableForPayment.table_name || selectedTableForPayment.table_number_field}
					</p>
				</div>
				<button
					on:click={closePaymentModal}
					class="text-gray-400 hover:text-white p-2"
				>
					✕
				</button>
			</div>

			<!-- Content -->
			<div class="p-6 space-y-6">
				<!-- Amount Breakdown -->
				<div class="space-y-3">
					<div class="flex justify-between items-center">
						<label class="text-sm font-medium text-gray-300">Subtotal</label>
						<div class="text-lg text-gray-100">${paymentAmount.toFixed(2)}</div>
					</div>
					
					<!-- Tip Section -->
					<div class="border-t border-gray-600 pt-3">
						<label class="block text-sm font-medium text-gray-300 mb-3">Add Tip</label>
						
						<!-- Guest Signed Tip (Primary Option) -->
						<div class="bg-blue-900/20 border border-blue-600 rounded-lg p-3 mb-3">
							<button
								on:click={selectGuestSignedTip}
								class="w-full flex items-center justify-between p-2 text-sm rounded-lg font-medium transition-colors {
									tipMethod === 'guest_signed'
										? 'bg-blue-600 text-white'
										: 'bg-gray-700 hover:bg-gray-600 text-gray-300'
								}"
							>
								<div class="flex items-center">
									<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
									</svg>
									Guest Signed Tip
								</div>
								<span class="text-xs opacity-75">Recommended</span>
							</button>
							
							{#if showGuestTipEntry}
								<div class="mt-3">
									<label class="block text-xs text-blue-300 mb-2">Enter amount guest wrote:</label>
									<input
										type="number"
										placeholder="0.00"
										step="0.01"
										min="0"
										bind:value={guestSignedTip}
										on:input={calculateTip}
										class="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-lg font-medium"
										autofocus
									/>
								</div>
							{/if}
						</div>
						
						<!-- Quick Tip Options (Fallback) -->
						<details class="group">
							<summary class="cursor-pointer text-sm text-gray-400 hover:text-gray-300 mb-2">
								Or select suggested tip amounts
							</summary>
							
							<!-- Tip Percentage Buttons -->
							<div class="grid grid-cols-4 gap-2 mb-3">
								{#each [15, 18, 20, 25] as percentage}
									<button
										on:click={() => selectTipPercentage(percentage)}
										class="p-2 text-sm rounded-lg font-medium transition-colors {
											tipMethod === 'percentage' && tipPercentage === percentage
												? 'bg-blue-600 text-white'
												: 'bg-gray-700 hover:bg-gray-600 text-gray-300'
										}"
									>
										{percentage}%
									</button>
								{/each}
							</div>
							
							<!-- Custom Tip Input -->
							<div class="flex space-x-2 mb-3">
								<button
									on:click={selectCustomTip}
									class="px-3 py-2 text-sm rounded-lg font-medium transition-colors {
										tipMethod === 'custom'
											? 'bg-blue-600 text-white'
											: 'bg-gray-700 hover:bg-gray-600 text-gray-300'
									}"
								>
									Custom
								</button>
								<input
									type="number"
									placeholder="0.00"
									step="0.01"
									min="0"
									bind:value={customTipAmount}
									on:input={() => { tipMethod = 'custom'; calculateTip(); }}
									class="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
								/>
							</div>
						</details>
						
						<!-- No Tip Button -->
						<button
							on:click={selectNoTip}
							class="w-full p-2 text-sm rounded-lg font-medium transition-colors {
								tipMethod === 'none'
									? 'bg-gray-500 text-white'
									: 'bg-gray-700 hover:bg-gray-600 text-gray-300'
							}"
						>
							No Tip
						</button>
						
						<!-- Tip Amount Display -->
						{#if tipAmount > 0}
							<div class="flex justify-between items-center mt-3 pt-2 border-t border-gray-600">
								<span class="text-sm text-gray-300">Tip Amount</span>
								<span class="text-lg text-blue-400">${tipAmount.toFixed(2)}</span>
							</div>
						{/if}
					</div>
					
					<!-- Total -->
					<div class="border-t border-gray-600 pt-3">
						<div class="flex justify-between items-center">
							<label class="text-lg font-medium text-gray-300">Total</label>
							<div class="text-3xl font-bold text-green-400">${totalWithTip.toFixed(2)}</div>
						</div>
					</div>
				</div>

				<!-- Payment Method -->
				<div>
					<label class="block text-sm font-medium text-gray-300 mb-3">Payment Method</label>
					<div class="space-y-2">
						<label class="flex items-center p-3 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-colors">
							<input
								type="radio"
								bind:group={paymentMethod}
								value="card"
								class="mr-3 text-blue-600"
							>
							<div class="flex items-center">
								<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
								</svg>
								<span>Credit/Debit Card (Stripe)</span>
							</div>
						</label>
						
						<label class="flex items-center p-3 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-colors">
							<input
								type="radio"
								bind:group={paymentMethod}
								value="cash"
								class="mr-3 text-blue-600"
							>
							<div class="flex items-center">
								<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v2a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
								</svg>
								<span>Cash</span>
							</div>
						</label>
						
						<label class="flex items-center p-3 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-colors opacity-50">
							<input
								type="radio"
								bind:group={paymentMethod}
								value="split"
								class="mr-3 text-blue-600"
								disabled
							>
							<div class="flex items-center">
								<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
								</svg>
								<span>Split Payment (Coming Soon)</span>
							</div>
						</label>
					</div>
				</div>

				{#if paymentMethod === "card"}
					<div class="space-y-4">
						<div class="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
							<p class="text-sm text-blue-300 mb-3">
								{#if !authorizedPaymentIntent}
								💳 Enter card details below:
							{:else}
								✅ Card Already Authorized - Ready to Complete:
							{/if}
							</p>
							{#if !authorizedPaymentIntent}
								<!-- Stripe Card Element -->
								<div 
									id="stripe-card-element" 
									class="p-3 bg-gray-700 border border-gray-600 rounded-lg min-h-[50px] flex items-center"
								>
									<!-- Stripe Elements will mount here -->
								</div>
							{:else}
								<!-- Card Already Authorized Display -->
								<div class="p-4 bg-green-800/30 rounded-lg border border-green-600 text-green-300">
									✅ Card authorized for ${authorizedAmount.toFixed(2)}
									<br>Adding tip of ${tipAmount.toFixed(2)}
									<br><strong>Final total: ${totalWithTip.toFixed(2)}</strong>
								</div>
							{/if}
						</div>
					</div>
				{:else if paymentMethod === "cash"}
					<div class="p-4 bg-green-900/20 border border-green-700 rounded-lg">
						<p class="text-sm text-green-300">
							💵 Confirm cash payment received from customer.
						</p>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="p-6 border-t border-gray-700 flex space-x-3">
				<button
					on:click={closePaymentModal}
					class="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-medium"
				>
					Cancel
				</button>
				<button
					on:click={authorizedPaymentIntent ? capturePaymentWithTip : processPayment}
					class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium"
				>
					{#if authorizedPaymentIntent}
						✅ Complete Transaction - ${totalWithTip.toFixed(2)}
					{:else}
						{paymentMethod === "card" ? "Process Card" : paymentMethod === "cash" ? "Confirm Cash" : "Process Payment"}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}


<!-- Order History Modal -->
{#if showHistoryModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
		<div class="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
			<!-- Header -->
			<div class="flex justify-between items-center p-6 border-b border-gray-700">
				<h2 class="text-2xl font-bold text-white">Order History - Today's Shift</h2>
				<button
					on:click={() => showHistoryModal = false}
					class="text-gray-400 hover:text-white p-2"
				>
					✕
				</button>
			</div>

			<!-- History Content -->
			<div class="p-6 space-y-4">
				{#if completedOrders.length > 0}
					{#each completedOrders as order}
						<div class="bg-gray-900/50 rounded-lg border border-gray-600 p-4">
							<div class="flex justify-between items-start mb-3">
								<div>
									<h3 class="text-lg font-semibold text-white">
										{order.table_name} - #{order.ticket_number}
									</h3>
									<p class="text-sm text-gray-400">
										{new Date(order.timestamp).toLocaleString()}
									</p>
								</div>
								<div class="text-right">
									<p class="text-xl font-bold text-green-400">${order.total.toFixed(2)}</p>
									<p class="text-sm text-gray-400">
										Subtotal: ${order.subtotal.toFixed(2)} • Tip: ${order.tip.toFixed(2)}
									</p>
								</div>
							</div>
							
							<!-- Order Items -->
							<div class="space-y-2">
								<h4 class="text-sm font-medium text-gray-300">Items:</h4>
								{#each order.items as item}
									<div class="flex justify-between text-sm bg-gray-800/50 p-2 rounded">
										<span class="text-gray-300">
											{item.quantity}x {item.expand?.menu_item?.name || 'Unknown Item'}
											{#if item.customization_details}
												<span class="text-xs text-blue-400">
													• {item.customization_details}
												</span>
											{/if}
										</span>
										<span class="text-white font-medium">
											${(item.unit_price * item.quantity).toFixed(2)}
										</span>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				{:else}
					<div class="text-center py-8 text-gray-400">
						<p>No completed orders yet</p>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="p-6 border-t border-gray-700 text-center">
				<p class="text-sm text-gray-400">
					Total Orders: {completedOrders.length} • 
					Total Revenue: ${completedOrders.reduce((sum, order) => sum + order.total, 0).toFixed(2)}
				</p>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes slow-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}
	
	.slow-pulse {
		animation: slow-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
</style>
