<script>
	import { createEventDispatcher } from 'svelte';
	import { collections, events } from '$lib/stores/collections.js';
	import pb from '$lib/pocketbase.js';

	export let isOpen = false;

	const dispatch = createEventDispatcher();
	
	let selectedCollection = '';
	let csvFile = null;
	let csvData = '';
	let importMethod = 'upload'; // 'upload' or 'paste'
	let isImporting = false;
	let importStatus = '';
	let importResults = null;

	const collectionOptions = [
		{ id: 'inventory_collection', name: 'Inventory Items', sampleFile: '/sample-data/inventory_items.csv' },
		{ id: 'staff_collection', name: 'Staff', sampleFile: '/sample-data/staff.csv' },
		{ id: 'menu_collection', name: 'Menu Items', sampleFile: '/sample-data/menu_items.csv' },
		{ id: 'vendors_collection', name: 'Vendors', sampleFile: '/sample-data/vendors.csv' },
		{ id: 'events_collection', name: 'Events', sampleFile: '/sample-data/events.csv' },
		{ id: 'shifts_collection', name: 'Shifts', sampleFile: '/sample-data/shifts.csv' },
		{ id: 'maintenance_tasks', name: 'Maintenance Tasks', sampleFile: '/sample-data/maintenance_tasks.csv' },
		{ id: 'maintenance_schedules', name: 'Maintenance Schedules', sampleFile: '/sample-data/maintenance_schedules.csv' },
		{ id: 'maintenance_records', name: 'Maintenance Records', sampleFile: '/sample-data/maintenance_records.csv' }
	];

	function close() {
		isOpen = false;
		dispatch('close');
		reset();
	}

	function reset() {
		selectedCollection = '';
		csvFile = null;
		csvData = '';
		importMethod = 'upload';
		isImporting = false;
		importStatus = '';
		importResults = null;
	}

	function handleFileChange(event) {
		csvFile = event.target.files[0];
	}

	function downloadSample() {
		const collection = collectionOptions.find(c => c.id === selectedCollection);
		if (collection) {
			window.open(collection.sampleFile, '_blank');
		}
	}

	async function parseCSV(text) {
		const lines = text.split('\n').filter(line => line.trim());
		if (lines.length < 2) throw new Error('CSV must have header and at least one data row');
		
		const headers = lines[0].split(',').map(h => h.trim());
		const data = [];
		
		for (let i = 1; i < lines.length; i++) {
			const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
			if (values.length === headers.length) {
				const row = {};
				headers.forEach((header, index) => {
					let value = values[index];
					
					// Handle different data types
					if (value === 'true') value = true;
					else if (value === 'false') value = false;
					else if (value === '') value = null;
					else if (!isNaN(value) && value !== '') value = parseFloat(value);
					
					row[header] = value;
				});
				data.push(row);
			}
		}
		
		return data;
	}

	async function processInventoryData(data) {
		const results = { success: 0, errors: [] };
		
		for (const item of data) {
			try {
				// Handle vendor lookup if vendor_name is provided
				let vendorId = null;
				if (item.vendor_name) {
					const vendors = await pb.collection('vendors_collection').getFullList({
						filter: `name = "${item.vendor_name}"`
					});
					if (vendors.length > 0) {
						vendorId = vendors[0].id;
					}
				}
				
				const inventoryData = {
					name: item.name,
					description: item.description || '',
					category: item.category,
					unit: item.unit,
					current_stock: item.current_stock,
					min_stock_level: item.min_stock_level,
					max_stock_level: item.max_stock_level,
					cost_per_unit: item.cost_per_unit,
					vendor: vendorId,
					expiry_date: item.expiry_date
				};
				
				await collections.createInventoryItem(inventoryData);
				results.success++;
			} catch (error) {
				results.errors.push(`${item.name}: ${error.message}`);
			}
		}
		
		return results;
	}

	async function processStaffData(data) {
		const results = { success: 0, errors: [] };
		
		for (const person of data) {
			try {
				const staffData = {
					first_name: person.first_name,
					last_name: person.last_name,
					email: person.email,
					phone: person.phone || '',
					position: person.position,
					hourly_rate: person.hourly_rate,
					hire_date: person.hire_date,
					status: person.status
				};
				
				await collections.createStaff(staffData);
				results.success++;
			} catch (error) {
				results.errors.push(`${person.first_name} ${person.last_name}: ${error.message}`);
			}
		}
		
		return results;
	}

	async function processMenuData(data) {
		const results = { success: 0, errors: [] };
		
		for (const item of data) {
			try {
				const menuData = {
					name: item.name,
					description: item.description || '',
					category: item.category,
					price: item.price,
					cost: item.cost,
					ingredients: item.ingredients || '',
					allergens: item.allergens ? item.allergens.split(',').map(a => a.trim()) : [],
					preparation_time: item.preparation_time,
					available: item.available !== false
				};
				
				await collections.createMenuItem(menuData);
				results.success++;
			} catch (error) {
				results.errors.push(`${item.name}: ${error.message}`);
			}
		}
		
		return results;
	}

	async function processVendorsData(data) {
		const results = { success: 0, errors: [] };
		
		for (const vendor of data) {
			try {
				const vendorData = {
					name: vendor.name,
					contact_person: vendor.contact_person || '',
					email: vendor.email || '',
					phone: vendor.phone || '',
					address: vendor.address || '',
					category: vendor.category,
					payment_terms: vendor.payment_terms || '',
					status: vendor.status,
					notes: vendor.notes || ''
				};
				
				await collections.createVendor(vendorData);
				results.success++;
			} catch (error) {
				results.errors.push(`${vendor.name}: ${error.message}`);
			}
		}
		
		return results;
	}

	async function processEventsData(data) {
		const results = { success: 0, errors: [] };
		
		for (const event of data) {
			try {
				const eventData = {
					name: event.name,
					description: event.description || '',
					event_type: event.event_type,
					event_date: event.event_date,
					start_time: event.start_time,
					end_time: event.end_time,
					guest_count: event.guest_count,
					contact_name: event.contact_name || '',
					contact_email: event.contact_email || '',
					contact_phone: event.contact_phone || '',
					status: event.status,
					special_requirements: event.special_requirements || '',
					estimated_revenue: event.estimated_revenue
				};
				
				const record = await pb.collection('events_collection').create(eventData);
				events.update(items => [...items, record]);
				results.success++;
			} catch (error) {
				results.errors.push(`${event.name}: ${error.message}`);
			}
		}
		
		return results;
	}

	async function processShiftsData(data) {
		const results = { success: 0, errors: [] };
		
		for (const shift of data) {
			try {
				// Find staff member by email
				const staff = await pb.collection('staff_collection').getFullList({
					filter: `email = "${shift.staff_member_email}"`
				});
				
				if (staff.length === 0) {
					results.errors.push(`Shift for ${shift.staff_member_email}: Staff member not found`);
					continue;
				}
				
				const shiftData = {
					staff_member: staff[0].id,
					shift_date: shift.shift_date,
					start_time: shift.start_time,
					end_time: shift.end_time,
					break_duration: shift.break_duration || 0,
					position: shift.position,
					status: shift.status,
					notes: shift.notes || ''
				};
				
				await collections.createShift(shiftData);
				results.success++;
			} catch (error) {
				results.errors.push(`Shift for ${shift.staff_member_email}: ${error.message}`);
			}
		}
		
		return results;
	}

	async function processMaintenanceTasksData(data) {
		const results = { success: 0, errors: [] };
		
		for (const task of data) {
			try {
				const taskData = {
					task_name: task.task_name,
					description: task.description || '',
					category: task.category,
					frequency: task.frequency,
					priority: task.priority,
					estimated_duration: task.estimated_duration ? parseInt(task.estimated_duration) : null,
					status: task.status || 'active'
				};
				
				await collections.createMaintenanceTask(taskData);
				results.success++;
			} catch (error) {
				results.errors.push(`Task "${task.task_name}": ${error.message}`);
			}
		}
		
		return results;
	}

	async function processMaintenanceSchedulesData(data) {
		const results = { success: 0, errors: [] };
		
		for (const schedule of data) {
			try {
				const scheduleData = {
					task_name: schedule.task_name,
					scheduled_date: schedule.scheduled_date,
					status: schedule.status || 'pending',
					notes: schedule.notes || ''
				};
				
				await collections.createMaintenanceSchedule(scheduleData);
				results.success++;
			} catch (error) {
				results.errors.push(`Schedule for "${schedule.task_name}": ${error.message}`);
			}
		}
		
		return results;
	}

	async function processMaintenanceRecordsData(data) {
		const results = { success: 0, errors: [] };
		
		for (const record of data) {
			try {
				const recordData = {
					task_name: record.task_name,
					completed_date: record.completed_date,
					completed_by: record.completed_by || '',
					completion_notes: record.completion_notes || ''
				};
				
				await collections.createMaintenanceRecord(recordData);
				results.success++;
			} catch (error) {
				results.errors.push(`Record for "${record.task_name}": ${error.message}`);
			}
		}
		
		return results;
	}

	async function handleImport() {
		if (!selectedCollection || (!csvFile && !csvData.trim())) {
			importStatus = 'Please select a collection and provide CSV data';
			return;
		}

		isImporting = true;
		importStatus = importMethod === 'upload' ? 'Reading CSV file...' : 'Processing CSV data...';

		try {
			const text = importMethod === 'upload' ? await csvFile.text() : csvData;
			const data = await parseCSV(text);
			
			importStatus = `Processing ${data.length} records...`;
			
			let results;
			switch (selectedCollection) {
				case 'inventory_collection':
					results = await processInventoryData(data);
					break;
				case 'staff_collection':
					results = await processStaffData(data);
					break;
				case 'menu_collection':
					results = await processMenuData(data);
					break;
				case 'vendors_collection':
					results = await processVendorsData(data);
					break;
				case 'events_collection':
					results = await processEventsData(data);
					break;
				case 'shifts_collection':
					results = await processShiftsData(data);
					break;
				case 'maintenance_tasks':
					results = await processMaintenanceTasksData(data);
					break;
				case 'maintenance_schedules':
					results = await processMaintenanceSchedulesData(data);
					break;
				case 'maintenance_records':
					results = await processMaintenanceRecordsData(data);
					break;
				default:
					throw new Error('Invalid collection selected');
			}
			
			importResults = results;
			importStatus = `Import completed: ${results.success} successful, ${results.errors.length} errors`;
			
		} catch (error) {
			console.error('Import error:', error);
			importStatus = `Import failed: ${error.message}`;
		} finally {
			isImporting = false;
		}
	}
