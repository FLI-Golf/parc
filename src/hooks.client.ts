import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = ({ error, event }) => {
	console.error('Client error:', error, event);
	return {
		message: 'An error occurred. Please try again.'
	};
};