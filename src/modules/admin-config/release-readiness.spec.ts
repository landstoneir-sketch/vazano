import { evaluateReleaseReadiness, type ReleaseReadinessInput } from './release-readiness';

const readyInput: ReleaseReadinessInput = {
  nodeEnvironment: 'production', otpDebugEnabled: false, smsConfigured: true, subscriptionSmsConfigured: true,
  paymentConfigured: true, fileScanningConfigured: true, notificationWorkerEnabled: true, subscriptionWorkerEnabled: true,
  termsPublished: true, privacyPublished: true, paidPlanCount: 2, activeCategoryCount: 15, activeProvinceCount: 31, activeSuperAdminCount: 2,
};

describe('release readiness', () => {
  it('is ready only when every launch blocker is satisfied', () => {
    const result = evaluateReleaseReadiness(readyInput);
    expect(result.ready).toBe(true);
    expect(result.checks.every((item) => item.status === 'READY')).toBe(true);
  });

  it('reports local development as a warning but legal and provider gaps as blockers', () => {
    const result = evaluateReleaseReadiness({ ...readyInput, nodeEnvironment: 'development', termsPublished: false, paymentConfigured: false });
    expect(result.ready).toBe(false);
    expect(result.checks.find((item) => item.key === 'environment.production')?.status).toBe('WARNING');
    expect(result.checks.find((item) => item.key === 'content.terms')?.status).toBe('BLOCKED');
    expect(result.checks.find((item) => item.key === 'integration.payment')?.status).toBe('BLOCKED');
  });

  it('blocks launch until a second active recovery administrator exists', () => {
    const result = evaluateReleaseReadiness({ ...readyInput, activeSuperAdminCount: 1 });
    expect(result.ready).toBe(false);
    expect(result.checks.find((item) => item.key === 'access.super-admin')).toMatchObject({ status: 'BLOCKED', actionPath: '/admin/users' });
  });
});
