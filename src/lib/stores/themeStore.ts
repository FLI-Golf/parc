import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Define the theme type
export type Theme = 'light' | 'dark';

// Create a writable store with the initial theme
// Check if there's a saved theme in localStorage, otherwise default to 'dark'
const storedTheme = browser ? localStorage.getItem('theme') as Theme : 'dark';
const initialTheme: Theme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark';

// Create the theme store
export const theme = writable<Theme>(initialTheme);

// Function to toggle the theme
export function toggleTheme() {
	if (!browser) return;
	
	theme.update(currentTheme => {
		const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
		localStorage.setItem('theme', newTheme);
		document.documentElement.classList.toggle('dark', newTheme === 'dark');
		return newTheme;
	});
}

// Function to set the theme
export function setTheme(newTheme: Theme) {
	if (!browser) return;
	
	theme.set(newTheme);
	localStorage.setItem('theme', newTheme);
	document.documentElement.classList.toggle('dark', newTheme === 'dark');
}

// Initialize the theme on load
if (browser) {
	document.documentElement.classList.toggle('dark', initialTheme === 'dark');
}