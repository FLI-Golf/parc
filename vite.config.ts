import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	return {
		plugins: [tailwindcss(), sveltekit()],

		server: {
			host: '0.0.0.0',
			port: 5173,
			allowedHosts: [
				'5173--019a9857-b95f-781b-82c4-d54c7e3abd33.us-east-1-01.gitpod.dev'
			]
		},
		build: {
			rollupOptions: {
				output: {
					entryFileNames: 'assets/[name].[hash].js',
					chunkFileNames: 'assets/[name].[hash].js',
					assetFileNames: 'assets/[name].[hash].[ext]'
				}
			}
		}
	};
});
