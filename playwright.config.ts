import { defineConfig, devices } from '@playwright/test';
function resolveE2eDatabaseUrl(): string {
  const configured = process.env.E2E_DATABASE_URL
    ?? 'postgresql://vazano:vazano_local_only@127.0.0.1:55432/vazano?schema=public';
  const parsed = new URL(configured);
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error('E2E_DATABASE_URL باید به دیتابیس محلی و ایزوله اشاره کند.');
  }
  parsed.hostname = '127.0.0.1';
  return parsed.toString();
}

const e2eDatabaseUrl = resolveE2eDatabaseUrl();
process.env.DATABASE_URL = e2eDatabaseUrl;

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
        DATABASE_URL: e2eDatabaseUrl,
        API_PORT: '3101',
        PUBLIC_API_URL: 'http://localhost:3101',
        WEB_ORIGIN: 'http://localhost:3100',
        OTP_DEBUG_ENABLED: 'true',
        OTP_DEBUG_CODE: '11111',
        NOTIFICATION_WORKER_ENABLED: 'false',
        SUBSCRIPTION_LIFECYCLE_WORKER_ENABLED: 'false',
        RFQ_LIFECYCLE_WORKER_ENABLED: 'false',
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
        NEXT_DIST_DIR: '.next-e2e',
      },
    },
  ],
});
