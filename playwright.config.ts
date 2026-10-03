import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.{ts,js}',
	webServer: {
		// CI builds in an earlier step.
		command: process.env.CI ? 'npm run preview' : 'npm run build && npm run preview',
		port: 4173,
		timeout: 300_000,
		reuseExistingServer: !process.env.CI,
		env: { SVOCS_OG: '0' }
	}
});
