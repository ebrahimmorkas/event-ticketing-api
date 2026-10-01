import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run the real API (port 3000) against a seeded database and
 * the production build of the client served by `vite preview` (port 4173).
 * Set E2E_SKIP_SERVERS=1 when both are already running.
 */
const skipServers = process.env.E2E_SKIP_SERVERS === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: skipServers
    ? undefined
    : [
        {
          command: 'npm start',
          cwd: '..',
          url: 'http://localhost:3000/health',
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          command: 'npm run preview',
          url: 'http://localhost:4173',
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ],
});
