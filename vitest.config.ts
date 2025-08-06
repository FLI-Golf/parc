import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    include: ['src/tests/**/*.{test,spec}.{js,ts}'],
    globals: true,
    setupFiles: ['./src/test-setup.ts']
  }
});
