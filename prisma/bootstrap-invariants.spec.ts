import { assertBootstrapInvariants, validateBootstrapInvariants, type BootstrapInvariantExpectation, type BootstrapInvariantSnapshot } from './bootstrap-invariants';

const expectation: BootstrapInvariantExpectation = {
  permissionKeys: ['rfq.read', 'rfq.manage'],
  roles: { ADMIN: ['rfq.read', 'rfq.manage'], BUYER_OWNER: ['rfq.read'] },
  provinceCodes: ['tehran', 'isfahan'],
  naturalStoneCategoryCodes: ['travertine', 'granite'],
  unitCodes: ['square-meter'],
  subscriptionPlanCodes: ['SELLER_P1M_V1'],
  systemSettingKeys: ['market.coverage.country'],
  notificationTemplateCodes: ['IN_APP_RFQ_PUBLISHED_FA_V1'],
  requireActiveSuperAdmin: true,
  forbidActiveDemoDiscount: true,
};

const validSnapshot: BootstrapInvariantSnapshot = {
  permissionKeys: ['rfq.read', 'rfq.manage'],
  roles: [
    { key: 'ADMIN', permissionKeys: ['rfq.read', 'rfq.manage'] },
    { key: 'BUYER_OWNER', permissionKeys: ['rfq.read'] },
  ],
  provinceCodes: ['tehran', 'isfahan'],
  naturalStoneCategoryCodes: ['travertine', 'granite'],
  unitCodes: ['square-meter'],
  subscriptionPlanCodes: ['SELLER_P1M_V1'],
  systemSettingKeys: ['market.coverage.country'],
  notificationTemplateCodes: ['IN_APP_RFQ_PUBLISHED_FA_V1'],
  activeSuperAdminCount: 1,
  activeDemoDiscountCount: 0,
};

describe('bootstrap invariants', () => {
  it('accepts a complete reference-data bootstrap', () => {
    expect(validateBootstrapInvariants(validSnapshot, expectation)).toEqual([]);
    expect(() => assertBootstrapInvariants(validSnapshot, expectation)).not.toThrow();
  });

  it('reports missing reference data, role permissions, and unsafe production state together', () => {
    const issues = validateBootstrapInvariants({
      ...validSnapshot,
      provinceCodes: ['tehran'],
      roles: [{ key: 'ADMIN', permissionKeys: ['rfq.read'] }],
      activeSuperAdminCount: 0,
      activeDemoDiscountCount: 1,
    }, expectation);

    expect(issues).toEqual(expect.arrayContaining([
      'missing provinces: isfahan',
      'missing permissions for role ADMIN: rfq.manage',
      'missing role: BUYER_OWNER',
      'no active SUPER_ADMIN account exists',
      'development discount DEMO10 is active',
    ]));
    expect(() => assertBootstrapInvariants({ ...validSnapshot, activeSuperAdminCount: 0 }, expectation))
      .toThrow('Bootstrap verification failed');
  });

  it('does not require production-only controls in development', () => {
    const developmentExpectation = {
      ...expectation,
      requireActiveSuperAdmin: false,
      forbidActiveDemoDiscount: false,
    };
    expect(validateBootstrapInvariants({ ...validSnapshot, activeSuperAdminCount: 0, activeDemoDiscountCount: 1 }, developmentExpectation)).toEqual([]);
  });
});
