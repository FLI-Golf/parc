<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/auth.js';
	import { collections, shifts, menuItems, sections, tables, loading } from '$lib/stores/collections.js';

	let activeTab = 'today';
	let user = null;

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

	async function updateShiftStatus(shiftId, status) {
		try {
			await collections.updateShift(shiftId, { status });
		} catch (error) {
			console.error('Error updating shift status:', error);
			alert('Failed to update shift status');
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
									<h3 class="text-xl font-bold">{shift.position}</h3>
									<p class="text-gray-400">
										{shift.start_time} - {shift.end_time}
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

							<div class="flex space-x-3">
								{#if shift.status === 'scheduled'}
									<button
										on:click={() => updateShiftStatus(shift.id, 'confirmed')}
										class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium"
									>
										Confirm Attendance
									</button>
								{:else if shift.status === 'confirmed'}
									<button
										on:click={() => updateShiftStatus(shift.id, 'completed')}
										class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
									>
										Mark Complete
									</button>
								{/if}
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
									<p class="text-sm text-gray-300">{shift.start_time} - {shift.end_time}</p>
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
