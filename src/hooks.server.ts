import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Continue with the request
	const response = await resolve(event);
	return response;
};