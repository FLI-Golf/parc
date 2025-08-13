// @ts-nocheck
import { writable, get } from 'svelte/store';
import pb from '../pocketbase.js';

// Collection stores (typed to avoid never[] inference)
/** @type {import('svelte/store').Writable<any[]>} */ export const inventoryItems = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const staff = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const shifts = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const menuItems = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const menuCategories = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const menuModifiers = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const vendors = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const events = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const maintenanceTasks = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const maintenanceSchedules = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const maintenanceRecords = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const sections = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const tables = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const tableUpdates = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const tickets = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const ticketItems = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const payments = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const completedOrders = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const spoils = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const scheduleProposals = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const workRequests = writable([]);
/** @type {import('svelte/store').Writable<any[]>} */ export const shiftTrades = writable([]);

// Loading states
/** @type {import('svelte/store').Writable<Record<string, boolean>>} */
export const loading = writable({
	inventory: false,
	staff: false,
	shifts: false,
	menu: false,
	menuCategories: false,
	menuModifiers: false,
	vendors: false,
	events: false,
	maintenance: false,
	schedules: false,
	records: false,
	sections: false,
	tables: false,
	tableUpdates: false,
	tickets: false,
		// svelte-check sometimes flags these as never without explicit types
		// casting the store above avoids that, but keeping keys explicit here
		ticketItems: false,
	payments: false,
	completedOrders: false,
	spoils: false,
	scheduleProposals: false
});

