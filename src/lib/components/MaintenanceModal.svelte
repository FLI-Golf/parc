<script>
	import { collections } from '$lib/stores/collections.js';
	import { createEventDispatcher } from 'svelte';

	export let show = false;
	export let editItem = null;

	const dispatch = createEventDispatcher();

	// Form data
	let formData = {
		task_name: '',
		description: '',
		category: '',
		frequency: '',
		priority: '',
		estimated_duration: '',
		status: 'active'
	};

	// Reset form when modal opens/closes
	$: if (show) {
		if (editItem) {
			formData = { ...editItem };
		} else {
			formData = {
				task_name: '',
				description: '',
				category: '',
				frequency: '',
				priority: '',
				estimated_duration: '',
				status: 'active'
			};
		}
	}

	async function handleSubmit() {
		try {
			if (editItem) {
				await collections.updateMaintenanceTask(editItem.id, formData);
			} else {
				await collections.createMaintenanceTask(formData);
			}
			await collections.getMaintenanceTasks(); // Refresh data
			dispatch('close');
		} catch (error) {
			console.error('Error saving maintenance task:', error);
			alert('Failed to save maintenance task');
		}
	}

	function handleClose() {
		dispatch('close');
	}

	// Categories for maintenance tasks
	const categories = [
		{ value: 'kitchen', label: 'Kitchen' },
		{ value: 'equipment', label: 'Equipment' },
		{ value: 'cleaning', label: 'Cleaning' },
		{ value: 'safety', label: 'Safety' },
		{ value: 'hvac', label: 'HVAC' },
		{ value: 'plumbing', label: 'Plumbing' },
		{ value: 'electrical', label: 'Electrical' },
		{ value: 'pest_control', label: 'Pest Control' },
		{ value: 'fire_safety', label: 'Fire Safety' },
		{ value: 'general', label: 'General' }
	];

	const frequencies = [
		{ value: 'daily', label: 'Daily' },
		{ value: 'weekly', label: 'Weekly' },
		{ value: 'bi_weekly', label: 'Bi-Weekly' },
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'quarterly', label: 'Quarterly' },
		{ value: 'bi_annually', label: 'Bi-Annually' },
		{ value: 'yearly', label: 'Yearly' },
		{ value: 'as_needed', label: 'As Needed' }
	];

	const priorities = [
		{ value: 'low', label: 'Low' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'high', label: 'High' },
		{ value: 'critical', label: 'Critical' }
	];

	const statuses = [
		{ value: 'active', label: 'Active' },
		{ value: 'inactive', label: 'Inactive' },
		{ value: 'suspended', label: 'Suspended' }
	];
</script>

{#if show}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
		<div class="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
			<!-- Header -->
			<div class="p-6 border-b border-gray-700">
				<h2 class="text-2xl font-bold">
					{editItem ? 'Edit Maintenance Task' : 'Schedule New Maintenance Task'}
				</h2>
				<p class="text-gray-400 mt-1">
					{editItem ? 'Update existing task' : 'Create a new maintenance or cleaning task'}
				</p>
			</div>

			<!-- Form -->
			<form on:submit|preventDefault={handleSubmit} class="p-6">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<!-- Task Name -->
					<div class="md:col-span-2">
						<label for="task_name" class="block text-sm font-medium mb-2">
							Task Name <span class="text-red-400">*</span>
						</label>
						<input
							id="task_name"
							type="text"
							bind:value={formData.task_name}
							required
							class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
							placeholder="e.g., Deep clean kitchen equipment"
						/>
					</div>

					<!-- Description -->
					<div class="md:col-span-2">
						<label for="description" class="block text-sm font-medium mb-2">
							Description
						</label>
						<textarea
							id="description"
							bind:value={formData.description}
							rows="3"
							class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
							placeholder="Detailed description of the maintenance task..."
						></textarea>
					</div>

					<!-- Category -->
					<div>
						<label for="category" class="block text-sm font-medium mb-2">
							Category <span class="text-red-400">*</span>
						</label>
						<select
							id="category"
							bind:value={formData.category}
							required
							class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
						>
							<option value="">Select a category</option>
							{#each categories as category}
								<option value={category.value}>{category.label}</option>
							{/each}
						</select>
					</div>

					<!-- Frequency -->
					<div>
						<label for="frequency" class="block text-sm font-medium mb-2">
							Frequency <span class="text-red-400">*</span>
						</label>
						<select
							id="frequency"
							bind:value={formData.frequency}
							required
							class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
						>
							<option value="">Select frequency</option>
							{#each frequencies as frequency}
								<option value={frequency.value}>{frequency.label}</option>
							{/each}
						</select>
					</div>

					<!-- Priority -->
					<div>
						<label for="priority" class="block text-sm font-medium mb-2">
							Priority <span class="text-red-400">*</span>
						</label>
						<select
							id="priority"
							bind:value={formData.priority}
							required
							class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
						>
							<option value="">Select priority</option>
							{#each priorities as priority}
								<option value={priority.value}>{priority.label}</option>
							{/each}
						</select>
					</div>

					<!-- Estimated Duration -->
					<div>
						<label for="estimated_duration" class="block text-sm font-medium mb-2">
							Estimated Duration (minutes)
						</label>
						<input
							id="estimated_duration"
							type="number"
							bind:value={formData.estimated_duration}
							min="0"
							class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
							placeholder="e.g., 30"
						/>
					</div>

					<!-- Status -->
					<div class="md:col-span-2">
						<label for="status" class="block text-sm font-medium mb-2">
							Status <span class="text-red-400">*</span>
						</label>
						<select
							id="status"
							bind:value={formData.status}
							required
							class="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
						>
							{#each statuses as status}
								<option value={status.value}>{status.label}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Actions -->
				<div class="flex justify-end space-x-3 mt-8">
					<button
						type="button"
						on:click={handleClose}
						class="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
					>
						{editItem ? 'Update Task' : 'Schedule Task'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
