<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/auth.js';
	import { collections, shifts, menuItems, loading } from '$lib/stores/collections.js';

	let activeTab = 'today';
	let user = null;

	// Reactive declarations
	$: myShifts = $shifts.filter(shift => 
		shift.expand?.staff_member?.user_id === user?.id
	);
	
	$: todayShifts = myShifts.filter(shift => 
		shift.shift_date === new Date().toISOString().split('T')[0]
	);

	$: upcomingShifts = myShifts.filter(shift => 
		new Date(shift.shift_date) > new Date() && 
		shift.shift_date !== new Date().toISOString().split('T')[0]
	).sort((a, b) => new Date(a.shift_date) - new Date(b.shift_date));

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
						collections.getMenuItems()
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

	async function updateShiftStatus(shiftId, status) {
		try {
			await collections.updateShift(shiftId, { status });
		} catch (error) {
			console.error('Error updating shift status:', error);
			alert('Failed to update shift status');
		}
	}

	function formatDate(dateStr) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
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
				<p class="text-gray-400 mt-2">{formatDate(new Date().toISOString().split('T')[0])}</p>
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
