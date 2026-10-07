import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome' },
    },
  ],
  webServer: [
    {
      command: 'npm run start:e2e:api',
      url: 'http://localhost:3001/v1/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        SMS_PROVIDER: 'debug',
        OTP_DEBUG_ENABLED: 'true',
        OTP_DEBUG_CODE: '11111',
        NOTIFICATION_WORKER_ENABLED: 'false',
        SUBSCRIPTION_LIFECYCLE_WORKER_ENABLED: 'false',
      },
    },
    {
      command: 'npm run dev:web',
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
