<script>
	import { createEventDispatcher } from 'svelte';
	import { collections } from '$lib/stores/collections.js';
	
	export let isOpen = false;
	export let editItem = null; // For editing existing items
	
	const dispatch = createEventDispatcher();
	
	// Form data
	let formData = {
		name: '',
		contact_person: '',
		email: '',
		phone: '',
		address: '',
		category: 'food_supplier',
		payment_terms: '',
		status: 'active',
		notes: ''
	};
	
	let isSubmitting = false;
	let error = '';
	
	// Category options
	const categories = [
		{ value: 'food_supplier', label: 'Food Supplier' },
		{ value: 'beverage_supplier', label: 'Beverage Supplier' },
		{ value: 'equipment', label: 'Equipment' },
		{ value: 'cleaning_supplies', label: 'Cleaning Supplies' },
		{ value: 'linen_service', label: 'Linen Service' },
		{ value: 'maintenance', label: 'Maintenance' },
		{ value: 'other', label: 'Other' }
	];
	
	// Status options
	const statusOptions = [
		{ value: 'active', label: 'Active' },
		{ value: 'inactive', label: 'Inactive' },
		{ value: 'pending', label: 'Pending' }
	];
	
	// Watch for edit item changes
	$: if (editItem) {
		formData = {
			name: editItem.name || '',
			contact_person: editItem.contact_person || '',
			email: editItem.email || '',
			phone: editItem.phone || '',
			address: editItem.address || '',
			category: editItem.category || 'food_supplier',
			payment_terms: editItem.payment_terms || '',
			status: editItem.status || 'active',
			notes: editItem.notes || ''
		};
	} else {
		resetForm();
	}
	
	function resetForm() {
		formData = {
			name: '',
			contact_person: '',
			email: '',
			phone: '',
			address: '',
			category: 'food_supplier',
			payment_terms: '',
			status: 'active',
			notes: ''
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
			error = 'Vendor name is required';
			return;
		}
		
		if (formData.email && !isValidEmail(formData.email)) {
			error = 'Please enter a valid email address';
			return;
		}
		
		isSubmitting = true;
		error = '';
		
		try {
			const submitData = {
				name: formData.name.trim(),
				contact_person: formData.contact_person.trim(),
				email: formData.email.trim(),
				phone: formData.phone.trim(),
				address: formData.address.trim(),
				category: formData.category,
				payment_terms: formData.payment_terms.trim(),
				status: formData.status,
				notes: formData.notes.trim()
			};
			
			if (editItem) {
				await collections.updateVendor(editItem.id, submitData);
			} else {
				await collections.createVendor(submitData);
			}
			
			// Refresh vendors data
			await collections.getVendors();
			
			dispatch('success');
			closeModal();
		} catch (err) {
			console.error('Error saving vendor:', err);
			error = 'Failed to save vendor. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}
	
	function isValidEmail(email) {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" on:click={handleBackdropClick} role="dialog" aria-modal="true">
		<div class="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
			<!-- Header -->
			<div class="px-6 py-4 border-b border-gray-700">
				<h2 class="text-xl font-bold text-white">
					{editItem ? 'Edit Vendor' : 'Add New Vendor'}
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
					<!-- Vendor Name -->
					<div class="md:col-span-2">
						<label for="name" class="block text-sm font-medium text-gray-300 mb-2">
							Vendor Name *
						</label>
						<input
							type="text"
							id="name"
							bind:value={formData.name}
							required
							maxlength="200"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Enter vendor/company name"
						/>
					</div>
					
					<!-- Contact Person -->
					<div>
						<label for="contact_person" class="block text-sm font-medium text-gray-300 mb-2">
							Contact Person
						</label>
						<input
							type="text"
							id="contact_person"
							bind:value={formData.contact_person}
							maxlength="100"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Primary contact name"
						/>
					</div>
					
					<!-- Email -->
					<div>
						<label for="email" class="block text-sm font-medium text-gray-300 mb-2">
							Email
						</label>
						<input
							type="email"
							id="email"
							bind:value={formData.email}
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="contact@vendor.com"
						/>
					</div>
					
					<!-- Phone -->
					<div>
						<label for="phone" class="block text-sm font-medium text-gray-300 mb-2">
							Phone
						</label>
						<input
							type="tel"
							id="phone"
							bind:value={formData.phone}
							maxlength="20"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="(555) 123-4567"
						/>
					</div>
					
					<!-- Category -->
					<div>
						<label for="category" class="block text-sm font-medium text-gray-300 mb-2">
							Category *
						</label>
						<select
							id="category"
							bind:value={formData.category}
							required
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							{#each categories as category}
								<option value={category.value}>{category.label}</option>
							{/each}
						</select>
					</div>
					
					<!-- Address -->
					<div class="md:col-span-2">
						<label for="address" class="block text-sm font-medium text-gray-300 mb-2">
							Address
						</label>
						<textarea
							id="address"
							bind:value={formData.address}
							maxlength="300"
							rows="2"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
							placeholder="Business address"
						></textarea>
					</div>
					
					<!-- Payment Terms -->
					<div>
						<label for="payment_terms" class="block text-sm font-medium text-gray-300 mb-2">
							Payment Terms
						</label>
						<input
							type="text"
							id="payment_terms"
							bind:value={formData.payment_terms}
							maxlength="100"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="e.g., Net 30, COD, Weekly"
						/>
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
					
					<!-- Notes -->
					<div class="md:col-span-2">
						<label for="notes" class="block text-sm font-medium text-gray-300 mb-2">
							Notes
						</label>
						<textarea
							id="notes"
							bind:value={formData.notes}
							maxlength="500"
							rows="3"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
							placeholder="Additional notes about the vendor..."
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
						<span>{editItem ? 'Update' : 'Create'} Vendor</span>
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
