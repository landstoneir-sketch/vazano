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
    baseURL: 'http://localhost:3100',
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
      url: 'http://localhost:3101/v1/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        SMS_PROVIDER: 'debug',
        API_PORT: '3101',
        PUBLIC_API_URL: 'http://localhost:3101',
        WEB_ORIGIN: 'http://localhost:3100',
        OTP_DEBUG_ENABLED: 'true',
        OTP_DEBUG_CODE: '11111',
        NOTIFICATION_WORKER_ENABLED: 'false',
        SUBSCRIPTION_LIFECYCLE_WORKER_ENABLED: 'false',
        PAYMENT_PROVIDER: 'mock',
      },
    },
    {
      command: 'npm run start:e2e:web',
      url: 'http://localhost:3100',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3101/v1',
        API_INTERNAL_URL: 'http://localhost:3101/v1',
      },
    },
  ],
});
