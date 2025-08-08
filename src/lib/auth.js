import pb from './pocketbase.js';
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Create auth store with server-safe initial state
export const authStore = writable({
	isLoggedIn: false,
	user: null,
	role: null,
	isLoading: true // Always start as loading to prevent race conditions
});

// Initialize auth store from PocketBase
if (browser) {
	pb.authStore.onChange((auth) => {
		authStore.update(() => ({
			isLoggedIn: !!auth,
			user: auth?.record || null,
			role: auth?.record?.role || null,
			isLoading: false
		}));
	});

	// Initial load - check if PocketBase already has valid auth
	const initialAuth = pb.authStore.isValid;
	authStore.update(() => ({
		isLoggedIn: initialAuth,
		user: initialAuth ? pb.authStore.model : null,
		role: initialAuth ? (pb.authStore.model?.role || null) : null,
		isLoading: false
	}));
}

// Import role utilities
import { hasAdminAccess, hasStaffAccess, hasKitchenAccess, getPermissionLevel } from './types/roles.js';

// Derived stores for role checking
export const isManager = derived(authStore, ($auth) => $auth.role === 'manager' || $auth.role === 'owner');
export const isServer = derived(authStore, ($auth) => $auth.role === 'server');
export const hasAdmin = derived(authStore, ($auth) => $auth.role ? hasAdminAccess($auth.role) : false);
export const hasStaff = derived(authStore, ($auth) => $auth.role ? hasStaffAccess($auth.role) : false);
export const hasKitchen = derived(authStore, ($auth) => $auth.role ? hasKitchenAccess($auth.role) : false);

// Auth functions
export const auth = {
	async login(email, password) {
		try {
			const authData = await pb.collection('users').authWithPassword(email, password);
			return { success: true, user: authData.record };
		} catch (error) {
			console.error('Login error:', error);
			return { success: false, error: error.message };
		}
	},

	async logout() {
		pb.authStore.clear();
	},

	async register(userData) {
		try {
			const user = await pb.collection('users').create(userData);
			return { success: true, user };
		} catch (error) {
			console.error('Registration error:', error);
			return { success: false, error: error.message };
		}
	},

	// Check if user has required role
	hasRole(requiredRole) {
		const currentUser = pb.authStore.model;
		return currentUser?.role === requiredRole;
	},

	// Check if user is authenticated and has one of the specified roles
	hasAnyRole(roles = []) {
		const currentUser = pb.authStore.model;
		return pb.authStore.isValid && roles.includes(currentUser?.role);
	}
};
