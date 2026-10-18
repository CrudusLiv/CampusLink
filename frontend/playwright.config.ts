import { defineConfig } from '@playwright/test';

// Browser tests for use case 3 (scheduling and upcoming sessions). Run with: npm run test:e2e
// Needs CL_EMAIL and CL_PW in the environment (a test account). They are never stored in the repo.
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 120_000,
  workers: 1, // the cases share one database and some of them book real sessions, so run them in order
  reporter: [['list']],
  outputDir: 'tests/e2e/.output',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 1280, height: 720 },
  },
  // Start the app if it is not already running.
  webServer: {
    command: 'npm run dev',
    url: process.env.BASE_URL ?? 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
