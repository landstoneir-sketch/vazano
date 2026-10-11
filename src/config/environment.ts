type Environment = Record<string, string | undefined>;

export function validateEnvironment(environment: Environment): Environment {
  const nodeEnv = environment.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV must be development, test or production.');
  requireValue(environment, 'DATABASE_URL');
  requireUrl(environment, 'WEB_ORIGIN');
  requireValue(environment, 'OTP_PEPPER', 32);
  if (environment.OTP_IP_REQUESTS_PER_MINUTE) requirePositiveInteger(environment, 'OTP_IP_REQUESTS_PER_MINUTE');

  if (nodeEnv === 'production') {
    const webOrigin = new URL(environment.WEB_ORIGIN!);
    if (webOrigin.protocol !== 'https:') throw new Error('WEB_ORIGIN must use HTTPS in production.');
    if (environment.OTP_DEBUG_ENABLED === 'true') throw new Error('OTP debug mode must be disabled in production.');
    if ((environment.SMS_PROVIDER ?? 'debug') !== 'smsir') throw new Error('A production SMS provider must be configured.');
    requireValue(environment, 'SMSIR_API_KEY', 16);
    requirePositiveInteger(environment, 'SMSIR_TEMPLATE_ID');
    if (environment.FILE_SCAN_MODE !== 'clamav') throw new Error('FILE_SCAN_MODE must be clamav in production.');
    requireValue(environment, 'CLAMAV_HOST');
    requirePositiveInteger(environment, 'CLAMAV_PORT');
    requirePositiveInteger(environment, 'CLAMAV_TIMEOUT_MS');
    requireValue(environment, 'S3_ENDPOINT');
    requireValue(environment, 'S3_BUCKET');
    requireValue(environment, 'S3_ACCESS_KEY');
    requireValue(environment, 'S3_SECRET_KEY', 16);
    if (environment.ZARINPAL_ENABLED === 'true') {
      requireValue(environment, 'ZARINPAL_MERCHANT_ID', 16);
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
