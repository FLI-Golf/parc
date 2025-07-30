import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		allowedHosts: [
			'5173-fligolf-parc-15dhzmo1ieo.ws-us120.gitpod.io'
		]
	}
});
