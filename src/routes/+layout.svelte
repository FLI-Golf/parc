<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { setTheme } from '$lib/stores/themeStore';
	
	let { children } = $props();
	
	// Initialize theme on mount
	onMount(() => {
		const storedTheme = localStorage.getItem('theme');
		if (storedTheme === 'light' || storedTheme === 'dark') {
			setTheme(storedTheme);
		} else {
			// Default to dark theme
			setTheme('dark');
		}
	});
</script>

{#if children}
	{@render children()}
{/if}
