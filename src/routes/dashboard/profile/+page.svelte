<script>
	import { onMount } from 'svelte';
	import PocketBase from 'pocketbase';
	import { goto } from '$app/navigation';
	
	// Initialize PocketBase client
	const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');
	
	let name = '';
	let email = '';
	let loading = true;
	let saving = false;
	let error = '';
	let success = '';
	
	// Check if user is logged in and fetch user data
	onMount(async () => {
		if (!pb.authStore.isValid) {
			// Redirect to login if not authenticated
			goto('/');
		} else {
			try {
				// Fetch current user data
				const user = pb.authStore.model;
				name = user.name || '';
				email = user.email || '';
			} catch (err) {
				console.error('Error fetching user data:', err);
				error = 'Failed to load user data';
			} finally {
				loading = false;
			}
		}
	});
	
	// Handle profile update
	async function updateProfile() {
		if (loading || saving) return;
		
		error = '';
		success = '';
		saving = true;
		
		try {
			// Update user data in PocketBase
			const userData = {
				name: name
			};
			
			const record = await pb.collection('users').update(pb.authStore.model.id, userData);
			console.log('User updated:', record);
			
			success = 'Profile updated successfully!';
			
			// Update the local auth store
			pb.authStore.model.name = name;
		} catch (err) {
			console.error('Error updating profile:', err);
			error = 'Failed to update profile. Please try again.';
		} finally {
			saving = false;
		}
	}
	
	// Handle logout
	function handleLogout() {
		pb.authStore.clear();
		goto('/');
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100">
	<!-- Header -->
	<header class="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center py-6">
				<div class="flex items-center space-x-4">
					<button 
						on:click={() => goto('/dashboard')}
						class="flex items-center text-gray-300 hover:text-white"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
						</svg>
						Back to Dashboard
					</button>
				</div>
				<div class="flex items-center space-x-4">
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
	<main class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
		<div class="text-center mb-10">
			<h1 class="text-3xl font-bold">Update Profile</h1>
			<p class="text-gray-400 mt-2">Manage your personal information</p>
		</div>

		<div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-8">
			{#if loading}
				<div class="flex justify-center items-center h-64">
					<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
				</div>
			{:else}
				{#if error}
					<div class="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
						{error}
					</div>
				{/if}
				
				{#if success}
					<div class="mb-6 p-4 bg-green-900/50 border border-green-700 rounded-md text-green-200 text-sm">
						{success}
					</div>
				{/if}

				<form on:submit|preventDefault={updateProfile} class="space-y-6">
					<div>
						<label for="name" class="block text-sm font-medium text-gray-300 mb-1">
							Full Name
						</label>
						<input
							id="name"
							name="name"
							type="text"
							bind:value={name}
							class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Your full name"
						/>
					</div>

					<div>
						<label for="email" class="block text-sm font-medium text-gray-300 mb-1">
							Email Address
						</label>
						<input
							id="email"
							name="email"
							type="email"
							bind:value={email}
							disabled
							class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-400 placeholder-gray-500 cursor-not-allowed"
							placeholder="Your email address"
						/>
						<p class="mt-2 text-sm text-gray-500">
							Email address cannot be changed
						</p>
					</div>

					<div class="pt-4">
						<button
							type="submit"
							disabled={saving}
							class="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{#if saving}
								<span>Updating...</span>
							{:else}
								<span>Update Profile</span>
							{/if}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</main>
</div>