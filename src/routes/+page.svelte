<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import pb from '$lib/pocketbase.js';
	
	let email = '';
	let password = '';
	let error = '';
	let isLoading = false;
	
	// Check if user is already logged in
	onMount(async () => {
		let redirected = false;
		if (pb.authStore.isValid && !redirected) {
			redirected = true;
			goto('/dashboard');
		}
	});
	
	// Handle login form submission
	async function handleLogin() {
		error = '';
		isLoading = true;
		
		try {
			// Authenticate user
			const authData = await pb.collection('users').authWithPassword(email, password);
			console.log('User authenticated:', authData);
			
			// Redirect based on role
			const userRole = authData.record.role?.toLowerCase();
			if (userRole === 'manager' || userRole === 'owner') {
				goto('/dashboard/manager');
			} else if (['server', 'host', 'bartender', 'busser', 'chef', 'kitchen_prep', 'dishwasher'].includes(userRole)) {
				goto('/dashboard/server');
			} else {
				goto('/dashboard');
			}
		} catch (err) {
			console.error('Login error:', err);
			error = 'Invalid email or password. Please try again.';
		} finally {
			isLoading = false;
		}
	}
	
	// Handle registration link
	function goToRegister() {
		goto('/register');
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100 flex flex-col">
	<!-- Header -->
	<header class="py-6 px-4 sm:px-6 lg:px-8">
		<div class="flex justify-between items-center">
			<div class="flex items-center space-x-2">
				<div class="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
					<span class="font-bold text-xl">P</span>
				</div>
				<h1 class="text-2xl font-bold">PARC Portal</h1>
			</div>
			<nav class="hidden md:block">
				<ul class="flex space-x-8">
					<li><a href="/" class="hover:text-blue-400 transition-colors">Home</a></li>
					<li><a href="/dashboard/reservations" class="hover:text-blue-400 transition-colors">Reservations</a></li>
					<li><a href="#" class="hover:text-blue-400 transition-colors">About</a></li>
					<li><a href="#" class="hover:text-blue-400 transition-colors">Contact</a></li>
				</ul>
			</nav>
		</div>
	</header>

	<!-- Main Content -->
	<main class="flex-grow flex items-center justify-center px-4 py-12">
		<div class="max-w-md w-full space-y-8">
			<!-- Welcome Section -->
			<div class="text-center">
				<h2 class="mt-6 text-3xl font-extrabold">Welcome to PARC Portal</h2>
				<p class="mt-2 text-gray-400">
					Login to manage your information and access company resources
				</p>
			</div>

			<!-- Login Form -->
			<div class="bg-gray-800/50 backdrop-blur-sm py-8 px-6 rounded-xl shadow-xl border border-gray-700">
				{#if error}
					<div class="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
						{error}
					</div>
				{/if}

				<form on:submit|preventDefault={handleLogin} class="space-y-6">
					<div>
						<label for="email" class="block text-sm font-medium text-gray-300 mb-1">
							Email address
						</label>
						<input
							id="email"
							name="email"
							type="email"
							bind:value={email}
							required
							class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="you@company.com"
						/>
					</div>

					<div>
						<label for="password" class="block text-sm font-medium text-gray-300 mb-1">
							Password
						</label>
						<input
							id="password"
							name="password"
							type="password"
							bind:value={password}
							required
							class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="••••••••"
						/>
					</div>

					<div class="flex items-center justify-between">
						<div class="flex items-center">
							<input
								id="remember-me"
								name="remember-me"
								type="checkbox"
								class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700"
							/>
							<label for="remember-me" class="ml-2 block text-sm text-gray-300">
								Remember me
							</label>
						</div>

						<div class="text-sm">
							<a href="#" class="font-medium text-blue-400 hover:text-blue-300">
								Forgot your password?
							</a>
						</div>
					</div>

					<div>
						<button
							type="submit"
							disabled={isLoading}
							class="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{#if isLoading}
								<span>Signing in...</span>
							{:else}
								<span>Sign in</span>
							{/if}
						</button>
					</div>
				</form>

				<div class="mt-6">
					<div class="relative">
						<div class="absolute inset-0 flex items-center">
							<div class="w-full border-t border-gray-600"></div>
						</div>
						<div class="relative flex justify-center text-sm">
							<span class="px-2 bg-gray-800 text-gray-400">
								New user?
							</span>
						</div>
					</div>

					<div class="mt-6">
						<button
							on:click={goToRegister}
							class="w-full flex justify-center py-3 px-4 border border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-300 hover:text-white bg-gray-700/50 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
						>
							Create an account
						</button>
					</div>
				</div>
			</div>

			<!-- Features Section -->
			<div class="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
				<div class="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
					<div class="mx-auto w-12 h-12 rounded-full bg-blue-900/50 flex items-center justify-center mb-3">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
						</svg>
					</div>
					<h3 class="font-medium text-gray-200">Easy Updates</h3>
					<p class="mt-1 text-sm text-gray-400">Update your information quickly</p>
				</div>
				<div class="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
					<div class="mx-auto w-12 h-12 rounded-full bg-blue-900/50 flex items-center justify-center mb-3">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
						</svg>
					</div>
					<h3 class="font-medium text-gray-200">Secure Access</h3>
					<p class="mt-1 text-sm text-gray-400">Enterprise-grade security</p>
				</div>
				<div class="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
					<div class="mx-auto w-12 h-12 rounded-full bg-blue-900/50 flex items-center justify-center mb-3">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.644 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
						</svg>
					</div>
					<h3 class="font-medium text-gray-200">Team Management</h3>
					<p class="mt-1 text-sm text-gray-400">Manage your team efficiently</p>
				</div>
			</div>
		</div>
	</main>

	<!-- Footer -->
	<footer class="py-6 px-4 sm:px-6 lg:px-8 border-t border-gray-800">
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
	</footer>
</div>
