<script>
	import { createEventDispatcher } from 'svelte';
	import { collections } from '$lib/stores/collections.js';
	
	export let isOpen = false;
	export let editItem = null; // For editing existing items
	
	const dispatch = createEventDispatcher();
	
	// Form data
	let formData = {
		name: '',
		description: '',
		event_type: 'private_party',
		event_date: '',
		start_time: '',
		end_time: '',
		guest_count: '',
		contact_name: '',
		contact_email: '',
		contact_phone: '',
		special_requirements: '',
		estimated_revenue: '',
		status: 'inquiry'
	};
	
	let isSubmitting = false;
	let error = '';
	
	// Event type options
	const eventTypes = [
		{ value: 'private_party', label: 'Private Party' },
		{ value: 'corporate_event', label: 'Corporate Event' },
		{ value: 'wedding', label: 'Wedding' },
		{ value: 'birthday', label: 'Birthday' },
		{ value: 'anniversary', label: 'Anniversary' },
		{ value: 'holiday_special', label: 'Holiday Special' },
		{ value: 'live_music', label: 'Live Music' },
		{ value: 'other', label: 'Other' }
	];
	
	// Status options
	const statusOptions = [
		{ value: 'inquiry', label: 'Inquiry' },
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'cancelled', label: 'Cancelled' },
		{ value: 'completed', label: 'Completed' }
	];
	
	// Watch for edit item changes
	$: if (editItem) {
		formData = {
			name: editItem.name || '',
			description: editItem.description || '',
			event_type: editItem.event_type || 'private_party',
			event_date: editItem.event_date || '',
			start_time: editItem.start_time || '',
			end_time: editItem.end_time || '',
			guest_count: editItem.guest_count || '',
			contact_name: editItem.contact_name || '',
			contact_email: editItem.contact_email || '',
			contact_phone: editItem.contact_phone || '',
			special_requirements: editItem.special_requirements || '',
			estimated_revenue: editItem.estimated_revenue || '',
			status: editItem.status || 'inquiry'
		};
	} else {
		resetForm();
	}
	
	function resetForm() {
		formData = {
			name: '',
			description: '',
			event_type: 'private_party',
			event_date: '',
			start_time: '',
			end_time: '',
			guest_count: '',
			contact_name: '',
			contact_email: '',
			contact_phone: '',
			special_requirements: '',
			estimated_revenue: '',
			status: 'inquiry'
		};
		error = '';
	}
	
	function closeModal() {
		isOpen = false;
		resetForm();
		dispatch('close');
	}
	
	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}
	
	async function handleSubmit() {
		if (!formData.name.trim()) {
			error = 'Event name is required';
			return;
		}
		
		if (!formData.event_date) {
			error = 'Event date is required';
			return;
		}
		
		if (!formData.start_time) {
			error = 'Start time is required';
			return;
		}
		
		if (!formData.end_time) {
			error = 'End time is required';
			return;
		}
		
		if (!isValidTime(formData.start_time)) {
			error = 'Start time must be in HH:MM format';
			return;
		}
		
		if (!isValidTime(formData.end_time)) {
			error = 'End time must be in HH:MM format';
			return;
		}
		
		if (formData.contact_email && !isValidEmail(formData.contact_email)) {
			error = 'Please enter a valid email address';
			return;
		}
		
		isSubmitting = true;
		error = '';
		
		try {
			const submitData = {
				name: formData.name.trim(),
				description: formData.description.trim(),
				event_type: formData.event_type,
				event_date: formData.event_date,
				start_time: formData.start_time,
				end_time: formData.end_time,
				guest_count: formData.guest_count ? parseInt(formData.guest_count) : null,
				contact_name: formData.contact_name.trim(),
				contact_email: formData.contact_email.trim(),
				contact_phone: formData.contact_phone.trim(),
				special_requirements: formData.special_requirements.trim(),
				estimated_revenue: formData.estimated_revenue ? parseFloat(formData.estimated_revenue) : null,
				status: formData.status
			};
			
			if (editItem) {
				await collections.updateEvent(editItem.id, submitData);
			} else {
				await collections.createEvent(submitData);
			}
			
			// Refresh events data
			await collections.getEvents();
			
			dispatch('success');
			closeModal();
		} catch (err) {
			console.error('Error saving event:', err);
			error = 'Failed to save event. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}
	
	function isValidEmail(email) {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}
	
	function isValidTime(time) {
		const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
		return timeRegex.test(time);
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" on:click={handleBackdropClick} role="dialog" aria-modal="true">
		<div class="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
			<!-- Header -->
			<div class="px-6 py-4 border-b border-gray-700">
				<h2 class="text-xl font-bold text-white">
					{editItem ? 'Edit Event' : 'Add New Event'}
				</h2>
			</div>
			
			<!-- Form -->
			<form on:submit|preventDefault={handleSubmit} class="p-6 space-y-6">
				{#if error}
					<div class="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
						{error}
					</div>
				{/if}
				
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<!-- Event Name -->
					<div class="md:col-span-2">
						<label for="name" class="block text-sm font-medium text-gray-300 mb-2">
							Event Name *
						</label>
						<input
							type="text"
							id="name"
							bind:value={formData.name}
							required
							maxlength="200"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Enter event name"
						/>
					</div>
					
					<!-- Description -->
					<div class="md:col-span-2">
						<label for="description" class="block text-sm font-medium text-gray-300 mb-2">
							Description
						</label>
						<textarea
							id="description"
							bind:value={formData.description}
							maxlength="1000"
							rows="3"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
							placeholder="Event description and details"
						></textarea>
					</div>
					
					<!-- Event Type -->
					<div>
						<label for="event_type" class="block text-sm font-medium text-gray-300 mb-2">
							Event Type *
						</label>
						<select
							id="event_type"
							bind:value={formData.event_type}
							required
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							{#each eventTypes as type}
								<option value={type.value}>{type.label}</option>
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
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							{#each statusOptions as status}
								<option value={status.value}>{status.label}</option>
							{/each}
						</select>
					</div>
					
					<!-- Event Date -->
					<div>
						<label for="event_date" class="block text-sm font-medium text-gray-300 mb-2">
							Event Date *
						</label>
						<input
							type="date"
							id="event_date"
							bind:value={formData.event_date}
							required
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>
					
					<!-- Guest Count -->
					<div>
						<label for="guest_count" class="block text-sm font-medium text-gray-300 mb-2">
							Guest Count
						</label>
						<input
							type="number"
							id="guest_count"
							bind:value={formData.guest_count}
							min="0"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Number of guests"
						/>
					</div>
					
					<!-- Start Time -->
					<div>
						<label for="start_time" class="block text-sm font-medium text-gray-300 mb-2">
							Start Time * <span class="text-xs text-gray-400">(HH:MM)</span>
						</label>
						<input
							type="time"
							id="start_time"
							bind:value={formData.start_time}
							required
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>
					
					<!-- End Time -->
					<div>
						<label for="end_time" class="block text-sm font-medium text-gray-300 mb-2">
							End Time * <span class="text-xs text-gray-400">(HH:MM)</span>
						</label>
						<input
							type="time"
							id="end_time"
							bind:value={formData.end_time}
							required
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>
					
					<!-- Contact Name -->
					<div>
						<label for="contact_name" class="block text-sm font-medium text-gray-300 mb-2">
							Contact Name
						</label>
						<input
							type="text"
							id="contact_name"
							bind:value={formData.contact_name}
							maxlength="100"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Contact person name"
						/>
					</div>
					
					<!-- Contact Email -->
					<div>
						<label for="contact_email" class="block text-sm font-medium text-gray-300 mb-2">
							Contact Email
						</label>
						<input
							type="email"
							id="contact_email"
							bind:value={formData.contact_email}
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="contact@email.com"
						/>
					</div>
					
					<!-- Contact Phone -->
					<div>
						<label for="contact_phone" class="block text-sm font-medium text-gray-300 mb-2">
							Contact Phone
						</label>
						<input
							type="tel"
							id="contact_phone"
							bind:value={formData.contact_phone}
							maxlength="20"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="(555) 123-4567"
						/>
					</div>
					
					<!-- Estimated Revenue -->
					<div>
						<label for="estimated_revenue" class="block text-sm font-medium text-gray-300 mb-2">
							Estimated Revenue ($)
						</label>
						<input
							type="number"
							id="estimated_revenue"
							bind:value={formData.estimated_revenue}
							min="0"
							step="0.01"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="0.00"
						/>
					</div>
					
					<!-- Special Requirements -->
					<div class="md:col-span-2">
						<label for="special_requirements" class="block text-sm font-medium text-gray-300 mb-2">
							Special Requirements
						</label>
						<textarea
							id="special_requirements"
							bind:value={formData.special_requirements}
							maxlength="500"
							rows="3"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
							placeholder="Special requirements, dietary restrictions, equipment needs, etc."
						></textarea>
					</div>
				</div>
				
				<!-- Form Actions -->
				<div class="flex justify-end space-x-4 pt-6 border-t border-gray-700">
					<button
						type="button"
						on:click={closeModal}
						class="px-4 py-2 text-gray-400 hover:text-gray-300 font-medium transition-colors"
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
					>
						{#if isSubmitting}
							<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
						{/if}
						<span>{editItem ? 'Update' : 'Create'} Event</span>
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
