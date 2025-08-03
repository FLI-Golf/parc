<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/auth.js';
	import { collections, shifts, menuItems, sections, tables, tickets, ticketItems, loading } from '$lib/stores/collections.js';

	let activeTab = 'today';
	let user = null;

	// Shift timer state
	let shiftTimers = new Map(); // Map of shiftId -> timer data
	let currentTime = new Date();
	let timeInterval;

	// Reactive declarations
	$: myShifts = $shifts.filter(shift => {
		console.log('Checking shift:', shift);
		console.log('Staff member fields:', Object.keys(shift.expand?.staff_member || {}));
		console.log('shift.expand.staff_member:', shift.expand?.staff_member);
		console.log('user?.id:', user?.id);
		console.log('user?.email:', user?.email);
		
		// Try matching by email as fallback
		const emailMatch = shift.expand?.staff_member?.email === user?.email;
		const userIdMatch = shift.expand?.staff_member?.user_id === user?.id;
		console.log('Email match:', emailMatch, 'User ID match:', userIdMatch);
		
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
		console.log('Today filter - shiftDateOnly:', shiftDateOnly, 'today:', today, 'match:', shiftDateOnly === today);
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

		// Check authentication and role
		const unsubscribe = authStore.subscribe(async (auth) => {
			if (!auth.isLoggedIn && !auth.isLoading) {
				goto('/');
				return;
			}
			
			const userRole = auth.role?.toLowerCase();
			if (auth.isLoggedIn && !['server', 'host', 'bartender', 'busser', 'chef', 'kitchen_prep', 'dishwasher'].includes(userRole)) {
				goto('/dashboard');
				return;
			}

			if (auth.isLoggedIn) {
				user = auth.user;
				// Load relevant data for servers
				try {
					await Promise.all([
						collections.getShifts(),
						collections.getMenuItems(),
						collections.getSections(),
						collections.getTables(),
						collections.getTickets()
					]);
					
					// Try to load table updates (optional - collection may not exist yet)
					try {
						await collections.getTableUpdates();
					} catch (tableUpdateError) {
						console.warn('Table updates collection not available:', tableUpdateError.message);
					}
					
					console.log('Loaded shifts:', $shifts);
					console.log('Current user:', user);
					
					// Load any existing shift timers
					loadShiftTimers();
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
			
			await collections.updateShift(shiftId, { status });
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
			console.log('getTablesForSection early return:', { sectionId, tablesLength: $tables?.length, sectionsLength: $sections?.length });
			return [];
		}
		const section = $sections.find(s => s.id === sectionId);
		console.log('getTablesForSection:', { sectionId, section, allSections: $sections });
		if (!section || !section.section_code) {
			console.log('No section found or no section_code:', section);
			return [];
		}
		
		const filteredTables = $tables.filter(table => table.section_code === section.section_code);
		console.log('Filtered tables:', { sectionCode: section.section_code, filteredTables, allTables: $tables });
		return filteredTables;
	}

	// Helper to get all tables the server is responsible for (assigned + helping sections)
	function getAllMyTables(assignedSectionId) {
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
		if (selectedAdditionalSections.has(sectionId)) {
			selectedAdditionalSections.delete(sectionId);
		} else {
			selectedAdditionalSections.add(sectionId);
		}
		selectedAdditionalSections = new Set(selectedAdditionalSections);
	}

	// Update table status
	async function updateTableStatus(tableId, status, notes = '') {
		try {
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
			console.log(statusMessages[status] || 'Table status updated');
			
		} catch (error) {
			console.error('Error updating table status:', error);
			alert('Failed to update table status');
		}
	}

	// State for expanded sections view
	let showAllSections = false;
	let selectedAdditionalSections = new Set(); // Track additional sections server is helping with
	
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
	
	// Calculate totals from current ticket items (reactive)
	$: calculatedSubtotal = currentTicketItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
	$: calculatedTax = calculatedSubtotal * 0.08875; // NYC tax rate
	$: calculatedTotal = calculatedSubtotal + calculatedTax;
	
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
	let selectedCategory = 'appetizer';
	let searchQuery = '';
	let showModifiers = false;
	
	// Reactive statement for current shift's tables
	$: currentShiftTables = (todayShifts.length > 0 && todayShifts[0] && selectedAdditionalSections !== undefined) 
		? getAllMyTables(todayShifts[0].assigned_section) 
		: [];
		
	// Debug current shift tables
	$: {
		if (todayShifts.length > 0 && todayShifts[0]) {
			console.log('Debug currentShiftTables:', {
				shiftId: todayShifts[0].id,
				assignedSection: todayShifts[0].assigned_section,
				currentShiftTables,
				allSections: $sections,
				allTables: $tables
			});
		}
	}

	// Reactive checks for break reminders and auto-completion
	$: {
		if (currentTime && todayShifts.length > 0) {
			todayShifts.forEach(shift => {
				const timer = shiftTimers.get(shift.id);
				if (timer) {
					// Check for break reminder
					if (shouldShowBreakReminder(shift.id)) {
						alert('Time for your break! You\'ve been working for 3 hours.');
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
			const ticketData = {
				table_id: selectedTable.id,
				server_id: user.id,
				customer_count: customerCount
			};
			
			currentTicket = await collections.createTicket(ticketData);
			currentTicketItems = [];
			
			// Update table status to occupied
			await updateTableStatus(selectedTable.id, 'occupied');
		} catch (error) {
			console.error('Error creating ticket:', error);
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

	function closeTicketModal() {
		showTicketModal = false;
		selectedTable = null;
		currentTicket = null;
		currentTicketItems = [];
		selectedMenuItem = null;
		guestCount = 2; // Reset to default
		selectedCategory = 'appetizer';
		searchQuery = '';
		showModifiers = false;
		selectedModifiers = [];
	}

	// Filter menu items based on category and search
	$: filteredMenuItems = $menuItems.filter(item => {
		const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
		const matchesSearch = !searchQuery || 
			item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			item.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
		return matchesCategory && matchesSearch && item.available;
	});

	// Get category icon
	function getCategoryIcon(category) {
		const icons = {
			'appetizer': '🥗',
			'main_course': '🍽️',
			'dessert': '🍰',
			'beverage': '🍷',
			'special': '⭐',
			'side_dish': '🥘'
		};
		return icons[category] || '🍴';
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
					}
				};
				
				recognition.onerror = (event) => {
					console.error('Speech recognition error:', event.error);
					isRecording = false;
					isRecordingEdit = false;
				};
				
				recognition.onend = () => {
					isRecording = false;
					isRecordingEdit = false;
				};
			} else {
				speechSupported = false;
				console.log('Speech recognition not supported');
			}
		}
	}

	function startVoiceRecording(isEdit = false) {
		if (!recognition || !speechSupported) return;
		
		if (isEdit) {
			isRecordingEdit = true;
			isRecording = false;
		} else {
			isRecording = true;
			isRecordingEdit = false;
		}
		
		try {
			recognition.start();
		} catch (error) {
			console.error('Error starting speech recognition:', error);
			isRecording = false;
			isRecordingEdit = false;
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
									<div class="flex justify-between items-center mb-3">
										<h4 class="text-green-300 font-medium flex items-center">
											<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
											</svg>
											Assigned Section: {getSectionName(shift.assigned_section)}
										</h4>
										<button
											on:click={() => showAllSections = !showAllSections}
											class="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 hover:text-white transition-colors"
										>
											{showAllSections ? 'Hide' : 'Expand'} Sections
										</button>
									</div>
									
									{#if $loading.tables}
										<p class="text-sm text-green-400">Section assigned (tables loading...)</p>
									{:else}
										{@const directSectionTables = getTablesForSection(shift.assigned_section)}
										{#if directSectionTables.length > 0}
											<div class="space-y-2">
												<p class="text-sm text-green-400 font-medium">Your Tables:</p>
												<div class="flex flex-wrap gap-2">
													{#each directSectionTables as table}
														{@const existingTicket = $tickets.find(t => t.table_id === table.id && !['closed'].includes(t.status))}
														<button 
															on:click={() => handleTableClick(table)}
															class="px-3 py-1 bg-gray-800/50 border rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-700/50 transition-colors cursor-pointer border-green-600 text-green-300"
														>
															<span>{table.table_name || table.table_number_field}</span>
															{#if table.capacity || table.seats_field}
																<span class="text-xs text-gray-400">({table.capacity || table.seats_field} seats)</span>
															{/if}
															<span class="text-xs px-1 py-0.5 rounded bg-green-900/50 text-green-400">
																{getSectionName(shift.assigned_section) || 'Main Dining'}
															</span>
															
															<!-- Table status indicator -->
															{#if existingTicket}
																<div class="w-2 h-2 rounded-full bg-orange-500" title="Has active ticket"></div>
															{:else}
																<div class="w-2 h-2 rounded-full bg-gray-500" title="Available for new ticket"></div>
															{/if}
														</button>
													{/each}
												</div>
											</div>
										{:else}
											<div class="space-y-2">
												<p class="text-sm text-yellow-400 font-medium">Debug Info:</p>
												<p class="text-xs text-gray-400">
													Section ID: {shift.assigned_section}<br>
													Section Name: {getSectionName(shift.assigned_section)}<br>
													Available Sections: {$sections?.length || 0}<br>
													Available Tables: {$tables?.length || 0}
												</p>
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
															<div class="flex flex-wrap gap-1">
																{#each section.tables as table}
																	<div class="px-2 py-1 text-xs rounded flex items-center gap-1 {
																		section.id === shift.assigned_section ? 'bg-green-900/50 text-green-300' : 
																		selectedAdditionalSections.has(section.id) ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-700/50 text-gray-400'
																	}">
																		<span>{table.table_name || table.table_number_field}</span>
																		{#if table.capacity || table.seats_field}
																		<span>({table.capacity || table.seats_field})</span>
																		{/if}
																		{#if section.id === shift.assigned_section || selectedAdditionalSections.has(section.id)}
																		<div class="flex gap-0.5 ml-1">
																		<button
																		on:click={() => updateTableStatus(table.id, 'occupied')}
																		class="w-1.5 h-1.5 rounded-full bg-red-500 hover:bg-red-400"
																		title="Mark as Occupied"
																		></button>
																		<button
																		on:click={() => updateTableStatus(table.id, 'available')}
																		class="w-1.5 h-1.5 rounded-full bg-green-500 hover:bg-green-400"
																		title="Mark as Available"
																		></button>
																		<button
																		on:click={() => updateTableStatus(table.id, 'cleaning')}
																		class="w-1.5 h-1.5 rounded-full bg-yellow-500 hover:bg-yellow-400"
																		title="Mark as Cleaning"
																		></button>
																		</div>
																		{/if}
																	</div>
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
						<div class="flex space-x-2 mb-4">
							<button
								on:click={() => selectedCategory = 'all'}
								class="px-4 py-2 rounded-lg font-medium transition-colors {
									selectedCategory === 'all' 
										? 'bg-blue-600 text-white' 
										: 'bg-gray-700 text-gray-300 hover:bg-gray-600'
								}"
							>
								🍴 All
							</button>
							{#each ['appetizer', 'main_course', 'beverage', 'dessert', 'special'] as category}
								<button
									on:click={() => selectedCategory = category}
									class="px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 {
										selectedCategory === category 
											? 'bg-blue-600 text-white' 
											: 'bg-gray-700 text-gray-300 hover:bg-gray-600'
									}"
								>
									<span>{getCategoryIcon(category)}</span>
									<span class="capitalize">{category.replace('_', ' ')}</span>
								</button>
							{/each}
						</div>
						
						<!-- Search Bar -->
						<div class="relative">
							<svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
							</svg>
							<input
								type="text"
								placeholder="Search menu items..."
								bind:value={searchQuery}
								class="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
							>
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
								<button
									on:click={() => {
										collections.updateTicket(currentTicket.id, { status: 'sent_to_kitchen' });
										closeTicketModal();
									}}
									class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold"
								>
									🍳 Send to Kitchen
								</button>
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
