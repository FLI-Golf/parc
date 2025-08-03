<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/auth.js';
	import { collections, shifts, menuItems, sections, tables, loading } from '$lib/stores/collections.js';

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
						collections.getTables()
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
		if (!sectionId || !$tables || !$sections) return [];
		const section = $sections.find(s => s.id === sectionId);
		if (!section || !section.section_code) return [];
		
		return $tables.filter(table => table.section_code === section.section_code);
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
	
	// Reactive statement for current shift's tables
	$: currentShiftTables = (todayShifts.length > 0 && todayShifts[0] && selectedAdditionalSections) 
		? getAllMyTables(todayShifts[0].assigned_section) 
		: [];

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
									{:else if currentShiftTables.length > 0}
										<div class="space-y-2">
											<p class="text-sm text-green-400 font-medium">Your Tables:</p>
											<div class="flex flex-wrap gap-2">
												{#each currentShiftTables as table}
													<div class="px-3 py-1 bg-gray-800/50 border rounded-lg text-sm font-medium flex items-center gap-2 {
														$sections.find(s => s.section_code === table.section_code)?.id === shift.assigned_section
															? 'border-green-600 text-green-300' 
															: 'border-blue-600 text-blue-300'
													}">
														<span>{table.table_name || table.table_number_field}</span>
														{#if table.capacity || table.seats_field}
															<span class="text-xs text-gray-400">({table.capacity || table.seats_field} seats)</span>
														{/if}
														<span class="text-xs px-1 py-0.5 rounded {
															$sections.find(s => s.section_code === table.section_code)?.id === shift.assigned_section
																? 'bg-green-900/50 text-green-400' 
																: 'bg-blue-900/50 text-blue-400'
														}">{$sections.find(s => s.section_code === table.section_code)?.section_name || table.section_code}</span>
														<div class="flex gap-1">
															<button
																on:click={() => updateTableStatus(table.id, 'occupied')}
																class="w-2 h-2 rounded-full bg-red-500 hover:bg-red-400"
																title="Mark as Occupied"
															></button>
															<button
																on:click={() => updateTableStatus(table.id, 'available')}
																class="w-2 h-2 rounded-full bg-green-500 hover:bg-green-400"
																title="Mark as Available"
															></button>
															<button
																on:click={() => updateTableStatus(table.id, 'cleaning')}
																class="w-2 h-2 rounded-full bg-yellow-500 hover:bg-yellow-400"
																title="Mark as Cleaning"
															></button>
														</div>
													</div>
												{/each}
											</div>
										</div>
									{:else}
										<p class="text-sm text-green-400">No tables assigned to this section</p>
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
