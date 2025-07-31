<script>
	import { createEventDispatcher } from 'svelte';
	import { collections, staff } from '$lib/stores/collections.js';
	
	export let isOpen = false;
	export let editItem = null; // For editing existing shifts
	
	const dispatch = createEventDispatcher();
	
	// Form data
	let formData = {
		staff_member: '',
		shift_date: '',
		start_time: '',
		end_time: '',
		break_duration: 30,
		position: 'server',
		status: 'scheduled',
		notes: ''
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
		{ value: 'scheduled', label: 'Scheduled' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' },
		{ value: 'no_show', label: 'No Show' }
	];
	
	// Watch for edit item changes
	$: if (editItem) {
		formData = {
			staff_member: editItem.staff_member || '',
			shift_date: editItem.shift_date || '',
			start_time: editItem.start_time || '',
			end_time: editItem.end_time || '',
			break_duration: editItem.break_duration || 30,
			position: editItem.position || 'server',
			status: editItem.status || 'scheduled',
			notes: editItem.notes || ''
		};
	} else {
		// Reset form for new shift
		formData = {
			staff_member: '',
			shift_date: '',
			start_time: '',
			end_time: '',
			break_duration: 30,
			position: 'server',
			status: 'scheduled',
			notes: ''
		};
	}
	
	async function handleSubmit() {
		error = '';
		isSubmitting = true;
		
		try {
			// Validate time logic
			if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
				throw new Error('End time must be after start time');
			}
			
			// Prepare data for submission
			const data = {
				shift_date: formData.shift_date,
				start_time: formData.start_time,
				end_time: formData.end_time,
				break_duration: Number(formData.break_duration),
				position: formData.position,
				status: formData.status,
				notes: formData.notes.trim()
			};
			
			// Add staff member if selected
			if (formData.staff_member) {
				data.staff_member = formData.staff_member;
			}
			
			if (editItem) {
				// Update existing shift
				await collections.updateShift(editItem.id, data);
			} else {
				// Create new shift
				await collections.createShift(data);
			}
			
			// Refresh shifts data
			await collections.getShifts();
			
			// Close modal and reset form
			closeModal();
			dispatch('success');
			
		} catch (err) {
			console.error('Error saving shift:', err);
			error = err.message || 'Failed to save shift';
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
	
	// Get today's date in YYYY-MM-DD format for default shift date
	function getTodayDate() {
		return new Date().toISOString().split('T')[0];
	}
	
	// Calculate shift duration in hours
	function calculateDuration() {
		if (!formData.start_time || !formData.end_time) return '';
		
		const start = new Date(`1970-01-01T${formData.start_time}:00`);
		let end = new Date(`1970-01-01T${formData.end_time}:00`);
		
		// Handle overnight shifts
		if (end <= start) {
			end.setDate(end.getDate() + 1);
		}
		
		const diffMs = end - start;
		const diffHours = diffMs / (1000 * 60 * 60);
		const breakHours = (formData.break_duration || 0) / 60;
		const workHours = diffHours - breakHours;
		
		return workHours > 0 ? `${workHours.toFixed(1)} hours` : '';
	}
	
	// Filter active staff members
	$: activeStaff = $staff.filter(member => member.status === 'active');
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
					{editItem ? 'Edit' : 'Schedule'} Shift
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
				
				<!-- Staff and Date -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Staff Member -->
					<div>
						<label for="staff_member" class="block text-sm font-medium text-gray-300 mb-2">
							Staff Member
						</label>
						<select
							id="staff_member"
							bind:value={formData.staff_member}
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">Unassigned</option>
							{#each activeStaff as member}
								<option value={member.id}>
									{member.first_name} {member.last_name} ({member.position})
								</option>
							{/each}
						</select>
						<p class="text-xs text-gray-400 mt-1">Leave unassigned to create an open shift</p>
					</div>
					
					<!-- Shift Date -->
					<div>
						<label for="shift_date" class="block text-sm font-medium text-gray-300 mb-2">
							Shift Date *
						</label>
						<input
							id="shift_date"
							type="date"
							bind:value={formData.shift_date}
							required
							min={getTodayDate()}
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>
				
				<!-- Time Information -->
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<!-- Start Time -->
					<div>
						<label for="start_time" class="block text-sm font-medium text-gray-300 mb-2">
							Start Time *
						</label>
						<input
							id="start_time"
							type="time"
							bind:value={formData.start_time}
							required
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					
					<!-- End Time -->
					<div>
						<label for="end_time" class="block text-sm font-medium text-gray-300 mb-2">
							End Time *
						</label>
						<input
							id="end_time"
							type="time"
							bind:value={formData.end_time}
							required
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					
					<!-- Break Duration -->
					<div>
						<label for="break_duration" class="block text-sm font-medium text-gray-300 mb-2">
							Break (minutes)
						</label>
						<input
							id="break_duration"
							type="number"
							min="0"
							max="480"
							bind:value={formData.break_duration}
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>
				
				<!-- Duration Display -->
				{#if calculateDuration()}
					<div class="p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
						<p class="text-blue-300 text-sm">
							<strong>Shift Duration:</strong> {calculateDuration()}
						</p>
					</div>
				{/if}
				
				<!-- Position and Status -->
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
						<p class="text-xs text-gray-400 mt-1">Position can differ from staff member's base role</p>
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
				</div>
				
				<!-- Notes -->
				<div>
					<label for="notes" class="block text-sm font-medium text-gray-300 mb-2">
						Notes
					</label>
					<textarea
						id="notes"
						bind:value={formData.notes}
						rows="3"
						class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="Any special instructions or notes for this shift..."
					></textarea>
				</div>
				
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
							{editItem ? 'Updating...' : 'Scheduling...'}
						{:else}
							{editItem ? 'Update Shift' : 'Schedule Shift'}
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