// Collection service functions
export const collections = {
	// Inventory Items
	async getInventoryItems() {
		try {
			loading.update(state => ({ ...state, inventory: true }));
			const records = await pb.collection('inventory_collection').getFullList({
				expand: 'vendor_field'
			});
			inventoryItems.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching inventory items:', error);
			throw error;
		} finally {
			loading.update(state => ({ ...state, inventory: false }));
		}
	},

	async createInventoryItem(data) {
		try {
			const record = await pb.collection('inventory_collection').create(data);
			inventoryItems.update(items => [...items, record]);
			return record;
		} catch (error) {
			console.error('Error creating inventory item:', error);
			throw error;
		}
	},

	async updateInventoryItem(id, data) {
		try {
			const record = await pb.collection('inventory_collection').update(id, data);
			inventoryItems.update(items => 
				items.map(item => item.id === id ? record : item)
			);
			return record;
		} catch (error) {
			console.error('Error updating inventory item:', error);
			throw error;
		}
	},

	async deleteInventoryItem(id) {
		try {
			await pb.collection('inventory_collection').delete(id);
			inventoryItems.update(items => items.filter(item => item.id !== id));
		} catch (error) {
			console.error('Error deleting inventory item:', error);
			throw error;
		}
	},

	// Staff
	async getStaff() {
		try {
			loading.update(state => ({ ...state, staff: true }));
			const records = await pb.collection('staff_collection').getFullList({
				expand: 'user_id'
			});
			staff.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching staff:', error);
			throw error;
		} finally {
			loading.update(state => ({ ...state, staff: false }));
		}
	},

	async createStaff(data) {
		try {
			const record = await pb.collection('staff_collection').create(data);
			staff.update(items => [...items, record]);
			return record;
		} catch (error) {
			console.error('Error creating staff:', error);
			throw error;
		}
	},

	async updateStaff(id, data) {
		try {
			const record = await pb.collection('staff_collection').update(id, data);
			staff.update(items => 
				items.map(item => item.id === id ? record : item)
			);
			return record;
		} catch (error) {
			console.error('Error updating staff:', error);
			throw error;
		}
	},

	async deleteStaff(id) {
		try {
			await pb.collection('staff_collection').delete(id);
			staff.update(items => items.filter(item => item.id !== id));
		} catch (error) {
			console.error('Error deleting staff:', error);
			throw error;
		}
	},

	// Shifts
	async getShifts() {
		try {
			loading.update(state => ({ ...state, shifts: true }));
			let records;
			try {
				records = await pb.collection('shifts_collection').getFullList({
					expand: 'staff_member,assigned_section'
				});
			} catch (firstError) {
				console.warn('shifts_collection not found, trying shifts:', firstError?.message);
				records = await pb.collection('shifts').getFullList({
					expand: 'staff_member,assigned_section'
				});
			}
			shifts.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching shifts:', error);
			throw error;
		} finally {
			loading.update(state => ({ ...state, shifts: false }));
		}
	},

	async createShift(data) {
		try {
			// Approvals allowed any day; enforce brunch-on-Sunday via caller
			// Map UI draft fields to PocketBase schema and strip unknowns
			let payload = {
				staff_member: data.staff_member || data.staff_id || null,
				shift_date: data.shift_date,
				start_time: data.start_time,
				end_time: data.end_time,
				break_duration: data.break_duration ?? 0,
				position: data.position || 'server',
				status: data.status || 'scheduled',
				notes: data.notes || '',
				assigned_section: data.assigned_section || null,
				shift_type: data.shift_type || 'regular'
			};
			// Map section_code -> assigned_section id if available
			if (!payload.assigned_section && data.section_code) {
				try {
					const allSections = get(sections) || [];
					const code = String(data.section_code).toUpperCase();
					const aliases = {
						A: ['A','MAIN DINING','SECTION A'],
						B: ['B','SECTION B'],
						BAR: ['BAR','BAR AREA']
					};
					const names = aliases[code] || [code];
					const match = allSections.find(s => {
						const cand = String(s.section_code || s.code || s.name || '').toUpperCase();
						const name = String(s.name || '').toUpperCase();
						return names.includes(cand) || names.includes(name);
					});
					if (match?.id) payload.assigned_section = match.id;
				} catch {}
			}
			// Prune null/undefined optional fields
			payload = Object.fromEntries(Object.entries(payload).filter(([k, v]) => v !== null && v !== undefined));
			// Basic required validation to avoid 400s
			if (!payload.staff_member || !payload.shift_date || !payload.start_time || !payload.end_time || !payload.position || !payload.status) {
				const missing = ['staff_member','shift_date','start_time','end_time','position','status'].filter(k => !payload[k]);
				throw Object.assign(new Error(`Missing required shift fields: ${missing.join(', ')}`), { data: { missing } });
			}
			// Sanitize shift_type to allowed values if present
			const allowedShiftTypes = new Set(['brunch','lunch','dinner']);
			if (payload.shift_type) {
				const st = String(payload.shift_type).toLowerCase();
				if (st === 'bar') payload.shift_type = 'dinner';
				else if (!allowedShiftTypes.has(st)) delete payload.shift_type;
			}
			let record;
			let collectionUsed = 'shifts_collection';
			try {
				// Idempotency: skip if identical shift already exists
				try {
					const existing = await pb.collection(collectionUsed).getList(1, 1, {
						filter: `staff_member = "${payload.staff_member}" && shift_date = "${payload.shift_date}" && start_time = "${payload.start_time}" && position = "${payload.position}"`
					});
					if (existing?.items?.length) {
						console.warn('Duplicate shift detected in', collectionUsed, 'skipping create');
						return existing.items[0];
					}
				} catch {}
				record = await pb.collection(collectionUsed).create(payload);
			} catch (firstError) {
				console.warn('shifts_collection create failed, trying shifts:', firstError?.message || firstError?.data?.message, firstError?.data || firstError);
				collectionUsed = 'shifts';
				try {
					// Idempotency check in fallback collection
					try {
						const existing = await pb.collection(collectionUsed).getList(1, 1, {
							filter: `staff_member = "${payload.staff_member}" && shift_date = "${payload.shift_date}" && start_time = "${payload.start_time}" && position = "${payload.position}"`
						});
						if (existing?.items?.length) {
							console.warn('Duplicate shift detected in', collectionUsed, 'skipping create');
							return existing.items[0];
						}
					} catch {}
					record = await pb.collection(collectionUsed).create(payload);
				} catch (secondError) {
					console.warn('shifts create failed:', secondError?.message || secondError?.data?.message, secondError?.data || secondError);
					// Retry with date-time if shift_date may require time
					if (/^\d{4}-\d{2}-\d{2}$/.test(payload.shift_date || '')) {
						const retryPayload = { ...payload, shift_date: `${payload.shift_date} 00:00:00` };
						console.warn('Retrying create with date-time shift_date:', retryPayload.shift_date);
						record = await pb.collection(collectionUsed).create(retryPayload);
					} else {
						throw secondError;
					}
				}
			}
			// Fetch the record with expanded relations from the collection used
			const expandedRecord = await pb.collection(collectionUsed).getOne(record.id, {
				expand: 'staff_member,assigned_section'
			});
			shifts.update(items => [...items, expandedRecord]);
			return expandedRecord;
		} catch (error) {
			console.error('Error creating shift:', error);
			// Bubble up with PB error details when available
			const message = error?.data ? JSON.stringify(error.data) : (error?.message || 'Failed to create shift');
			throw Object.assign(new Error(message), { data: error?.data || null });
		}
	},

	async updateShift(id, data) {
		try {
			console.log('updateShift called with:', { id, data });
			let collectionUsed = 'shifts_collection';
			let record;
			try {
				record = await pb.collection(collectionUsed).update(id, data);
			} catch (firstError) {
				console.warn('shifts_collection update failed, trying shifts:', firstError?.message);
				collectionUsed = 'shifts';
				record = await pb.collection(collectionUsed).update(id, data);
			}
			console.log('Update response:', record);
			// Fetch the record with expanded relations from the collection used
			const expandedRecord = await pb.collection(collectionUsed).getOne(id, {
				expand: 'staff_member,assigned_section'
			});
			console.log('Expanded record:', expandedRecord);
			shifts.update(items => 
				items.map(item => item.id === id ? expandedRecord : item)
			);
			return expandedRecord;
		} catch (error) {
			console.error('Error updating shift:', error);
			throw error;
		}
	},

	async deleteShift(id) {
		try {
			await pb.collection('shifts_collection').delete(id);
			shifts.update(items => items.filter(item => item.id !== id));
		} catch (error) {
			console.error('Error deleting shift:', error);
			throw error;
		}
	},

	// Menu Items
	async getMenuItems() {
		try {
			loading.update(state => ({ ...state, menu: true }));
			const records = await pb.collection('menu_collection').getFullList();
			menuItems.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching menu items:', error);
			throw error;
		} finally {
			loading.update(state => ({ ...state, menu: false }));
		}
	},

	async createMenuItem(data) {
		try {
			const record = await pb.collection('menu_collection').create(data);
			menuItems.update(items => [...items, record]);
			return record;
		} catch (error) {
			console.error('Error creating menu item:', error);
			throw error;
		}
	},

	async updateMenuItem(id, data) {
		try {
			const record = await pb.collection('menu_collection').update(id, data);
			menuItems.update(items => 
				items.map(item => item.id === id ? record : item)
			);
			return record;
		} catch (error) {
			console.error('Error updating menu item:', error);
			throw error;
		}
	},

	async deleteMenuItem(id) {
		try {
			await pb.collection('menu_collection').delete(id);
			menuItems.update(items => items.filter(item => item.id !== id));
		} catch (error) {
			console.error('Error deleting menu item:', error);
			throw error;
		}
	},

	// Menu Categories
	async getMenuCategories() {
		try {
			loading.update(state => ({ ...state, menuCategories: true }));
			const records = await pb.collection('menu_categories').getFullList({
				sort: '+sort_order'
			});
			menuCategories.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching menu categories:', error);
			menuCategories.set([]);
			return [];
		} finally {
			loading.update(state => ({ ...state, menuCategories: false }));
		}
	},

	async createMenuCategory(data) {
		try {
			const record = await pb.collection('menu_categories').create(data);
			menuCategories.update(items => [...items, record]);
			return record;
		} catch (error) {
			console.error('Error creating menu category:', error);
			throw error;
		}
	},

	// Menu Modifiers
	async getMenuModifiers() {
		try {
			loading.update(state => ({ ...state, menuModifiers: true }));
			const records = await pb.collection('menu_modifiers').getFullList({
				sort: '+sort_order'
			});
			menuModifiers.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching menu modifiers:', error);
			menuModifiers.set([]);
			return [];
		} finally {
			loading.update(state => ({ ...state, menuModifiers: false }));
		}
	},

	async createMenuModifier(data) {
		try {
			const record = await pb.collection('menu_modifiers').create(data);
			menuModifiers.update(items => [...items, record]);
			return record;
		} catch (error) {
			console.error('Error creating menu modifier:', error);
			throw error;
		}
	},

	// Vendors
	async getVendors() {
		try {
			loading.update(state => ({ ...state, vendors: true }));
			const records = await pb.collection('vendors_collection').getFullList();
			vendors.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching vendors:', error);
			throw error;
		} finally {
			loading.update(state => ({ ...state, vendors: false }));
		}
	},

	async createVendor(data) {
		try {
			const record = await pb.collection('vendors_collection').create(data);
			vendors.update(items => [...items, record]);
			return record;
		} catch (error) {
			console.error('Error creating vendor:', error);
			throw error;
		}
	},

	async updateVendor(id, data) {
		try {
			const record = await pb.collection('vendors_collection').update(id, data);
			vendors.update(items => 
				items.map(item => item.id === id ? record : item)
			);
			return record;
		} catch (error) {
			console.error('Error updating vendor:', error);
			throw error;
		}
	},

	async deleteVendor(id) {
		try {
			await pb.collection('vendors_collection').delete(id);
			vendors.update(items => items.filter(item => item.id !== id));
		} catch (error) {
			console.error('Error deleting vendor:', error);
			throw error;
		}
	},

	// Events
	async getEvents() {
		try {
			loading.update(state => ({ ...state, events: true }));
			const records = await pb.collection('events_collection').getFullList();
			events.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching events:', error);
			throw error;
		} finally {
			loading.update(state => ({ ...state, events: false }));
		}
	},

	async createEvent(data) {
		try {
			const record = await pb.collection('events_collection').create(data);
			events.update(items => [...items, record]);
			return record;
		} catch (error) {
			console.error('Error creating event:', error);
			throw error;
		}
	},

	async updateEvent(id, data) {
		try {
			const record = await pb.collection('events_collection').update(id, data);
			events.update(items => 
				items.map(item => item.id === id ? record : item)
			);
			return record;
		} catch (error) {
			console.error('Error updating event:', error);
			throw error;
		}
	},

	async deleteEvent(id) {
		try {
			await pb.collection('events_collection').delete(id);
			events.update(items => items.filter(item => item.id !== id));
		} catch (error) {
			console.error('Error deleting event:', error);
			throw error;
		}
	},

	// Maintenance Tasks
	async getMaintenanceTasks() {
		try {
			loading.update(state => ({ ...state, maintenance: true }));
			// Try different collection names/IDs
			let collectionName = 'maintenance_tasks';
			try {
				const records = await pb.collection(collectionName).getFullList();
				maintenanceTasks.set(records);
				return records;
			} catch (e) {
				// Try with collection suffix
				try {
					collectionName = 'maintenance_tasks_collection';
					const records = await pb.collection(collectionName).getFullList();
					maintenanceTasks.set(records);
					return records;
				} catch (e2) {
					console.log('Maintenance tasks collection not found, using empty array');
					maintenanceTasks.set([]);
					return [];
				}
			}
		} catch (error) {
			console.error('Error fetching maintenance tasks:', error);
			maintenanceTasks.set([]);
			return [];
		} finally {
			loading.update(state => ({ ...state, maintenance: false }));
		}
	},

	async createMaintenanceTask(data) {
		try {
			const record = await pb.collection('maintenance_tasks').create(data);
			maintenanceTasks.update(items => [...items, record]);
			return record;
		} catch (error) {
			console.error('Error creating maintenance task:', error);
			throw error;
		}
	},

	async updateMaintenanceTask(id, data) {
		try {
			const record = await pb.collection('maintenance_tasks').update(id, data);
			maintenanceTasks.update(items => 
				items.map(item => item.id === id ? record : item)
			);
			return record;
		} catch (error) {
			console.error('Error updating maintenance task:', error);
			throw error;
		}
	},

	async deleteMaintenanceTask(id) {
		try {
			await pb.collection('maintenance_tasks').delete(id);
			maintenanceTasks.update(items => items.filter(item => item.id !== id));
		} catch (error) {
			console.error('Error deleting maintenance task:', error);
			throw error;
		}
	},

	// Maintenance Schedules
	async getMaintenanceSchedules() {
		try {
			loading.update(state => ({ ...state, schedules: true }));
			// Try different collection names/IDs
			let collectionName = 'maintenance_schedules';
			try {
				const records = await pb.collection(collectionName).getFullList();
				maintenanceSchedules.set(records);
				return records;
			} catch (e) {
				// Try with collection suffix
				try {
					collectionName = 'maintenance_schedules_collection';
					const records = await pb.collection(collectionName).getFullList();
					maintenanceSchedules.set(records);
					return records;
				} catch (e2) {
					console.log('Maintenance schedules collection not found, using empty array');
					maintenanceSchedules.set([]);
					return [];
				}
			}
		} catch (error) {
			console.error('Error fetching maintenance schedules:', error);
			maintenanceSchedules.set([]);
			return [];
		} finally {
			loading.update(state => ({ ...state, schedules: false }));
		}
	},

	async createMaintenanceSchedule(data) {
		try {
			const record = await pb.collection('maintenance_schedules').create(data);
			maintenanceSchedules.update(items => [...items, record]);
			return record;
		} catch (error) {
			console.error('Error creating maintenance schedule:', error);
			throw error;
		}
	},

	async updateMaintenanceSchedule(id, data) {
		try {
			const record = await pb.collection('maintenance_schedules').update(id, data);
			maintenanceSchedules.update(items => 
				items.map(item => item.id === id ? record : item)
			);
			return record;
		} catch (error) {
			console.error('Error updating maintenance schedule:', error);
			throw error;
		}
	},

	async deleteMaintenanceSchedule(id) {
		try {
			await pb.collection('maintenance_schedules').delete(id);
			maintenanceSchedules.update(items => items.filter(item => item.id !== id));
		} catch (error) {
			console.error('Error deleting maintenance schedule:', error);
			throw error;
		}
	},

	// Maintenance Records
	async getMaintenanceRecords() {
		try {
			loading.update(state => ({ ...state, records: true }));
			// Try different collection names/IDs
			let collectionName = 'maintenance_records';
			try {
				const records = await pb.collection(collectionName).getFullList();
				maintenanceRecords.set(records);
				return records;
			} catch (e) {
				// Try with collection suffix
				try {
					collectionName = 'maintenance_records_collection';
					const records = await pb.collection(collectionName).getFullList();
					maintenanceRecords.set(records);
					return records;
				} catch (e2) {
					console.log('Maintenance records collection not found, using empty array');
					maintenanceRecords.set([]);
					return [];
				}
			}
		} catch (error) {
			console.error('Error fetching maintenance records:', error);
			maintenanceRecords.set([]);
			return [];
		} finally {
			loading.update(state => ({ ...state, records: false }));
		}
	},

	async createMaintenanceRecord(data) {
		try {
			const record = await pb.collection('maintenance_records').create(data);
			maintenanceRecords.update(items => [...items, record]);
			return record;
		} catch (error) {
			console.error('Error creating maintenance record:', error);
			throw error;
		}
	},

	async updateTicketItem(itemId, data) {
		try {
			const record = await pb.collection('ticket_items_collection').update(itemId, data);
			ticketItems.update(items => items.map(item => 
				item.id === itemId ? record : item
			));
			return record;
		} catch (error) {
			console.error('Error updating ticket item:', error);
			throw error;
		}
	},

	// Sections
	async getSections() {
		try {
			loading.update(state => ({ ...state, sections: true }));
			console.log('Attempting to fetch sections...');
			
			// Try the collection with the expected name first
			let records;
			try {
				records = await pb.collection('sections_collection').getFullList();
				console.log('Found sections_collection:', records);
			} catch (firstError) {
				console.log('sections_collection not found, trying sections:', firstError.message);
				try {
					records = await pb.collection('sections').getFullList();
					console.log('Found sections:', records);
				} catch (secondError) {
					console.log('sections not found either:', secondError.message);
					throw secondError;
				}
			}
			
			sections.set(records);
			console.log('Sections loaded into store:', records.length);
			return records;
		} catch (error) {
			console.error('Error fetching sections:', error);
			throw error;
		} finally {
			loading.update(state => ({ ...state, sections: false }));
		}
	},

	async createSection(data) {
		try {
			const record = await pb.collection('sections_collection').create(data);
			sections.update(items => [...items, record]);
			return record;
		} catch (error) {
			console.error('Error creating section:', error);
			throw error;
		}
	},

	// Work Requests
	async getWorkRequests() {
		try {
			loading.update(s => ({ ...s, records: true }));
			const records = await pb.collection('work_requests').getFullList();
			workRequests.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching work requests:', error);
			throw error;
		} finally {
			loading.update(s => ({ ...s, records: false }));
		}
	},
	async createWorkRequest(data) {
		try {
			const record = await pb.collection('work_requests').create(data);
			workRequests.update(items => [record, ...items]);
			return record;
		} catch (error) {
			console.error('Error creating work request:', error);
			throw error;
		}
	},
	async updateWorkRequest(id, data) {
		try {
			const record = await pb.collection('work_requests').update(id, data);
			workRequests.update(items => items.map(r => r.id === id ? record : r));
			return record;
		} catch (error) {
			console.error('Error updating work request:', error);
			throw error;
		}
	},
	async deleteWorkRequest(id) {
		try {
			await pb.collection('work_requests').delete(id);
			workRequests.update(items => items.filter(r => r.id !== id));
		} catch (error) {
			console.error('Error deleting work request:', error);
			throw error;
		}
	},

	// Shift Trades
	async getShiftTrades() {
		try {
			loading.update(s => ({ ...s, records: true }));
			const records = await pb.collection('shift_trades').getFullList({ expand: 'shift_id,current_staff,offered_by,offered_to' });
			shiftTrades.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching shift trades:', error);
			throw error;
		} finally {
			loading.update(s => ({ ...s, records: false }));
		}
	},
	async createShiftTrade(data) {
		try {
			const record = await pb.collection('shift_trades').create(data);
			shiftTrades.update(items => [record, ...items]);
			return record;
		} catch (error) {
			console.error('Error creating shift trade:', error);
			throw error;
		}
	},
	async updateShiftTrade(id, data) {
		try {
			const record = await pb.collection('shift_trades').update(id, data);
			shiftTrades.update(items => items.map(r => r.id === id ? record : r));
			return record;
		} catch (error) {
			console.error('Error updating shift trade:', error);
			throw error;
		}
	},
	async deleteShiftTrade(id) {
		try {
			await pb.collection('shift_trades').delete(id);
			shiftTrades.update(items => items.filter(r => r.id !== id));
		} catch (error) {
			console.error('Error deleting shift trade:', error);
			throw error;
		}
	},

	// Tables
	async getTables() {
		try {
			loading.update(state => ({ ...state, tables: true }));
			const records = await pb.collection('tables_collection').getFullList();
			tables.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching tables:', error);
			throw error;
		} finally {
			loading.update(state => ({ ...state, tables: false }));
		}
	},

	async createTable(data) {
		try {
			const record = await pb.collection('tables_collection').create(data);
			tables.update(items => [...items, record]);
			return record;
		} catch (error) {
			console.error('Error creating table:', error);
			throw error;
		}
	},

	async updateTable(id, data) {
		try {
			const record = await pb.collection('tables_collection').update(id, data);
			tables.update(items => items.map(item => item.id === id ? record : item));
			return record;
		} catch (error) {
			console.error('Error updating table:', error);
			throw error;
		}
	},

	// Table Updates
	async getTableUpdates() {
		try {
			loading.update(state => ({ ...state, tableUpdates: true }));
			let records;
			try {
				records = await pb.collection('table_updates_collection').getFullList({ sort: '-created' });
			} catch (firstError) {
				console.log('table_updates_collection not found, trying table_updates:', firstError?.message);
				records = await pb.collection('table_updates').getFullList({ sort: '-created' });
			}
			tableUpdates.set(records);
			return records;
		} catch (error) {
			console.warn('Table updates collection not available, returning empty list:', error?.message || error);
			tableUpdates.set([]);
			return [];
		} finally {
			loading.update(state => ({ ...state, tableUpdates: false }));
		}
	},

	async createTableUpdate(data) {
		try {
			let record;
			try {
				record = await pb.collection('table_updates_collection').create(data);
			} catch (firstError) {
				console.log('table_updates_collection not found, trying table_updates:', firstError?.message);
				record = await pb.collection('table_updates').create(data);
			}
			tableUpdates.update(items => [record, ...items]);
			return record;
		} catch (error) {
			console.error('Error creating table update:', error);
			throw error;
		}
	},

	// Tickets
	async getTickets() {
		try {
			loading.update(state => ({ ...state, tickets: true }));
			const records = await pb.collection('tickets_collection').getFullList({
				expand: 'table_id,server_id',
				sort: '-created'
			});
			tickets.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching tickets:', error);
			tickets.set([]);
			return [];
		} finally {
			loading.update(state => ({ ...state, tickets: false }));
		}
	},

	async createTicket(data) {
		try {
			// Generate ticket number
			const ticketNumber = `T${Date.now().toString().slice(-6)}`;
			const ticketData = {
				...data,
				ticket_number: ticketNumber,
				status: 'open',
				subtotal_amount: 0,
				tax_amount: 0,
				tip_amount: 0,
				total_amount: 0
			};
			
			const record = await pb.collection('tickets_collection').create(ticketData, {
			expand: 'table_id,server_id'
			});
			tickets.update(items => [record, ...items]);
			return record;
		} catch (error) {
			console.error('Error creating ticket:', error);
			throw error;
		}
	},

	async updateTicket(id, data) {
		try {
			const record = await pb.collection('tickets_collection').update(id, data, {
			expand: 'table_id,server_id'
			});
			tickets.update(items => 
				items.map(item => item.id === id ? record : item)
			);
			return record;
		} catch (error) {
			console.error('Error updating ticket:', error);
			throw error;
		}
	},

	// Ticket Items
	async getTicketItems(ticketId = null) {
		try {
			loading.update(state => ({ ...state, ticketItems: true }));
			const filter = ticketId ? `ticket_id="${ticketId}"` : '';
			const records = await pb.collection('ticket_items_collection').getFullList({
			expand: 'ticket_id,menu_item_id',
			filter,
			sort: 'created'
			});
			ticketItems.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching ticket items:', error);
			ticketItems.set([]);
			return [];
		} finally {
			loading.update(state => ({ ...state, ticketItems: false }));
		}
	},

	async addTicketItem(data) {
		try {
			const itemData = {
				ticket_id: data.ticket_id,
				menu_item_id: data.menu_item_id,
				quantity: data.quantity,
				unit_price: data.unit_price,
				total_price: data.total_price,
				modifications: data.modifications,
				course: data.course,
				kitchen_station: data.kitchen_station,
				status: 'ordered',
				ordered_at: new Date().toISOString()
			};
			
			const record = await pb.collection('ticket_items_collection').create(itemData, {
				expand: 'ticket_id,menu_item_id'
			});
			ticketItems.update(items => [record, ...items]);
			
			// Update ticket totals
			await this.recalculateTicketTotals(data.ticket_id);
			
			return record;
		} catch (error) {
			console.error('Error adding ticket item:', error);
			throw error;
		}
	},

	async updateTicketItem(id, data) {
		try {
			const record = await pb.collection('ticket_items_collection').update(id, data, {
			expand: 'ticket_id,menu_item_id'
			});
			ticketItems.update(items => 
				items.map(item => item.id === id ? record : item)
			);
			return record;
		} catch (error) {
			console.error('Error updating ticket item:', error);
			throw error;
		}
	},

	async removeTicketItem(id) {
		try {
			// Try to get the item from the correct collection first
			let item = null;
			let ticketId = null;
			
			try {
				item = await pb.collection('ticket_items_collection').getOne(id);
				ticketId = item.ticket_id;
			} catch (getError) {
				console.warn('Item not found in ticket_items_collection, trying ticket_items:', getError);
				// Try the other collection name as fallback
				try {
					item = await pb.collection('ticket_items').getOne(id);
					ticketId = item.ticket_id;
				} catch (fallbackError) {
					console.error('Item not found in either collection:', fallbackError);
					// Still try to remove from local state
					ticketItems.update(items => items.filter(item => item.id !== id));
					return;
				}
			}
			
			// Try to delete from the collection where we found it
			try {
				if (item) {
					await pb.collection('ticket_items_collection').delete(id);
				}
			} catch (deleteError) {
				console.warn('Failed to delete from ticket_items_collection, trying ticket_items:', deleteError);
				try {
					await pb.collection('ticket_items').delete(id);
				} catch (fallbackDeleteError) {
					console.error('Failed to delete from both collections:', fallbackDeleteError);
				}
			}
			
			// Always update local state regardless
			ticketItems.update(items => items.filter(item => item.id !== id));
			
			// Update ticket totals if we have a ticket ID
			if (ticketId) {
				await this.recalculateTicketTotals(ticketId);
			}
		} catch (error) {
			console.error('Error removing ticket item:', error);
			// Don't throw the error, just log it and update local state
			ticketItems.update(items => items.filter(item => item.id !== id));
		}
	},

	async recalculateTicketTotals(ticketId) {
		try {
			const items = await pb.collection('ticket_items_collection').getFullList({
				filter: `ticket_id="${ticketId}"`
			});
			
			const subtotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
			const taxRate = 0.09; // 9% tax rate
			const taxAmount = subtotal * taxRate;
			const totalAmount = subtotal + taxAmount;
			
			return await this.updateTicket(ticketId, {
				subtotal_amount: subtotal,
				tax_amount: taxAmount,
				total_amount: totalAmount
			});
		} catch (error) {
			console.error('Error recalculating ticket totals:', error);
			throw error;
		}
	},

	// Completed Orders
	async getCompletedOrders() {
		try {
			loading.update(state => ({ ...state, completedOrders: true }));
			const records = await pb.collection('completed_orders').getFullList({
				sort: '-completed_at',
				expand: 'table_id,server_id'
			});
			completedOrders.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching completed orders:', error);
			throw error;
		} finally {
			loading.update(state => ({ ...state, completedOrders: false }));
		}
	},

	async createCompletedOrder(data) {
		try {
			const record = await pb.collection('completed_orders').create(data);
			completedOrders.update(items => [record, ...items]);
			return record;
		} catch (error) {
			console.error('Error creating completed order:', error);
			throw error;
		}
	},

	async createPayment(data) {
		try {
			const record = await pb.collection('payments').create(data);
			console.log('Payment record created:', record);
			return record;
		} catch (error) {
			console.error('Error creating payment record:', error);
			throw error;
		}
	},

	// Spoils (returned/wasted items)
	async getSpoils() {
		try {
			loading.update((s) => ({ ...s, spoils: true }));
			const records = await pb.collection('spoils').getFullList({
				sort: '-created',
				expand: 'ticket_item_id,ticket_id,menu_item_id,user_id,staff_id'
			});
			spoils.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching spoils:', error);
			throw error;
		} finally {
			loading.update((s) => ({ ...s, spoils: false }));
		}
	},
	async updateSpoil(id, data) {
		try {
			const record = await pb.collection('spoils').update(id, data);
			spoils.update(list => list.map(s => s.id === id ? record : s));
			return record;
		} catch (error) {
			console.error('Error updating spoil:', error);
			throw error;
		}
	},
	async createSpoil({
		ticketItemId,
		ticketId,
		menuItemId,
		userId,
		staffId = null,
		quantity = 1,
		spoilType = 'returned',
		source = 'bar',
		status = 'open',
		reasonText = '',
		costEstimate = null,
		occurredAt = null,
		metadata = null
	}) {
		try {
			const isoOccurred = occurredAt ? new Date(occurredAt).toISOString() : undefined;
			const data = {
				ticket_item_id: ticketItemId,
				ticket_id: ticketId || undefined,
				menu_item_id: menuItemId || undefined,
				user_id: userId,
				staff_id: staffId || undefined,
				quantity_field: Number(quantity),
				spoil_type: spoilType,
				source: source,
				status: status,
				reason_text: reasonText || undefined,
				cost_estimate: costEstimate != null ? Number(costEstimate) : undefined,
				occurred_at: isoOccurred,
				metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : undefined
			};
			console.log('🧪 Spoils create json data:', data);
			const record = await pb.collection('spoils').create(data);
			spoils.update(items => [record, ...items]);
			return record;
		} catch (error) {
			try { console.error('Error creating spoil record:', error?.data || error); } catch {}
			throw error;
		}
	},

	// Schedule Proposals
	async getScheduleProposals() {
		try {
			loading.update(s => ({ ...s, scheduleProposals: true }));
			const records = await pb.collection('schedule_proposals').getFullList({ sort: '-created' }).catch(() => []);
			scheduleProposals.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching schedule proposals:', error);
			throw error;
		} finally {
			loading.update(s => ({ ...s, scheduleProposals: false }));
		}
	}
};
