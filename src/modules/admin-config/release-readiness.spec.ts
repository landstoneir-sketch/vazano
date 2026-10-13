import { evaluateReleaseReadiness, type ReleaseReadinessInput } from './release-readiness';

const readyInput: ReleaseReadinessInput = {
  nodeEnvironment: 'production', otpDebugEnabled: false, smsConfigured: true, subscriptionSmsConfigured: true,
  paymentConfigured: true, fileScanningConfigured: true, notificationWorkerEnabled: true, subscriptionWorkerEnabled: true,
  termsPublished: true, privacyPublished: true, paidPlanCount: 2, activeCategoryCount: 15, activeUnitCount: 6,
  activeProvinceCount: 31, marketCoverageConfigured: true, activeBuyerOrganizationCount: 2, eligibleSupplierCount: 5,
  activeSuperAdminCount: 2,
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

  it('blocks launch when marketplace reference data or pilot liquidity is missing', () => {
    const result = evaluateReleaseReadiness({
      ...readyInput,
      activeUnitCount: 0,
      marketCoverageConfigured: false,
      activeBuyerOrganizationCount: 0,
      eligibleSupplierCount: 0,
    });
    expect(result.ready).toBe(false);
    expect(result.checks.filter((item) => item.status === 'BLOCKED').map((item) => item.key)).toEqual(expect.arrayContaining([
      'catalog.units', 'market.coverage', 'market.buyers', 'market.suppliers',
    ]));
  });
});
