import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		// n8n loads the CommonJS build of n8n-workflow (the compiled node is CommonJS),
		// so the tests use the same build.
		alias: {
			'n8n-workflow': fileURLToPath(
				new URL('./node_modules/n8n-workflow/dist/cjs/index.js', import.meta.url),
			),
		},
	},
	test: {
		include: ['test/**/*.test.ts'],
	},
});
