import { fail } from '@sveltejs/kit';
import pb from '$lib/pocketbase';
import type { RequestEvent } from '@sveltejs/kit';

export const load = async () => {
	return {};
};

export const actions = {
	default: async ({ request }: RequestEvent) => {
		const data = await request.formData();
		
		const name = data.get('name');
		const email = data.get('email');
		
		// Simple validation
		if (!name || !email) {
			return fail(400, {
				error: 'Name and email are required',
				name,
				email
			});
		}
		
		try {
			// Create user in PocketBase
			const userData = {
				name,
				email,
				role: 'Server', // Set default role to Server
				password: 'temporaryPassword123!', // In a real app, you'd want to handle this more securely
				passwordConfirm: 'temporaryPassword123!'
			};
			
			const record = await pb.collection('users').create(userData);
			console.log('User created in PocketBase:', record);
			
			// Return a success message
			return {
				success: true,
				message: 'User registered successfully!'
			};
		} catch (error: any) {
			console.error('Error creating user in PocketBase:', error);
			return fail(500, {
				error: 'Failed to register user. Please try again.',
				name,
				email
			});
		}
	}
};
