import { validateEnvironment } from './environment';

const productionEnvironment = {
  NODE_ENV: 'production', DATABASE_URL: 'postgresql://user:pass@db/vazano', REDIS_URL: 'redis://redis:6379', WEB_ORIGIN: 'https://vazano.ir',
  OTP_PEPPER: '01234567890123456789012345678901', OTP_DEBUG_ENABLED: 'false', SMS_PROVIDER: 'smsir',
  SMSIR_API_KEY: '0123456789012345', SMSIR_TEMPLATE_ID: '961076', FILE_SCAN_MODE: 'clamav',
  CLAMAV_HOST: 'clamav', CLAMAV_PORT: '3310', CLAMAV_TIMEOUT_MS: '15000',
  S3_ENDPOINT: 'https://storage.vazano.ir', S3_BUCKET: 'vazano', S3_ACCESS_KEY: 'access-key', S3_SECRET_KEY: '0123456789012345',
  ZARINPAL_ENABLED: 'false', TRUST_PROXY_HOPS: '1', SEED_DEMO_DATA: 'false', SEED_ADMIN_MOBILE: '09120000000',
  NOTIFICATION_WORKER_ENABLED: 'true', NOTIFICATION_WORKER_INTERVAL_MS: '15000',
  SUBSCRIPTION_LIFECYCLE_WORKER_ENABLED: 'true', SUBSCRIPTION_LIFECYCLE_WORKER_INTERVAL_MS: '60000',
  RFQ_LIFECYCLE_WORKER_ENABLED: 'true', RFQ_LIFECYCLE_WORKER_INTERVAL_MS: '60000',
  VAZANO_API_IMAGE: `ghcr.io/vazano/api:${'a'.repeat(40)}`,
  VAZANO_WEB_IMAGE: `ghcr.io/vazano/web:${'a'.repeat(40)}`,
  VAZANO_MIGRATION_IMAGE: `ghcr.io/vazano/migration:${'a'.repeat(40)}`,
  VAZANO_GATEWAY_IMAGE: `nginx@sha256:${'d'.repeat(64)}`,
};

describe('production environment validation', () => {
  it('accepts a safe production baseline', () => {
    expect(validateEnvironment({ ...productionEnvironment })).toEqual(productionEnvironment);
  });

  it.each([
    ['OTP_DEBUG_ENABLED', 'true'],
    ['SMS_PROVIDER', 'debug'],
    ['FILE_SCAN_MODE', 'pending'],
    ['WEB_ORIGIN', 'http://vazano.ir'],
    ['SEED_DEMO_DATA', 'true'],
    ['TRUST_PROXY_HOPS', '0'],
    ['SEED_ADMIN_MOBILE', '02100000000'],
    ['NOTIFICATION_WORKER_ENABLED', 'false'],
    ['SUBSCRIPTION_LIFECYCLE_WORKER_ENABLED', 'false'],
    ['RFQ_LIFECYCLE_WORKER_ENABLED', 'false'],
    ['NOTIFICATION_WORKER_INTERVAL_MS', '0'],
  ])('rejects unsafe %s', (key, value) => {
    expect(() => validateEnvironment({ ...productionEnvironment, [key]: value })).toThrow();
  });

  it('requires a secure public callback URL when live payments are enabled', () => {
    expect(() => validateEnvironment({ ...productionEnvironment, ZARINPAL_ENABLED: 'true', ZARINPAL_SANDBOX: 'false', ZARINPAL_MERCHANT_ID: 'merchant-identifier', PUBLIC_API_URL: 'http://api.vazano.ir' })).toThrow(/PUBLIC_API_URL/);
  });

  it.each([
    'https://vazano.ir/admin',
    'https://user:password@vazano.ir',
    'https://vazano.ir?source=production',
    'https://vazano.ir#fragment',
  ])('rejects WEB_ORIGIN values that are not an exact origin: %s', (value) => {
    expect(() => validateEnvironment({ ...productionEnvironment, WEB_ORIGIN: value })).toThrow(/WEB_ORIGIN/);
  });

  it('rejects a payment callback base URL with a path', () => {
    expect(() => validateEnvironment({
      ...productionEnvironment,
      ZARINPAL_ENABLED: 'true',
      ZARINPAL_SANDBOX: 'false',
      ZARINPAL_MERCHANT_ID: 'merchant-identifier',
      PUBLIC_API_URL: 'https://vazano.ir/api',
    })).toThrow(/PUBLIC_API_URL/);
  });

  it('rejects sandbox payments when live payments are enabled', () => {
    expect(() => validateEnvironment({ ...productionEnvironment, ZARINPAL_ENABLED: 'true', ZARINPAL_SANDBOX: 'true', ZARINPAL_MERCHANT_ID: 'merchant-identifier', PUBLIC_API_URL: 'https://vazano.ir' })).toThrow(/ZARINPAL_SANDBOX/);
  });

  it.each(['DATABASE_URL', 'OTP_PEPPER', 'SMSIR_API_KEY', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'])('rejects placeholder production value for %s', (key) => {
    expect(() => validateEnvironment({ ...productionEnvironment, [key]: 'replace_with_real_secret_value_123456' })).toThrow(/placeholder/);
  });

  it('rejects the mock payment provider in production', () => {
    expect(() => validateEnvironment({ ...productionEnvironment, PAYMENT_PROVIDER: 'mock' })).toThrow(/Mock payment provider/);
  });

  it.each([
    ['VAZANO_API_IMAGE', 'ghcr.io/vazano/api:latest'],
    ['VAZANO_WEB_IMAGE', 'ghcr.io/vazano/web:v1.0.0'],
    ['VAZANO_MIGRATION_IMAGE', 'ghcr.io/your-org/vazano-migration:replace-with-git-sha'],
    ['VAZANO_GATEWAY_IMAGE', 'nginx:1.27.4-alpine'],
  ])('rejects mutable production image reference for %s', (key, value) => {
    expect(() => validateEnvironment({ ...productionEnvironment, [key]: value })).toThrow();
  });

  it('rejects application images built from different Git commits', () => {
    expect(() => validateEnvironment({
      ...productionEnvironment,
      VAZANO_WEB_IMAGE: `ghcr.io/vazano/web:${'e'.repeat(40)}`,
    })).toThrow(/same Git commit/);
  });

  it('rejects mixed Git SHA tags and image digests', () => {
    expect(() => validateEnvironment({
      ...productionEnvironment,
      VAZANO_WEB_IMAGE: `ghcr.io/vazano/web@sha256:${'e'.repeat(64)}`,
    })).toThrow(/mixed reference styles/);
  });

  it('accepts digest-pinned application images', () => {
    expect(() => validateEnvironment({
      ...productionEnvironment,
      VAZANO_API_IMAGE: `ghcr.io/vazano/api@sha256:${'a'.repeat(64)}`,
      VAZANO_WEB_IMAGE: `ghcr.io/vazano/web@sha256:${'b'.repeat(64)}`,
      VAZANO_MIGRATION_IMAGE: `ghcr.io/vazano/migration@sha256:${'c'.repeat(64)}`,
    })).not.toThrow();
  });

  it('requires every renewal template before subscription SMS is enabled', () => {
    expect(() => validateEnvironment({ ...productionEnvironment, SUBSCRIPTION_SMS_ENABLED: 'true' })).toThrow(/SMSIR_SUBSCRIPTION_RENEWAL_14_TEMPLATE_ID/);
  });
});
