<script lang="ts">
	import { Moon, Sun } from 'lucide-svelte';
	import { theme, toggleTheme } from '$lib/stores/themeStore';
</script>

<button
	class="p-2 rounded-md bg-gray-700/50 text-gray-200 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
	on:click={toggleTheme}
	aria-label="Toggle theme"
>
	{#if $theme === 'dark'}
		<Sun class="w-5 h-5" />
	{:else}
		<Moon class="w-5 h-5" />
	{/if}
</button>