import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5179', headless: true, viewport: { width: 1440, height: 1000 } },
  webServer: { command: 'npx vite --port 5179 --strictPort', url: 'http://localhost:5179', reuseExistingServer: true },
});
