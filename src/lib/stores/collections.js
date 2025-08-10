import { writable } from 'svelte/store';
import pb from '../pocketbase.js';

// Collection stores
export const inventoryItems = writable([]);
export const staff = writable([]);
export const shifts = writable([]);
export const menuItems = writable([]);
export const menuCategories = writable([]);
export const menuModifiers = writable([]);
export const vendors = writable([]);
export const events = writable([]);
export const maintenanceTasks = writable([]);
export const maintenanceSchedules = writable([]);
export const maintenanceRecords = writable([]);
export const sections = writable([]);
export const tables = writable([]);
export const tableUpdates = writable([]);
export const tickets = writable([]);
export const ticketItems = writable([]);
export const payments = writable([]);
export const completedOrders = writable([]);
export const spoils = writable([]);

// Loading states
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
	ticketItems: false,
	payments: false,
	completedOrders: false,
		spoils: false
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
			const records = await pb.collection('shifts_collection').getFullList({
				expand: 'staff_member,assigned_section'
			});
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
			const record = await pb.collection('shifts_collection').create(data);
			// Fetch the record with expanded relations
			const expandedRecord = await pb.collection('shifts_collection').getOne(record.id, {
				expand: 'staff_member,assigned_section'
			});
			shifts.update(items => [...items, expandedRecord]);
			return expandedRecord;
		} catch (error) {
			console.error('Error creating shift:', error);
			throw error;
		}
	},

	async updateShift(id, data) {
		try {
			console.log('updateShift called with:', { id, data });
			const record = await pb.collection('shifts_collection').update(id, data);
			console.log('Update response:', record);
			// Fetch the record with expanded relations
			const expandedRecord = await pb.collection('shifts_collection').getOne(id, {
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
			const records = await pb.collection('table_updates_collection').getFullList({
				sort: '-created'
			});
			tableUpdates.set(records);
			return records;
		} catch (error) {
			console.error('Error fetching table updates:', error);
			throw error;
		} finally {
			loading.update(state => ({ ...state, tableUpdates: false }));
		}
	},

	async createTableUpdate(data) {
		try {
			const record = await pb.collection('table_updates_collection').create(data);
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
		metadata = null,
		audioBlob = null
	}) {
		try {
			const form = new FormData();
			form.append('ticket_item_id', ticketItemId);
			if (ticketId) form.append('ticket_id', ticketId);
			if (menuItemId) form.append('menu_item_id', menuItemId);
			if (userId) form.append('user_id', userId);
			if (staffId) form.append('staff_id', staffId);
			form.append('quantity_field', String(quantity));
			form.append('spoil_type', spoilType);
			form.append('source', source);
			form.append('status', status);
			if (reasonText) form.append('reason_text', reasonText);
			if (costEstimate != null) form.append('cost_estimate', String(costEstimate));
			if (occurredAt) {
				// Normalize to ISO string with Z
				try {
					const ts = new Date(occurredAt).toISOString();
					form.append('occurred_at', ts);
				} catch {}
			}
			if (metadata) form.append('metadata', typeof metadata === 'string' ? metadata : JSON.stringify(metadata));
			if (audioBlob && typeof audioBlob === 'object' && 'size' in audioBlob && audioBlob.size > 0) {
				const mime = audioBlob.type || 'audio/webm';
				const file = new File([audioBlob], 'spoil-reason.webm', { type: mime });
				form.append('attachments', file);
			}
			// Debug: log form entries
			try {
				const debug = {};
				for (const [k, v] of form.entries()) {
					debug[k] = v instanceof File ? `{File:${v.name}, type=${v.type}, size=${v.size}}` : v;
				}
				console.log('🧪 Spoils create form data:', debug);
			} catch {}
			const record = await pb.collection('spoils').create(form);
			spoils.update(items => [record, ...items]);
			return record;
		} catch (error) {
			// Surface PocketBase validation errors
			try { console.error('Error creating spoil record:', error?.data || error); } catch {}
			throw error;
		}
	}
};
