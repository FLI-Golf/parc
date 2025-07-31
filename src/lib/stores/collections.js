import { writable } from 'svelte/store';
import pb from '../pocketbase.js';

// Collection stores
export const inventoryItems = writable([]);
export const staff = writable([]);
export const shifts = writable([]);
export const menuItems = writable([]);
export const vendors = writable([]);
export const events = writable([]);

// Loading states
export const loading = writable({
	inventory: false,
	staff: false,
	shifts: false,
	menu: false,
	vendors: false,
	events: false
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
				expand: 'staff_member'
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
			shifts.update(items => [...items, record]);
			return record;
		} catch (error) {
			console.error('Error creating shift:', error);
			throw error;
		}
	},

	async updateShift(id, data) {
		try {
			const record = await pb.collection('shifts_collection').update(id, data);
			shifts.update(items => 
				items.map(item => item.id === id ? record : item)
			);
			return record;
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
	}
};
