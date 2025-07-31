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
		category: 'main_course',
		price: 0,
		cost: '',
		ingredients: '',
		allergens: [],
		preparation_time: '',
		available: true,
		image: null
	};
	
	let isSubmitting = false;
	let error = '';
	
	// Category options
	const categories = [
		{ value: 'appetizer', label: 'Appetizer' },
		{ value: 'main_course', label: 'Main Course' },
		{ value: 'dessert', label: 'Dessert' },
		{ value: 'beverage', label: 'Beverage' },
		{ value: 'special', label: 'Special' },
		{ value: 'side_dish', label: 'Side Dish' }
	];
	
	// Allergen options
	const allergenOptions = [
		{ value: 'gluten', label: 'Gluten' },
		{ value: 'dairy', label: 'Dairy' },
		{ value: 'nuts', label: 'Nuts' },
		{ value: 'shellfish', label: 'Shellfish' },
		{ value: 'eggs', label: 'Eggs' },
		{ value: 'soy', label: 'Soy' },
		{ value: 'fish', label: 'Fish' },
		{ value: 'sesame', label: 'Sesame' }
	];
	
	// Watch for edit item changes
	$: if (editItem) {
		formData = {
			name: editItem.name || '',
			description: editItem.description || '',
			category: editItem.category || 'main_course',
			price: editItem.price || 0,
			cost: editItem.cost || '',
			ingredients: editItem.ingredients || '',
			allergens: editItem.allergens || [],
			preparation_time: editItem.preparation_time || '',
			available: editItem.available !== undefined ? editItem.available : true,
			image: null
		};
	} else {
		resetForm();
	}
	
	function resetForm() {
		formData = {
			name: '',
			description: '',
			category: 'main_course',
			price: 0,
			cost: '',
			ingredients: '',
			allergens: [],
			preparation_time: '',
			available: true,
			image: null
		};
		error = '';
	}
	
	function handleAllergenChange(allergen) {
		if (formData.allergens.includes(allergen)) {
			formData.allergens = formData.allergens.filter(a => a !== allergen);
		} else {
			formData.allergens = [...formData.allergens, allergen];
		}
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
			error = 'Item name is required';
			return;
		}
		
		if (formData.price <= 0) {
			error = 'Price must be greater than 0';
			return;
		}
		
		isSubmitting = true;
		error = '';
		
		try {
			const submitData = {
				name: formData.name.trim(),
				description: formData.description.trim(),
				category: formData.category,
				price: parseFloat(formData.price),
				cost: formData.cost ? parseFloat(formData.cost) : null,
				ingredients: formData.ingredients.trim(),
				allergens: formData.allergens,
				preparation_time: formData.preparation_time ? parseInt(formData.preparation_time) : null,
				available: formData.available
			};
			
			if (editItem) {
				await collections.updateMenuItem(editItem.id, submitData);
			} else {
				await collections.createMenuItem(submitData);
			}
			
			// Refresh menu items data
			await collections.getMenuItems();
			
			dispatch('success');
			closeModal();
		} catch (err) {
			console.error('Error saving menu item:', err);
			error = 'Failed to save menu item. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" on:click={handleBackdropClick} role="dialog" aria-modal="true">
		<div class="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
			<!-- Header -->
			<div class="px-6 py-4 border-b border-gray-700">
				<h2 class="text-xl font-bold text-white">
					{editItem ? 'Edit Menu Item' : 'Add New Menu Item'}
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
					<!-- Item Name -->
					<div class="md:col-span-2">
						<label for="name" class="block text-sm font-medium text-gray-300 mb-2">
							Item Name *
						</label>
						<input
							type="text"
							id="name"
							bind:value={formData.name}
							required
							maxlength="200"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
							maxlength="500"
							rows="3"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
							placeholder="Brief description of the item"
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
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							{#each categories as category}
								<option value={category.value}>{category.label}</option>
							{/each}
						</select>
					</div>
					
					<!-- Price -->
					<div>
						<label for="price" class="block text-sm font-medium text-gray-300 mb-2">
							Price ($) *
						</label>
						<input
							type="number"
							id="price"
							bind:value={formData.price}
							required
							min="0"
							step="0.01"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="0.00"
						/>
					</div>
					
					<!-- Cost -->
					<div>
						<label for="cost" class="block text-sm font-medium text-gray-300 mb-2">
							Cost ($)
						</label>
						<input
							type="number"
							id="cost"
							bind:value={formData.cost}
							min="0"
							step="0.01"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="0.00"
						/>
					</div>
					
					<!-- Preparation Time -->
					<div>
						<label for="prep_time" class="block text-sm font-medium text-gray-300 mb-2">
							Prep Time (minutes)
						</label>
						<input
							type="number"
							id="prep_time"
							bind:value={formData.preparation_time}
							min="0"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="15"
						/>
					</div>
					
					<!-- Ingredients -->
					<div class="md:col-span-2">
						<label for="ingredients" class="block text-sm font-medium text-gray-300 mb-2">
							Ingredients
						</label>
						<textarea
							id="ingredients"
							bind:value={formData.ingredients}
							maxlength="1000"
							rows="3"
							class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
							placeholder="List main ingredients..."
						></textarea>
					</div>
					
					<!-- Allergens -->
					<div class="md:col-span-2">
						<label class="block text-sm font-medium text-gray-300 mb-3">
							Allergens
						</label>
						<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
							{#each allergenOptions as allergen}
								<label class="flex items-center space-x-2 cursor-pointer">
									<input
										type="checkbox"
										checked={formData.allergens.includes(allergen.value)}
										on:change={() => handleAllergenChange(allergen.value)}
										class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
									/>
									<span class="text-sm text-gray-300">{allergen.label}</span>
								</label>
							{/each}
						</div>
					</div>
					
					<!-- Available -->
					<div class="md:col-span-2">
						<label class="flex items-center space-x-3 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={formData.available}
								class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
							/>
							<span class="text-sm font-medium text-gray-300">Item is available</span>
						</label>
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
						<span>{editItem ? 'Update' : 'Create'} Item</span>
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
