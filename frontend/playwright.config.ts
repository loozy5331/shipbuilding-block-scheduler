import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5179', headless: true, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } },
  webServer: { command: 'npx vite --port 5179 --strictPort', env: { AUTH_DB: fileURLToPath(new URL('test-results/users.db', import.meta.url)), API_PORT: '8179' }, url: 'http://localhost:5179', reuseExistingServer: true },
});
