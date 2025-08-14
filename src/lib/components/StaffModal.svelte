<script>
	import { createEventDispatcher, onMount } from 'svelte';
	import { collections } from '$lib/stores/collections.js';
	import pb from '$lib/pocketbase.js';
	
	export let isOpen = false;
	export let editItem = null; // For editing existing staff
	
	const dispatch = createEventDispatcher();
	
	// Form data
	let formData = {
		first_name: '',
		last_name: '',
		email: '',
		phone: '',
		position: 'server',
		hourly_rate: '',
		hire_date: '',
		status: 'active',
		user_id: ''
	};
	
	// Users for dropdown linking (with filters and pagination)
	let users = [];
	let selectedUserId = '';
	let usersLoading = false;
	let usersPage = 1;
	let usersHasMore = true;
	let userQuery = '';
	let userRoleFilter = '';
	const roleOptions = [
		{ value: '', label: 'All roles' },
		{ value: 'manager', label: 'Manager' },
		{ value: 'general_manager', label: 'General Manager' },
		{ value: 'owner', label: 'Owner' },
		{ value: 'server', label: 'Server' },
		{ value: 'host', label: 'Host' },
		{ value: 'bartender', label: 'Bartender' },
		{ value: 'barback', label: 'Barback' },
		{ value: 'busser', label: 'Busser' },
		{ value: 'chef', label: 'Chef' },
		{ value: 'kitchen_prep', label: 'Kitchen Prep' },
		{ value: 'kitchen', label: 'Kitchen' },
		{ value: 'dishwasher', label: 'Dishwasher' },
		{ value: 'security', label: 'Security' }
	];
	
	let isSubmitting = false;
	let error = '';
	
	// Position options (expanded)
	const positions = [
		{ value: 'owner', label: 'Owner' },
		{ value: 'general_manager', label: 'General Manager' },
		{ value: 'manager', label: 'Manager' },
		{ value: 'server', label: 'Server' },
		{ value: 'host', label: 'Host' },
		{ value: 'bartender', label: 'Bartender' },
		{ value: 'barback', label: 'Barback' },
		{ value: 'busser', label: 'Busser' },
		{ value: 'chef', label: 'Chef' },
		{ value: 'kitchen', label: 'Kitchen' },
		{ value: 'kitchen_prep', label: 'Kitchen Prep' },
		{ value: 'dishwasher', label: 'Dishwasher' },
		{ value: 'head_of_security', label: 'Head of Security' },
		{ value: 'security', label: 'Security' },
		{ value: 'doorman', label: 'Doorman' }
	];
	
	// Status options
	const statuses = [
		{ value: 'active', label: 'Active' },
		{ value: 'inactive', label: 'Inactive' },
		{ value: 'terminated', label: 'Terminated' }
	];
	
	// Load users on open (for linking)
	$: if (isOpen) {
		loadUsers();
	}
	
	async function loadUsers(reset = false) {
		if (usersLoading) return;
		try {
			usersLoading = true;
			if (reset) {
				users = [];
				usersPage = 1;
				usersHasMore = true;
			}
			if (!usersHasMore) return;
			// Build filter
			const parts = [];
			if (userRoleFilter) parts.push(`role = "${userRoleFilter}"`);
			if (userQuery) {
				const q = userQuery.replace(/"/g, '\\"');
				parts.push(`(name ~ "%${q}%" || email ~ "%${q}%")`);
			}
			const filter = parts.join(' && ');
			const page = await pb.collection('_pb_users_auth_').getList(usersPage, 20, {
				filter: filter || undefined,
				fields: 'id,name,email,role,phone',
				sort: '+name'
			});
			const mapped = page.items.map(u => ({ id: u.id, name: u.name || '', email: u.email || '', role: u.role || '', phone: u.phone || '' }));
			users = users.concat(mapped);
			usersHasMore = page.page < page.totalPages;
			usersPage += 1;
		} catch (e) {
			console.error('Failed to load users:', e);
		} finally {
			usersLoading = false;
		}
	}
	
	// Prefill when selecting a user (for create only)
	$: if (!editItem && selectedUserId) {
		const u = users.find(x => x.id === selectedUserId);
		if (u) {
			formData.user_id = u.id;
			formData.email = u.email || formData.email;
			formData.phone = u.phone || formData.phone;
			if ((u.name || '').trim()) {
				const parts = u.name.trim().split(/\s+/);
				formData.first_name = formData.first_name || parts[0] || '';
				formData.last_name = formData.last_name || parts.slice(1).join(' ') || '';
			}
			// Optional: default position from role if empty
			if (!formData.position && u.role) {
				const roleToPosition = new Map([
					['manager','manager'],
					['general_manager','general_manager'],
					['owner','owner'],
					['server','server'],
					['host','host'],
					['bartender','bartender'],
					['barback','barback'],
					['busser','busser'],
					['chef','chef'],
					['kitchen_prep','kitchen_prep'],
					['kitchen','kitchen'],
					['dishwasher','dishwasher'],
					['security','security']
				]);
				formData.position = roleToPosition.get(u.role) || formData.position || 'server';
			}
		}
	}
	
	// Watch for edit item changes
	$: if (editItem) {
		formData = {
			first_name: editItem.first_name || '',
			last_name: editItem.last_name || '',
			email: editItem.email || '',
			phone: editItem.phone || '',
			position: editItem.position || 'server',
			hourly_rate: editItem.hourly_rate || '',
			hire_date: editItem.hire_date || '',
			status: editItem.status || 'active',
			user_id: editItem.user_id || ''
		};
		selectedUserId = formData.user_id || '';
	} else {
		// Reset form for new staff
		formData = {
			first_name: '',
			last_name: '',
			email: '',
			phone: '',
			position: 'server',
			hourly_rate: '',
			hire_date: '',
			status: 'active',
			user_id: ''
		};
		selectedUserId = '';
	}
	
	async function handleSubmit() {
		error = '';
		isSubmitting = true;
		
		try {
			// Prepare data for submission
			const data = {
				first_name: formData.first_name.trim(),
				last_name: formData.last_name.trim(),
				email: formData.email.trim().toLowerCase(),
				phone: formData.phone.trim(),
				position: formData.position,
				status: formData.status,
				hire_date: formData.hire_date
			};
			
			// Add optional fields if they have values
			if (formData.hourly_rate) {
				data.hourly_rate = Number(formData.hourly_rate);
			}
			if (formData.user_id || selectedUserId) {
				data.user_id = formData.user_id || selectedUserId;
			}
			
			if (editItem) {
				// Update existing staff
				await collections.updateStaff(editItem.id, data);
			} else {
				// Create new staff
				await collections.createStaff(data);
			}
			
			// Refresh staff data
			await collections.getStaff();
			
			// Close modal and reset form
			closeModal();
			dispatch('success');
			
		} catch (err) {
			console.error('Error saving staff member:', err);
			error = err.message || 'Failed to save staff member';
		} finally {
			isSubmitting = false;
		}
	}
	
	function closeModal() {
		isOpen = false;
		error = '';
		editItem = null;
		dispatch('close');
	}
	
	function handleKeyDown(event) {
		if (event.key === 'Escape') {
			closeModal();
		}
	}
	
	// Get today's date in YYYY-MM-DD format for default hire date (in local timezone)
	function getTodayDate() {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-black/50 backdrop-blur-sm" on:click={closeModal}></div>
		
		<!-- Modal -->
		<div class="relative bg-gray-800 rounded-xl border border-gray-700 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
			<!-- Header -->
			<div class="flex items-center justify-between p-6 border-b border-gray-700">
				<h2 class="text-xl font-bold text-white">
					{editItem ? 'Edit' : 'Add'} Staff Member
				</h2>
				<button
					on:click={closeModal}
					class="text-gray-400 hover:text-gray-300 transition-colors"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</button>
			</div>
			
			<!-- Form -->
			<form on:submit|preventDefault={handleSubmit} class="p-6 space-y-6">
				{#if error}
					<div class="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
						{error}
					</div>
				{/if}
				
				<!-- Link to existing user (optional) -->
				<div class="grid grid-cols-1 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2">Link to User (optional)</label>
						<div class="flex flex-col gap-2">
							<div class="flex gap-2">
								<input
									type="text"
									class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Search by name or email"
									bind:value={userQuery}
									on:input={() => loadUsers(true)}
								/>
								<select bind:value={userRoleFilter} on:change={() => loadUsers(true)} class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
									{#each roleOptions as r}
										<option value={r.value}>{r.label}</option>
									{/each}
								</select>
							</div>
							<div class="flex gap-2">
								<select bind:value={selectedUserId} class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
									<option value="">-- Select user to prefill --</option>
									{#if usersLoading}
										<option disabled>Loading users...</option>
									{:else}
										{#each users as u}
											<option value={u.id}>{u.name || '(no name)'} ({u.role || 'no role'}) — {u.email}</option>
										{/each}
									{/if}
								</select>
								{#if usersHasMore}
									<button type="button" class="px-3 py-2 bg-gray-700 text-gray-200 rounded-lg border border-gray-600 hover:bg-gray-600" on:click={() => loadUsers(false)}>Load more</button>
								{/if}
								{#if selectedUserId}
									<button type="button" class="px-3 py-2 bg-gray-700 text-gray-200 rounded-lg border border-gray-600 hover:bg-gray-600" on:click={() => { selectedUserId=''; formData.user_id=''; }}>Clear</button>
								{/if}
							</div>
						</div>
						<p class="text-xs text-gray-400">Selecting a user will prefill name, email, and phone, and link the staff to the user.</p>
					</div>
				</div>

				<!-- Personal Information -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- First Name -->
					<div>
						<label for="first_name" class="block text-sm font-medium text-gray-300 mb-2">
							First Name *
						</label>
						<input
							id="first_name"
							type="text"
							bind:value={formData.first_name}
							required
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Enter first name"
						/>
					</div>
					
					<!-- Last Name -->
					<div>
						<label for="last_name" class="block text-sm font-medium text-gray-300 mb-2">
							Last Name *
						</label>
						<input
							id="last_name"
							type="text"
							bind:value={formData.last_name}
							required
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Enter last name"
						/>
					</div>
					
					<!-- Email -->
					<div>
						<label for="email" class="block text-sm font-medium text-gray-300 mb-2">
							Email *
						</label>
						<input
							id="email"
							type="email"
							bind:value={formData.email}
							required
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Enter email address"
						/>
					</div>
					
					<!-- Phone -->
					<div>
						<label for="phone" class="block text-sm font-medium text-gray-300 mb-2">
							Phone
						</label>
						<input
							id="phone"
							type="tel"
							bind:value={formData.phone}
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Enter phone number"
						/>
					</div>
				</div>
				
				<!-- Employment Information -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Position -->
					<div>
						<label for="position" class="block text-sm font-medium text-gray-300 mb-2">
							Position *
						</label>
						<select
							id="position"
							bind:value={formData.position}
							required
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							{#each positions as position}
								<option value={position.value}>{position.label}</option>
							{/each}
						</select>
					</div>
					
					<!-- Status -->
					<div>
						<label for="status" class="block text-sm font-medium text-gray-300 mb-2">
							Status *
						</label>
						<select
							id="status"
							bind:value={formData.status}
							required
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							{#each statuses as status}
								<option value={status.value}>{status.label}</option>
							{/each}
						</select>
					</div>
					
					<!-- Hourly Rate -->
					<div>
						<label for="hourly_rate" class="block text-sm font-medium text-gray-300 mb-2">
							Hourly Rate ($)
						</label>
						<input
							id="hourly_rate"
							type="number"
							min="0"
							step="0.01"
							bind:value={formData.hourly_rate}
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="0.00"
						/>
					</div>
					
					<!-- Hire Date -->
					<div>
						<label for="hire_date" class="block text-sm font-medium text-gray-300 mb-2">
							Hire Date *
						</label>
						<input
							id="hire_date"
							type="date"
							bind:value={formData.hire_date}
							required
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							max={getTodayDate()}
						/>
					</div>
				</div>
				
				<!-- Additional Information -->
				{#if editItem}
					<div class="grid grid-cols-1 gap-4">
						<!-- User ID (for existing staff only) -->
						<div>
							<label for="user_id" class="block text-sm font-medium text-gray-300 mb-2">
								Linked User Account
							</label>
							<input
								id="user_id"
								type="text"
								bind:value={formData.user_id}
								class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="User ID (leave empty if no account linked)"
							/>
							<p class="text-xs text-gray-400 mt-1">
								Link this staff member to a user account for dashboard access
							</p>
						</div>
					</div>
				{/if}
				
				<!-- Form Actions -->
				<div class="flex justify-end space-x-4 pt-4 border-t border-gray-700">
					<button
						type="button"
						on:click={closeModal}
						class="px-6 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{#if isSubmitting}
							{editItem ? 'Updating...' : 'Creating...'}
						{:else}
							{editItem ? 'Update Staff' : 'Add Staff'}
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
