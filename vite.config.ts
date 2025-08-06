import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	return {
		plugins: [tailwindcss(), sveltekit()],
		define: {
			'process.env': env
		},
		server: {
			allowedHosts: [
				'5173-fligolf-parc-lygafhjmw8u.ws-us120.gitpod.io'
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
