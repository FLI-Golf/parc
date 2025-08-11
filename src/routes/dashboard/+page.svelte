<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/auth.js';
	
	let user = null;
	let loading = true;
	let error = '';
	
	// Check if user is logged in and redirect to role-specific dashboard
	onMount(async () => {
		let handled = false;
		const unsubscribe = authStore.subscribe((auth) => {
			if (handled) return;
			if (!auth.isLoggedIn && !auth.isLoading) {
				handled = true;
				goto('/');
				return;
			}

			if (auth.isLoggedIn) {
				user = auth.user;
				loading = false;

				// Redirect to role-specific dashboard
				const userRole = auth.role?.toLowerCase();
				if (userRole === 'manager' || userRole === 'owner') {
					handled = true;
					goto('/dashboard/manager');
				} else if (['server', 'host', 'bartender', 'busser', 'chef', 'kitchen_prep', 'dishwasher'].includes(userRole)) {
					handled = true;
					goto('/dashboard/server');
				} else {
					console.log('User role:', auth.role);
				}
			}
		});

		return unsubscribe;
	});
	
	// Handle logout
	async function handleLogout() {
		const { auth } = await import('$lib/auth.js');
		await auth.logout();
		goto('/');
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
					<h1 class="text-2xl font-bold">PARC Portal</h1>
				</div>
				<div class="flex items-center space-x-4">
					{#if user}
						<div class="flex items-center space-x-2">
							<div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
								<span class="font-medium">{user.name?.charAt(0) || user.email?.charAt(0) || 'U'}</span>
							</div>
							<span class="hidden md:inline">{user.name || user.email}</span>
						</div>
					{/if}
					<button
						on:click={handleLogout}
						class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium"
					>
						Logout
					</button>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		{#if loading}
			<div class="flex justify-center items-center h-64">
				<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
			</div>
		{:else if error}
			<div class="bg-red-900/50 border border-red-700 rounded-lg p-6 text-center">
				<h2 class="text-xl font-bold text-red-200 mb-2">Error</h2>
				<p class="text-red-300">{error}</p>
				<button
					on:click={() => window.location.reload()}
					class="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg transition-colors"
				>
					Retry
				</button>
			</div>
		{:else}
			<div class="mb-8">
				<h2 class="text-3xl font-bold">Dashboard</h2>
				<p class="text-gray-400 mt-2">Welcome back, {user?.name || user?.email}!</p>
			</div>

			<!-- Dashboard Grid -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<!-- Profile Card -->
				<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
					<div class="flex items-center mb-4">
						<div class="w-12 h-12 rounded-lg bg-blue-900/50 flex items-center justify-center mr-3">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
							</svg>
						</div>
						<h3 class="text-xl font-bold">Your Profile</h3>
					</div>
					<div class="space-y-3">
						<div>
							<label class="text-sm text-gray-400">Name</label>
							<p class="font-medium">{user?.name || 'Not provided'}</p>
						</div>
						<div>
							<label class="text-sm text-gray-400">Email</label>
							<p class="font-medium">{user?.email || 'Not provided'}</p>
						</div>
						<button
							on:click={updateProfile}
							class="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
						>
							Update Profile
						</button>
					</div>
				</div>

				<!-- Information Card -->
				<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
					<div class="flex items-center mb-4">
						<div class="w-12 h-12 rounded-lg bg-blue-900/50 flex items-center justify-center mr-3">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<h3 class="text-xl font-bold">Information</h3>
					</div>
					<div class="space-y-4">
						<div class="p-4 bg-gray-700/30 rounded-lg">
							<h4 class="font-medium text-gray-200">Company News</h4>
							<p class="text-sm text-gray-400 mt-1">Stay updated with the latest company news and announcements.</p>
						</div>
						<div class="p-4 bg-gray-700/30 rounded-lg">
							<h4 class="font-medium text-gray-200">Policy Updates</h4>
							<p class="text-sm text-gray-400 mt-1">Review the latest policy changes and updates.</p>
						</div>
					</div>
				</div>

				<!-- Quick Actions Card -->
				<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
					<div class="flex items-center mb-4">
						<div class="w-12 h-12 rounded-lg bg-blue-900/50 flex items-center justify-center mr-3">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
						</div>
						<h3 class="text-xl font-bold">Quick Actions</h3>
					</div>
					<div class="space-y-3">
						<button class="w-full px-4 py-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors text-left">
							<h4 class="font-medium">Request Time Off</h4>
							<p class="text-sm text-gray-400">Submit a leave request</p>
						</button>
						<button class="w-full px-4 py-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors text-left">
							<h4 class="font-medium">Update Contact Info</h4>
							<p class="text-sm text-gray-400">Change your phone or address</p>
						</button>
						<button class="w-full px-4 py-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors text-left">
							<h4 class="font-medium">View Pay Stubs</h4>
							<p class="text-sm text-gray-400">Access your payment history</p>
						</button>
					</div>
				</div>

				<!-- Team Management (Managers Only) -->
				<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 md:col-span-2 lg:col-span-3">
					<div class="flex items-center mb-4">
						<div class="w-12 h-12 rounded-lg bg-blue-900/50 flex items-center justify-center mr-3">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.644 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
							</svg>
						</div>
						<h3 class="text-xl font-bold">Team Management</h3>
					</div>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<button class="px-4 py-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors text-left">
							<h4 class="font-medium">View Team Members</h4>
							<p class="text-sm text-gray-400">See all team members</p>
						</button>
						<button class="px-4 py-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors text-left">
							<h4 class="font-medium">Assign Tasks</h4>
							<p class="text-sm text-gray-400">Delegate work to team</p>
						</button>
						<button class="px-4 py-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors text-left">
							<h4 class="font-medium">Performance Reviews</h4>
							<p class="text-sm text-gray-400">Manage evaluations</p>
						</button>
					</div>
				</div>
			</div>
		{/if}
	</main>

	<!-- Footer -->
	<footer class="mt-12 py-6 px-4 sm:px-6 lg:px-8 border-t border-gray-800">
		<div class="max-w-7xl mx-auto">
			<div class="flex flex-col md:flex-row justify-between items-center">
				<div class="flex items-center space-x-2 mb-4 md:mb-0">
					<div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
						<span class="font-bold text-lg">P</span>
					</div>
					<span class="text-gray-400">PARC Portal &copy; 2025</span>
				</div>
				<div class="flex space-x-6">
					<a href="#" class="text-gray-400 hover:text-gray-300">Privacy Policy</a>
					<a href="#" class="text-gray-400 hover:text-gray-300">Terms of Service</a>
					<a href="#" class="text-gray-400 hover:text-gray-300">Contact Support</a>
				</div>
			</div>
		</div>
	</footer>
</div>