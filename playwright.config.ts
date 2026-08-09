import { defineConfig, devices } from '@playwright/test';

const baseUrl = process.env.ECF_CALC_URL
  || process.env.CALCULATOR_URL
  || process.env.BASE_URL
  || 'http://localhost:8000';

function normalizeBasePath(url: string): string {
  try {
    return new URL(url).toString().replace(/\/$/, '');
  } catch (_error) {
    return 'http://localhost:8000';
  }
}

export default defineConfig({
  testDir: './tests/e2e',
  workers: process.env.CI ? 1 : undefined,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  outputDir: 'test-results',
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: normalizeBasePath(baseUrl),
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: ['--disable-dev-shm-usage'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
    },
  ],
});