</script>

{#if isOpen}
	<!-- Modal backdrop -->
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<!-- Modal -->
		<div class="bg-gray-800 rounded-xl border border-gray-700 p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
			<div class="flex justify-between items-center mb-6">
				<h2 class="text-2xl font-bold">Import Data</h2>
				<button
					on:click={close}
					class="text-gray-400 hover:text-gray-300"
					disabled={isImporting}
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Collection Selection -->
			<div class="mb-6">
				<label class="block text-sm font-medium text-gray-300 mb-2">
					Select Collection Type
				</label>
				<select
					bind:value={selectedCollection}
					disabled={isImporting}
					class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="">Choose collection...</option>
					{#each collectionOptions as option}
						<option value={option.id}>{option.name}</option>
					{/each}
				</select>
			</div>

			<!-- Sample File Download -->
			{#if selectedCollection}
				<div class="mb-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-medium text-blue-300">Sample CSV Format</h3>
							<p class="text-sm text-gray-400">Download sample file to see the expected format</p>
						</div>
						<button
							on:click={downloadSample}
							class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
							disabled={isImporting}
						>
							Download Sample
						</button>
					</div>
				</div>
			{/if}

			<!-- Import Method Selection -->
			<div class="mb-6">
				<label class="block text-sm font-medium text-gray-300 mb-3">
					Import Method
				</label>
				<div class="flex space-x-4">
					<label class="flex items-center">
						<input
							type="radio"
							bind:group={importMethod}
							value="upload"
							disabled={isImporting}
							class="mr-2"
						/>
						<span>Upload CSV File</span>
					</label>
					<label class="flex items-center">
						<input
							type="radio"
							bind:group={importMethod}
							value="paste"
							disabled={isImporting}
							class="mr-2"
						/>
						<span>Paste CSV Data</span>
					</label>
				</div>
			</div>

			<!-- File Upload -->
			{#if importMethod === 'upload'}
				<div class="mb-6">
					<label class="block text-sm font-medium text-gray-300 mb-2">
						Upload CSV File
					</label>
					<input
						type="file"
						accept=".csv"
						on:change={handleFileChange}
						disabled={isImporting}
						class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-medium hover:file:bg-blue-700"
					/>
				</div>
			{:else}
				<!-- Paste CSV Data -->
				<div class="mb-6">
					<label class="block text-sm font-medium text-gray-300 mb-2">
						Paste CSV Data
					</label>
					<textarea
						bind:value={csvData}
						disabled={isImporting}
						placeholder="Paste your CSV data here...&#10;name,description,category&#10;Item 1,Description 1,Category 1&#10;Item 2,Description 2,Category 2"
						rows="8"
						class="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
					></textarea>
					<p class="text-xs text-gray-400 mt-2">
						Paste CSV data including headers. Each line should be a separate record.
					</p>
				</div>
			{/if}

			<!-- Import Status -->
			{#if importStatus}
				<div class="mb-6 p-4 {
					importResults?.errors?.length > 0 ? 'bg-yellow-900/20 border-yellow-700/30' :
					importResults ? 'bg-green-900/20 border-green-700/30' :
					'bg-blue-900/20 border-blue-700/30'
				} border rounded-lg">
					<p class="text-sm">{importStatus}</p>
					
					{#if importResults}
						<div class="mt-2 text-sm">
							<p class="text-green-300">✓ {importResults.success} records imported successfully</p>
							{#if importResults.errors.length > 0}
								<p class="text-orange-300 mb-2">⚠ {importResults.errors.length} errors occurred:</p>
								<div class="max-h-32 overflow-y-auto bg-gray-800/50 p-2 rounded">
									{#each importResults.errors as error}
										<p class="text-xs text-red-300">• {error}</p>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Action Buttons -->
			<div class="flex justify-end space-x-4">
				<button
					on:click={close}
					class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
					disabled={isImporting}
				>
					{importResults ? 'Close' : 'Cancel'}
				</button>
				
				{#if !importResults}
					<button
						on:click={handleImport}
						disabled={!selectedCollection || (importMethod === 'upload' ? !csvFile : !csvData.trim()) || isImporting}
						class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
					>
						{#if isImporting}
							<div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
							Importing...
						{:else}
							Import Data
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
