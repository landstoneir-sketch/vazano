type Environment = Record<string, string | undefined>;

export function validateEnvironment(environment: Environment): Environment {
  const nodeEnv = environment.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV must be development, test or production.');
  requireValue(environment, 'DATABASE_URL');
  requireUrl(environment, 'WEB_ORIGIN');
  requireValue(environment, 'OTP_PEPPER', 32);
  if (environment.OTP_IP_REQUESTS_PER_MINUTE) requirePositiveInteger(environment, 'OTP_IP_REQUESTS_PER_MINUTE');
  const paymentProvider = environment.PAYMENT_PROVIDER ?? 'zarinpal';
  const smsProvider = environment.SMS_PROVIDER ?? 'debug';
  if (!['zarinpal', 'mock'].includes(paymentProvider)) throw new Error('PAYMENT_PROVIDER must be zarinpal or mock.');
  if (environment.SUBSCRIPTION_SMS_ENABLED === 'true' && smsProvider === 'smsir') {
    for (const key of [
      'SMSIR_SUBSCRIPTION_RENEWAL_14_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_RENEWAL_7_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_RENEWAL_3_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_EXPIRED_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_GRACE_ENDED_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_TRIAL_7_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_TRIAL_3_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_TRIAL_1_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_TRIAL_ENDED_TEMPLATE_ID',
    ]) requirePositiveInteger(environment, key);
  }

  if (nodeEnv === 'production') {
    assertNotPlaceholder('DATABASE_URL', environment.DATABASE_URL!);
    const webOrigin = new URL(environment.WEB_ORIGIN!);
    if (webOrigin.protocol !== 'https:') throw new Error('WEB_ORIGIN must use HTTPS in production.');
    if (environment.OTP_DEBUG_ENABLED === 'true') throw new Error('OTP debug mode must be disabled in production.');
    if (environment.SEED_DEMO_DATA === 'true') throw new Error('Development demo data must be disabled in production.');
    requirePositiveInteger(environment, 'TRUST_PROXY_HOPS');
    if (smsProvider !== 'smsir') throw new Error('A production SMS provider must be configured.');
    requireProductionSecret(environment, 'OTP_PEPPER', 32);
    requireProductionSecret(environment, 'SMSIR_API_KEY', 16);
    requirePositiveInteger(environment, 'SMSIR_TEMPLATE_ID');
    if (environment.FILE_SCAN_MODE !== 'clamav') throw new Error('FILE_SCAN_MODE must be clamav in production.');
    if (paymentProvider !== 'zarinpal') throw new Error('Mock payment provider must be disabled in production.');
    requireValue(environment, 'CLAMAV_HOST');
    requirePositiveInteger(environment, 'CLAMAV_PORT');
    requirePositiveInteger(environment, 'CLAMAV_TIMEOUT_MS');
    requireValue(environment, 'S3_ENDPOINT');
    requireValue(environment, 'S3_BUCKET');
    requireProductionSecret(environment, 'S3_ACCESS_KEY');
    requireProductionSecret(environment, 'S3_SECRET_KEY', 16);
    if (environment.ZARINPAL_ENABLED === 'true') {
      if (environment.ZARINPAL_SANDBOX !== 'false') throw new Error('ZARINPAL_SANDBOX must be disabled when production payments are enabled.');
      requireProductionSecret(environment, 'ZARINPAL_MERCHANT_ID', 16);
      const publicApiUrl = requireUrl(environment, 'PUBLIC_API_URL');
      if (publicApiUrl.protocol !== 'https:') throw new Error('PUBLIC_API_URL must use HTTPS when production payments are enabled.');
    }
  }

  return environment;
}

function requireValue(environment: Environment, key: string, minimumLength = 1): string {
  const value = environment[key]?.trim();
  if (!value || value.length < minimumLength) throw new Error(`${key} is required and must contain at least ${minimumLength} characters.`);
  return value;
}

function requireUrl(environment: Environment, key: string): URL {
  const value = requireValue(environment, key);
  try { return new URL(value); }
  catch { throw new Error(`${key} must be a valid absolute URL.`); }
}

function requirePositiveInteger(environment: Environment, key: string): number {
  const value = Number(requireValue(environment, key));
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${key} must be a positive integer.`);
  return value;
}

function requireProductionSecret(environment: Environment, key: string, minimumLength = 1): string {
  const value = requireValue(environment, key, minimumLength);
  assertNotPlaceholder(key, value);
  return value;
}

function assertNotPlaceholder(key: string, value: string): void {
  if (/(?:replace|change[_-]?me|placeholder|example|your[_-])/i.test(value)) {
    throw new Error(`${key} contains a placeholder and must be replaced before production deployment.`);
  }
}
