<script>
	import { createEventDispatcher } from 'svelte';
	import { collections, vendors } from '$lib/stores/collections.js';
	
	export let isOpen = false;
	export let editItem = null; // For editing existing items
	
	const dispatch = createEventDispatcher();
	
	// Form data
	let formData = {
		name: '',
		description: '',
		category: 'food',
		unit: 'piece',
		current_stock: 0,
		min_stock_level: 0,
		max_stock_level: '',
		cost_per_unit: '',
		vendor: '',
		expiry_date: ''
	};
	
	let isSubmitting = false;
	let error = '';
	
	// Category and unit options
	const categories = [
		{ value: 'food', label: 'Food' },
		{ value: 'beverages', label: 'Beverages' },
		{ value: 'supplies', label: 'Supplies' },
		{ value: 'equipment', label: 'Equipment' },
		{ value: 'cleaning', label: 'Cleaning' },
		{ value: 'other', label: 'Other' }
	];
	
	const units = [
		{ value: 'piece', label: 'Piece' },
		{ value: 'kg', label: 'Kilogram (kg)' },
		{ value: 'gram', label: 'Gram (g)' },
		{ value: 'liter', label: 'Liter (L)' },
		{ value: 'ml', label: 'Milliliter (ml)' },
		{ value: 'box', label: 'Box' },
		{ value: 'pack', label: 'Pack' },
		{ value: 'bottle', label: 'Bottle' },
		{ value: 'can', label: 'Can' }
	];
	
	// Watch for edit item changes
	$: if (editItem) {
		formData = {
			name: editItem.name || '',
			description: editItem.description || '',
			category: editItem.category || 'food',
			unit: editItem.unit || 'piece',
			current_stock: editItem.current_stock || 0,
			min_stock_level: editItem.min_stock_level || 0,
			max_stock_level: editItem.max_stock_level || '',
			cost_per_unit: editItem.cost_per_unit || '',
			vendor: editItem.vendor || '',
			expiry_date: editItem.expiry_date || ''
		};
	} else {
		// Reset form for new item
		formData = {
			name: '',
			description: '',
			category: 'food',
			unit: 'piece',
			current_stock: 0,
			min_stock_level: 0,
			max_stock_level: '',
			cost_per_unit: '',
			vendor: '',
			expiry_date: ''
		};
	}
	
	async function handleSubmit() {
		error = '';
		isSubmitting = true;
		
		try {
			// Prepare data for submission
			const data = {
				name: formData.name.trim(),
				description: formData.description.trim(),
				category: formData.category,
				unit: formData.unit,
				current_stock: Number(formData.current_stock),
				min_stock_level: Number(formData.min_stock_level)
			};
			
			// Add optional fields if they have values
			if (formData.max_stock_level) {
				data.max_stock_level = Number(formData.max_stock_level);
			}
			if (formData.cost_per_unit) {
				data.cost_per_unit = Number(formData.cost_per_unit);
			}
			if (formData.vendor) {
				data.vendor = formData.vendor;
			}
			if (formData.expiry_date) {
				data.expiry_date = formData.expiry_date;
			}
			
			if (editItem) {
				// Update existing item
				await collections.updateInventoryItem(editItem.id, data);
			} else {
				// Create new item
				await collections.createInventoryItem(data);
			}
			
			// Refresh inventory data
			await collections.getInventoryItems();
			
			// Close modal and reset form
			closeModal();
			dispatch('success');
			
		} catch (err) {
			console.error('Error saving inventory item:', err);
			error = err.message || 'Failed to save inventory item';
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
					{editItem ? 'Edit' : 'Add'} Inventory Item
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
				
				<!-- Basic Information -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Name -->
					<div class="md:col-span-2">
						<label for="name" class="block text-sm font-medium text-gray-300 mb-2">
							Item Name *
						</label>
						<input
							id="name"
							type="text"
							bind:value={formData.name}
							required
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Enter item name"
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
							rows="3"
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Enter item description"
						></textarea>
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
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							{#each categories as category}
								<option value={category.value}>{category.label}</option>
							{/each}
						</select>
					</div>
					
					<!-- Unit -->
					<div>
						<label for="unit" class="block text-sm font-medium text-gray-300 mb-2">
							Unit *
						</label>
						<select
							id="unit"
							bind:value={formData.unit}
							required
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							{#each units as unit}
								<option value={unit.value}>{unit.label}</option>
							{/each}
						</select>
					</div>
				</div>
				
				<!-- Stock Information -->
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<!-- Current Stock -->
					<div>
						<label for="current_stock" class="block text-sm font-medium text-gray-300 mb-2">
							Current Stock *
						</label>
						<input
							id="current_stock"
							type="number"
							min="0"
							bind:value={formData.current_stock}
							required
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					
					<!-- Min Stock Level -->
					<div>
						<label for="min_stock_level" class="block text-sm font-medium text-gray-300 mb-2">
							Min Stock Level *
						</label>
						<input
							id="min_stock_level"
							type="number"
							min="0"
							bind:value={formData.min_stock_level}
							required
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					
					<!-- Max Stock Level -->
					<div>
						<label for="max_stock_level" class="block text-sm font-medium text-gray-300 mb-2">
							Max Stock Level
						</label>
						<input
							id="max_stock_level"
							type="number"
							min="0"
							bind:value={formData.max_stock_level}
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>
				
				<!-- Additional Information -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Cost per Unit -->
					<div>
						<label for="cost_per_unit" class="block text-sm font-medium text-gray-300 mb-2">
							Cost per Unit ($)
						</label>
						<input
							id="cost_per_unit"
							type="number"
							min="0"
							step="0.01"
							bind:value={formData.cost_per_unit}
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="0.00"
						/>
					</div>
					
					<!-- Vendor -->
					<div>
						<label for="vendor" class="block text-sm font-medium text-gray-300 mb-2">
							Vendor
						</label>
						<select
							id="vendor"
							bind:value={formData.vendor}
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">Select vendor...</option>
							{#each $vendors as vendor}
								<option value={vendor.id}>{vendor.name}</option>
							{/each}
						</select>
					</div>
					
					<!-- Expiry Date -->
					<div class="md:col-span-2">
						<label for="expiry_date" class="block text-sm font-medium text-gray-300 mb-2">
							Expiry Date
						</label>
						<input
							id="expiry_date"
							type="date"
							bind:value={formData.expiry_date}
							class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
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
							{editItem ? 'Updating...' : 'Creating...'}
						{:else}
							{editItem ? 'Update Item' : 'Create Item'}
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
