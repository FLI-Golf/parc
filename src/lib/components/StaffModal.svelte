<script>
	import { createEventDispatcher } from 'svelte';
	import { collections } from '$lib/stores/collections.js';
	
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
	
	let isSubmitting = false;
	let error = '';
	
	// Position options (restaurant roles)
	const positions = [
		{ value: 'owner', label: 'Owner' },
		{ value: 'manager', label: 'Manager' },
		{ value: 'server', label: 'Server' },
		{ value: 'host', label: 'Host' },
		{ value: 'bartender', label: 'Bartender' },
		{ value: 'busser', label: 'Busser' },
		{ value: 'chef', label: 'Chef' },
		{ value: 'kitchen_prep', label: 'Kitchen Prep' },
		{ value: 'dishwasher', label: 'Dishwasher' }
	];
	
	// Status options
	const statuses = [
		{ value: 'active', label: 'Active' },
		{ value: 'inactive', label: 'Inactive' },
		{ value: 'terminated', label: 'Terminated' }
	];
	
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
			if (formData.user_id) {
				data.user_id = formData.user_id;
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
	
	// Get today's date in YYYY-MM-DD format for default hire date
	function getTodayDate() {
		return new Date().toISOString().split('T')[0];
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
