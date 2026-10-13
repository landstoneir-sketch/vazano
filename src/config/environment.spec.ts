import { validateEnvironment } from './environment';

const productionEnvironment = {
  NODE_ENV: 'production', DATABASE_URL: 'postgresql://user:pass@db/vazano', WEB_ORIGIN: 'https://vazano.ir',
  OTP_PEPPER: '01234567890123456789012345678901', OTP_DEBUG_ENABLED: 'false', SMS_PROVIDER: 'smsir',
  SMSIR_API_KEY: '0123456789012345', SMSIR_TEMPLATE_ID: '961076', FILE_SCAN_MODE: 'clamav',
  CLAMAV_HOST: 'clamav', CLAMAV_PORT: '3310', CLAMAV_TIMEOUT_MS: '15000',
  S3_ENDPOINT: 'https://storage.vazano.ir', S3_BUCKET: 'vazano', S3_ACCESS_KEY: 'access-key', S3_SECRET_KEY: '0123456789012345',
  ZARINPAL_ENABLED: 'false', TRUST_PROXY_HOPS: '1', SEED_DEMO_DATA: 'false',
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
  ])('rejects unsafe %s', (key, value) => {
    expect(() => validateEnvironment({ ...productionEnvironment, [key]: value })).toThrow();
  });

  it('requires a secure public callback URL when live payments are enabled', () => {
    expect(() => validateEnvironment({ ...productionEnvironment, ZARINPAL_ENABLED: 'true', ZARINPAL_SANDBOX: 'false', ZARINPAL_MERCHANT_ID: 'merchant-identifier', PUBLIC_API_URL: 'http://api.vazano.ir' })).toThrow(/PUBLIC_API_URL/);
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

  it('requires every renewal template before subscription SMS is enabled', () => {
    expect(() => validateEnvironment({ ...productionEnvironment, SUBSCRIPTION_SMS_ENABLED: 'true' })).toThrow(/SMSIR_SUBSCRIPTION_RENEWAL_14_TEMPLATE_ID/);
  });
});
