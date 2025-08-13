<script>
	import { onMount } from 'svelte';
	import PocketBase from 'pocketbase';
	import { goto } from '$app/navigation';
	
	// Initialize PocketBase client
	const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');
	
	let name = '';
	let email = '';
	let role = '';
	let phone = '';
	let staffId = '';
	let loading = true;
	let saving = false;
	let error = '';
	let success = '';
	
	// Check if user is logged in and fetch user data
	onMount(async () => {
		if (!pb.authStore.isValid) {
			goto('/');
			return;
		}
		try {
		// User basics
		const user = pb.authStore.model;
		console.log('[Profile] user model:', user);
		name = user?.name || '';
		email = user?.email || '';
		role = user?.role || '';
		// Load staff record linked to this user (for phone)
		let staffCollectionName = 'staff_collection';
		try {
		const staffRec = await pb.collection(staffCollectionName).getFirstListItem(`user_id="${user.id}"`);
		console.log('[Profile] staff by user_id:', staffRec);
		staffId = staffRec?.id || '';
		 phone = staffRec?.phone || '';
		} catch (e1) {
		 // Try fallback collection name 'staff'
		 try {
		  staffCollectionName = 'staff';
		   const staffRec = await pb.collection(staffCollectionName).getFirstListItem(`user_id="${user.id}"`);
		  console.log('[Profile] staff (fallback) by user_id:', staffRec);
		 staffId = staffRec?.id || '';
		 phone = staffRec?.phone || '';
		} catch (e1b) {
		 console.warn('[Profile] staff by user_id not found in either collection, trying email', email, e1, e1b);
		 // Try matching by email as a fallback (both collections)
		  try {
		    staffCollectionName = 'staff_collection';
		    const staffRecByEmail = await pb.collection(staffCollectionName).getFirstListItem(`email="${email}"`);
		    console.log('[Profile] staff by email:', staffRecByEmail);
		    staffId = staffRecByEmail?.id || '';
		    phone = staffRecByEmail?.phone || '';
		  } catch (e2) {
		    try {
		      staffCollectionName = 'staff';
		      const staffRecByEmail2 = await pb.collection(staffCollectionName).getFirstListItem(`email="${email}"`);
		      console.log('[Profile] staff (fallback) by email:', staffRecByEmail2);
		      staffId = staffRecByEmail2?.id || '';
		      phone = staffRecByEmail2?.phone || '';
		    } catch (e2b) {
		      console.warn('[Profile] staff by email not found in either collection', e2, e2b);
		    }
		  }
		 }
		}
		console.log('[Profile] resolved fields:', { name, email, role, staffId, phone, staffCollectionName });
		} catch (err) {
		  console.error('Error fetching profile data:', err);
			error = 'Failed to load profile data';
		} finally {
			loading = false;
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
			const userData = { name };
			const record = await pb.collection('users').update(pb.authStore.model.id, userData);
			console.log('User updated:', record);
			// Update staff phone if we have a staff record, or create one on the fly
			// Pick the collection we found earlier if available
			const staffCollection = (typeof staffCollectionName !== 'undefined' && staffCollectionName) ? staffCollectionName : 'staff_collection';
			if (staffId) {
				try { await pb.collection(staffCollection).update(staffId, { phone }); } catch (e) { console.warn('Could not update staff phone:', e); }
			} else if (phone && phone.trim()) {
				try {
					const [first_name = '', last_name = ''] = (name || '').split(' ');
					let created;
					try {
						created = await pb.collection(staffCollection).create({ first_name, last_name, email, phone, position: (role || 'server'), status: 'active', user_id: pb.authStore.model.id });
					} catch (eCreate1) {
						// fallback
						const alt = staffCollection === 'staff' ? 'staff_collection' : 'staff';
						created = await pb.collection(alt).create({ first_name, last_name, email, phone, position: (role || 'server'), status: 'active', user_id: pb.authStore.model.id });
					}
					staffId = created?.id || '';
				} catch (e) {
					console.warn('Could not create staff record for phone:', e);
				}
			}
			success = 'Profile updated successfully!';
			// Update local auth store
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
				<label for="name" class="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
				<input id="name" name="name" type="text" bind:value={name} class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Your full name" />
				</div>

				<div>
				<label for="email" class="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
				<input id="email" name="email" type="email" bind:value={email} disabled class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-400 placeholder-gray-500 cursor-not-allowed" placeholder="Your email address" />
				<p class="mt-2 text-sm text-gray-500">Email address cannot be changed</p>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				 <div>
				  <label class="block text-sm font-medium text-gray-300 mb-1">Role</label>
				  <div class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-300 capitalize">{role || 'Not provided'}</div>
				</div>
				<div>
				 <label for="phone" class="block text-sm font-medium text-gray-300 mb-1">Phone</label>
				 <input id="phone" name="phone" type="tel" bind:value={phone} placeholder="(555) 123-4567" class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
				</div>
				</div>

				<div class="pt-4">
				<button type="submit" disabled={saving} class="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
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