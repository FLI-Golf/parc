import { fail, redirect } from '@sveltejs/kit';
import pb from '$lib/pocketbase';
import type { RequestEvent } from '@sveltejs/kit';

export const load = async () => {
	return {};
};

export const actions = {
	default: async ({ request }: RequestEvent) => {
		// Initialize userData outside try block to avoid reference errors
		let userData: any = {};
		
		try {
			// Check if request is JSON or form data
			const contentType = request.headers.get('content-type') || '';
			
			if (contentType.includes('application/json')) {
				// Handle JSON data
				const json = await request.json();
				
				// Simple validation for JSON requests
				if (!json.name || !json.email || !json.password || !json.passwordConfirm) {
					return fail(400, {
						error: 'Name, email, password, and password confirmation are required'
					});
				}
				
				if (json.password !== json.passwordConfirm) {
					return fail(400, {
						error: 'Password and password confirmation do not match'
					});
				}
				
				userData = {
					name: json.name,
					email: json.email,
					emailVisibility: json.emailVisibility !== undefined ? json.emailVisibility : true,
					password: json.password,
					passwordConfirm: json.passwordConfirm,
					role: json.role || 'manager'
				};
				
				// Add optional fields if provided and not empty
				if (json.username && json.username.trim()) {
					// Clean username: remove spaces, convert to lowercase, alphanumeric only
					const cleanUsername = json.username.trim().replace(/\s+/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
					if (cleanUsername) userData.username = cleanUsername;
				}
				if (json.phone && json.phone.trim()) userData.phone = json.phone.trim();
				
				// Handle avatar if provided as base64 string
				if (json.avatar) {
					// For simplicity, we'll skip file handling for JSON requests
					// In a real app, you might want to handle base64 image data
				}
			} else {
				// Handle form data (multipart/form-data)
				const data = await request.formData();
				
				const name = data.get('name') as string | null;
				const username = data.get('username') as string | null;
				const email = data.get('email') as string | null;
				const emailVisibility = data.get('emailVisibility');
				const password = data.get('password') as string | null;
				const passwordConfirm = data.get('passwordConfirm') as string | null;
				const phone = data.get('phone') as string | null;
				const role = data.get('role') as string || 'manager';
				const avatar = data.get('avatar');
				
				// Simple validation
				if (!name || !email || !password || !passwordConfirm) {
					return fail(400, {
						error: 'Name, email, password, and password confirmation are required',
						name: name || '',
						email: email || '',
						username: username || '',
						phone: phone || '',
						role: 'manager'
					});
				}
				
				if (password !== passwordConfirm) {
					return fail(400, {
						error: 'Password and password confirmation do not match',
						name: name || '',
						email: email || '',
						username: username || '',
						phone: phone || '',
						role: 'manager'
					});
				}
				
				userData = {
					name,
					email,
					password,
					passwordConfirm,
					role,
				};
				
				// Add optional fields if provided
				if (username && username.trim()) {
					// Clean username: remove spaces, convert to lowercase, alphanumeric only
					const cleanUsername = username.trim().replace(/\s+/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
					if (cleanUsername) userData.username = cleanUsername;
				}
				if (phone && phone.trim()) userData.phone = phone.trim();
				if (emailVisibility !== null) userData.emailVisibility = emailVisibility === 'true';
				
				// Handle avatar file if provided
				if (avatar instanceof File && avatar.size > 0) {
					userData.avatar = avatar;
				}
			}
			
			// Set default role to valid value if not provided
			if (!userData.role) {
				userData.role = 'manager';
			}
			
			console.log('Attempting to create user with data:', userData);
			console.log('PocketBase URL:', pb.baseUrl);
			
			// Create user in PocketBase
			const record = await pb.collection('users').create(userData);
			console.log('User created in PocketBase:', record);
			
			// Automatically log the user in after successful registration
			try {
				await pb.collection('users').authWithPassword(userData.email, userData.password);
				console.log('User automatically logged in after registration');
			} catch (loginError) {
				console.error('Failed to auto-login after registration:', loginError);
				// Don't fail the registration if auto-login fails
			}
			
			// Redirect to dashboard like login does
			throw redirect(302, '/dashboard');
		} catch (error: any) {
			// Check if this is a redirect (which is expected behavior, not an error)
			if (error?.status === 302) {
				throw error; // Re-throw the redirect to let SvelteKit handle it
			}
			
			console.error('Error creating user in PocketBase:', error);
			console.error('Error response data:', JSON.stringify(error.response?.data, null, 2));
			
			// Return a more detailed error message
			const errorMessage = error.response?.data?.message || error.message || 'Failed to register user. Please try again.';
			
			// Check if it's a validation error
			if (error.response?.data?.data) {
				const fieldErrors = error.response.data.data;
				let errorMessages = [];
				
				// Format field-specific errors
				for (const [field, messages] of Object.entries(fieldErrors)) {
					if (Array.isArray(messages)) {
						errorMessages.push(`${field}: ${messages.join(', ')}`);
					} else if (typeof messages === 'object' && messages !== null) {
						// Handle object errors like { code: 'validation_invalid_email', message: 'The email is invalid or already in use.' }
						if ('message' in messages) {
							errorMessages.push(`${field}: ${messages.message}`);
						} else {
							errorMessages.push(`${field}: ${JSON.stringify(messages)}`);
						}
					}
				}
				
				if (errorMessages.length > 0) {
					return fail(400, {
						error: errorMessages.join('; '),
						// Preserve form data for re-submission
						name: userData.name || '',
						email: userData.email || '',
						username: userData.username || '',
						phone: userData.phone || '',
						role: userData.role || 'manager'
					});
				}
			}
			
			// Handle direct field errors (like the email error we're seeing)
			if (error.response?.data && typeof error.response.data === 'object') {
				const fieldErrors = error.response.data;
				let errorMessages = [];
				
				// Check for field-specific errors at the top level
				for (const [field, messages] of Object.entries(fieldErrors)) {
					if (field !== 'code' && field !== 'message') {
						if (typeof messages === 'object' && messages !== null && 'message' in messages) {
							errorMessages.push(`${field}: ${messages.message}`);
						}
					}
				}
				
				if (errorMessages.length > 0) {
					return fail(400, {
						error: errorMessages.join('; '),
						// Preserve form data for re-submission
						name: userData.name || '',
						email: userData.email || '',
						username: userData.username || '',
						phone: userData.phone || '',
						role: userData.role || 'manager'
					});
				}
			}
			
			return fail(500, {
				error: errorMessage,
				// Preserve form data for re-submission
				name: userData.name || '',
				email: userData.email || '',
				username: userData.username || '',
				phone: userData.phone || '',
				role: userData.role || 'manager'
			});
		}
	}
};
