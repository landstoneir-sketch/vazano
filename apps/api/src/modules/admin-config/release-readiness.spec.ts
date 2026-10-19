import { evaluateReleaseReadiness, type ReleaseReadinessInput } from './release-readiness';

const readyInput: ReleaseReadinessInput = {
  nodeEnvironment: 'production', otpDebugEnabled: false, smsConfigured: true,
  subscriptionSmsTemplatesConfigured: true, subscriptionSmsEnabled: true,
  paymentConfigured: true, fileScanningConfigured: true, notificationWorkerEnabled: true, subscriptionWorkerEnabled: true, rfqLifecycleWorkerEnabled: true,
  failedNotificationDispatchCount: 0,
  termsPublished: true, privacyPublished: true, paidPlanCount: 2, activeCategoryCount: 15, activeUnitCount: 6,
  activeProvinceCount: 31, activeCityCount: 1481, provincesWithoutActiveCityCount: 0, provincesWithoutActiveCityNames: [],
  marketCoverageConfigured: true, activeBuyerOrganizationCount: 2, eligibleSupplierCount: 5,
  uncoveredCategoryCount: 0, uncoveredProvinceCount: 0,
  uncoveredCategoryNames: [], uncoveredProvinceNames: [],
  activeSuperAdminCount: 2,
};

describe('release readiness', () => {
  it('is ready only when every launch blocker is satisfied', () => {
    const result = evaluateReleaseReadiness(readyInput);
    expect(result.ready).toBe(true);
    expect(result.pilotReady).toBe(true);
    expect(result.summary).toEqual({
      total: 24,
      ready: 24,
      warning: 0,
      blocked: 0,
      ownerDecisionRequired: 0,
      technicalActionsRequired: 0,
      operationsActionsRequired: 0,
      pilotBlockers: 0,
      percent: 100,
    });
    expect(result.checks.every((item) => item.status === 'READY')).toBe(true);
  });

  it('reports local development as a warning but legal and provider gaps as blockers', () => {
    const result = evaluateReleaseReadiness({ ...readyInput, nodeEnvironment: 'development', termsPublished: false, paymentConfigured: false });
    expect(result.ready).toBe(false);
    expect(result.summary).toMatchObject({
      total: 24,
      ready: 21,
      warning: 1,
      blocked: 2,
      ownerDecisionRequired: 2,
      technicalActionsRequired: 1,
      operationsActionsRequired: 0,
      pilotBlockers: 1,
      percent: 90,
    });
    expect(result.checks.find((item) => item.key === 'environment.production')?.status).toBe('WARNING');
    expect(result.checks.find((item) => item.key === 'content.terms')?.status).toBe('BLOCKED');
    expect(result.checks.find((item) => item.key === 'integration.payment')?.status).toBe('BLOCKED');
  });

  it('distinguishes approved template configuration from live subscription SMS delivery', () => {
    const result = evaluateReleaseReadiness({ ...readyInput, subscriptionSmsEnabled: false });
    expect(result.ready).toBe(false);
    expect(result.pilotReady).toBe(true);
    expect(result.checks.find((item) => item.key === 'integration.subscription-sms-templates')?.status).toBe('READY');
    expect(result.checks.find((item) => item.key === 'integration.subscription-sms-delivery')).toMatchObject({ status: 'BLOCKED', responsibility: 'OWNER' });
  });

  it('blocks launch until a second active recovery administrator exists', () => {
    const result = evaluateReleaseReadiness({ ...readyInput, activeSuperAdminCount: 1 });
    expect(result.ready).toBe(false);
    expect(result.checks.find((item) => item.key === 'access.super-admin')).toMatchObject({ status: 'BLOCKED', actionPath: '/admin/users' });
  });

  it('blocks launch when RFQ deadline processing is disabled', () => {
    const result = evaluateReleaseReadiness({ ...readyInput, rfqLifecycleWorkerEnabled: false });
    expect(result.ready).toBe(false);
    expect(result.pilotReady).toBe(false);
    expect(result.checks.find((item) => item.key === 'worker.rfq-lifecycle')?.status).toBe('BLOCKED');
  });

  it('blocks launch while failed notification dispatches remain', () => {
    const result = evaluateReleaseReadiness({ ...readyInput, failedNotificationDispatchCount: 3 });
    expect(result.ready).toBe(false);
    expect(result.pilotReady).toBe(false);
    expect(result.checks.find((item) => item.key === 'worker.notification-failures')).toMatchObject({
      status: 'BLOCKED',
      responsibility: 'TECHNICAL',
      actionPath: '/admin/settings',
    });
    expect(result.checks.find((item) => item.key === 'worker.notification-failures')?.detail).toContain('۳');
  });

  it('blocks launch when marketplace reference data or pilot liquidity is missing', () => {
    const result = evaluateReleaseReadiness({
      ...readyInput,
      activeUnitCount: 0,
      marketCoverageConfigured: false,
      activeBuyerOrganizationCount: 0,
      eligibleSupplierCount: 0,
      uncoveredCategoryCount: 15,
      uncoveredProvinceCount: 31,
      uncoveredCategoryNames: ['تراورتن', 'گرانیت'],
      uncoveredProvinceNames: ['تهران', 'فارس'],
    });
    expect(result.ready).toBe(false);
    expect(result.pilotReady).toBe(false);
    expect(result.checks.filter((item) => item.status === 'BLOCKED').map((item) => item.key)).toEqual(expect.arrayContaining([
      'catalog.units', 'market.coverage', 'market.buyers', 'market.suppliers', 'market.category-supply', 'market.province-supply',
    ]));
    expect(result.checks.find((item) => item.key === 'market.category-supply')?.detail).toContain('تراورتن');
    expect(result.checks.find((item) => item.key === 'market.province-supply')?.detail).toContain('فارس');
    expect(result.checks.find((item) => item.key === 'market.suppliers')?.responsibility).toBe('OPERATIONS');
    expect(result.summary.operationsActionsRequired).toBe(6);
  });

  it('blocks launch when an active province has no selectable city', () => {
    const result = evaluateReleaseReadiness({
      ...readyInput,
      activeCityCount: 30,
      provincesWithoutActiveCityCount: 1,
      provincesWithoutActiveCityNames: ['تهران'],
    });
    expect(result.ready).toBe(false);
    expect(result.pilotReady).toBe(false);
    expect(result.checks.find((item) => item.key === 'locations.cities')).toMatchObject({ status: 'BLOCKED', responsibility: 'OPERATIONS' });
    expect(result.checks.find((item) => item.key === 'locations.cities')?.detail).toContain('تهران');
  });
});
