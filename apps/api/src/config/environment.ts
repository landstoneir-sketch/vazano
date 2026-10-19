type Environment = Record<string, string | undefined>;

export function validateEnvironment(environment: Environment): Environment {
  const nodeEnv = environment.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV must be development, test or production.');
  requireValue(environment, 'DATABASE_URL');
  requireUrl(environment, 'REDIS_URL');
  requireUrl(environment, 'WEB_ORIGIN');
  requireValue(environment, 'OTP_PEPPER', 32);
  if (environment.OTP_IP_REQUESTS_PER_MINUTE) requirePositiveInteger(environment, 'OTP_IP_REQUESTS_PER_MINUTE');
  for (const key of ['API_RATE_LIMIT_REQUESTS_PER_MINUTE', 'API_MUTATION_RATE_LIMIT_REQUESTS_PER_MINUTE', 'PAYMENT_CALLBACK_RATE_LIMIT_REQUESTS_PER_MINUTE']) {
    if (environment[key]) requirePositiveInteger(environment, key);
  }
  for (const key of ['NOTIFICATION_WORKER_INTERVAL_MS', 'SUBSCRIPTION_LIFECYCLE_WORKER_INTERVAL_MS', 'RFQ_LIFECYCLE_WORKER_INTERVAL_MS']) {
    if (environment[key]) requirePositiveInteger(environment, key);
  }
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
    requireReleaseImage(environment, 'VAZANO_API_IMAGE');
    requireReleaseImage(environment, 'VAZANO_WEB_IMAGE');
    requireReleaseImage(environment, 'VAZANO_MIGRATION_IMAGE');
    requireConsistentApplicationImages(environment);
    requireDigestImage(environment, 'VAZANO_GATEWAY_IMAGE');
    assertNotPlaceholder('DATABASE_URL', environment.DATABASE_URL!);
    assertNotPlaceholder('REDIS_URL', environment.REDIS_URL!);
    requireHttpsOrigin(environment, 'WEB_ORIGIN');
    if (environment.OTP_DEBUG_ENABLED === 'true') throw new Error('OTP debug mode must be disabled in production.');
    if (environment.API_DOCS_ENABLED === 'true') throw new Error('API documentation must be disabled in production.');
    if (environment.SEED_DEMO_DATA === 'true') throw new Error('Development demo data must be disabled in production.');
    for (const key of ['NOTIFICATION_WORKER_ENABLED', 'SUBSCRIPTION_LIFECYCLE_WORKER_ENABLED', 'RFQ_LIFECYCLE_WORKER_ENABLED']) {
      requireEnabled(environment, key);
    }
    for (const key of ['NOTIFICATION_WORKER_INTERVAL_MS', 'SUBSCRIPTION_LIFECYCLE_WORKER_INTERVAL_MS', 'RFQ_LIFECYCLE_WORKER_INTERVAL_MS']) {
      requirePositiveInteger(environment, key);
    }
    requireIranianMobile(environment, 'SEED_ADMIN_MOBILE');
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
      requireHttpsOrigin(environment, 'PUBLIC_API_URL');
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

function requireHttpsOrigin(environment: Environment, key: string): URL {
  const url = requireUrl(environment, key);
  if (url.protocol !== 'https:') throw new Error(`${key} must use HTTPS in production.`);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${key} must be an HTTPS origin without credentials, path, query or fragment.`);
  }
  return url;
}

function requirePositiveInteger(environment: Environment, key: string): number {
  const value = Number(requireValue(environment, key));
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${key} must be a positive integer.`);
  return value;
}

function requireEnabled(environment: Environment, key: string): void {
  if (requireValue(environment, key) !== 'true') throw new Error(`${key} must be explicitly enabled in production.`);
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

function requireIranianMobile(environment: Environment, key: string): string {
  const value = requireValue(environment, key).replace(/[\s()-]/g, '');
  assertNotPlaceholder(key, value);
  const localValue = value.startsWith('+98') ? `0${value.slice(3)}`
    : value.startsWith('0098') ? `0${value.slice(4)}`
      : value.startsWith('98') && value.length === 12 ? `0${value.slice(2)}` : value;
  if (!/^09\d{9}$/.test(localValue)) throw new Error(`${key} must be a valid Iranian mobile number.`);
  return localValue;
}

function requireReleaseImage(environment: Environment, key: string): string {
  const value = requireValue(environment, key);
  assertNotPlaceholder(key, value);
  if (/(?:^|:)latest(?:$|@)/i.test(value)) throw new Error(`${key} must not use the mutable latest tag.`);
  const hasGitShaTag = /:[0-9a-f]{40}$/i.test(value);
  const hasDigest = /@sha256:[0-9a-f]{64}$/i.test(value);
  if (!hasGitShaTag && !hasDigest) {
    throw new Error(`${key} must use a full Git SHA tag or sha256 digest.`);
  }
  return value;
}

function requireConsistentApplicationImages(environment: Environment): void {
  const references = ['VAZANO_API_IMAGE', 'VAZANO_WEB_IMAGE', 'VAZANO_MIGRATION_IMAGE']
    .map((key) => requireValue(environment, key));
  const gitShaTags = references.map((reference) => reference.match(/:([0-9a-f]{40})$/i)?.[1]?.toLowerCase() ?? null);
  const digestCount = references.filter((reference) => /@sha256:[0-9a-f]{64}$/i.test(reference)).length;

  if (digestCount > 0 && digestCount < references.length) {
    throw new Error('Application images must all use Git SHA tags or all use sha256 digests; mixed reference styles are not allowed.');
  }
  if (digestCount === 0 && new Set(gitShaTags).size !== 1) {
    throw new Error('API, web and migration images must reference the same Git commit.');
  }
}

function requireDigestImage(environment: Environment, key: string): string {
  const value = requireValue(environment, key);
  assertNotPlaceholder(key, value);
  if (!/@sha256:[0-9a-f]{64}$/i.test(value)) throw new Error(`${key} must use an immutable sha256 digest.`);
  return value;
}
