import { describe, expect, it } from 'vitest';
import { canAccessRoute, safeReturnTo, type RouteIdentity } from './route-access';

const buyer: RouteIdentity = {
  permissions: [],
  globalRoles: [],
  memberships: [{ organizationId: 'buyer-1', role: 'BUYER_OWNER' }],
};

const supplier: RouteIdentity = {
  permissions: [],
  globalRoles: [],
  memberships: [{ organizationId: 'supplier-1', role: 'SUPPLIER_SALES' }],
};

describe('route access policy', () => {
  it('keeps authenticated buyer routes available but blocks supplier and admin areas', () => {
    expect(canAccessRoute('/dashboard/rfqs', buyer)).toBe(true);
    expect(canAccessRoute('/supplier', buyer)).toBe(false);
    expect(canAccessRoute('/admin/content', buyer)).toBe(false);
  });

  it('allows supplier members into the supplier workspace', () => {
    expect(canAccessRoute('/supplier/rfqs/rfq-1/quote', supplier)).toBe(true);
  });

  it('uses fine-grained permissions for admin pages', () => {
    const contentManager = { ...buyer, permissions: ['content.manage'], globalRoles: ['CONTENT_MANAGER'] };
    expect(canAccessRoute('/admin/content', contentManager)).toBe(true);
    expect(canAccessRoute('/admin/catalog', contentManager)).toBe(false);
    expect(canAccessRoute('/admin/users', contentManager)).toBe(false);
    expect(canAccessRoute('/admin/locations', { ...contentManager, permissions: ['location.manage'] })).toBe(true);
    expect(canAccessRoute('/admin/quality-control', { ...contentManager, permissions: ['quality_control.manage'] })).toBe(true);
    expect(canAccessRoute('/admin/contracts', { ...contentManager, permissions: ['contract.manage'] })).toBe(true);
    expect(canAccessRoute('/admin/reports', { ...contentManager, permissions: ['report.read'] })).toBe(true);

    const catalogManager = { ...contentManager, permissions: ['category.manage'] };
    expect(canAccessRoute('/admin/catalog', catalogManager)).toBe(true);
    expect(canAccessRoute('/admin/content', catalogManager)).toBe(false);

    const financeManager = { ...contentManager, permissions: ['billing.read'], globalRoles: ['FINANCE'] };
    expect(canAccessRoute('/admin/billing', financeManager)).toBe(true);
    expect(canAccessRoute('/admin/settings', financeManager)).toBe(false);
  });

  it('allows the super admin to access all admin pages', () => {
    expect(canAccessRoute('/admin/users', { ...buyer, globalRoles: ['SUPER_ADMIN'] })).toBe(true);
  });
});

describe('safe return path', () => {
  it('accepts internal application paths', () => {
    expect(safeReturnTo('/dashboard/rfqs?status=draft')).toBe('/dashboard/rfqs?status=draft');
  });

  it('rejects external, protocol-relative and login loops', () => {
    expect(safeReturnTo('https://example.com')).toBe('/dashboard');
    expect(safeReturnTo('//example.com')).toBe('/dashboard');
    expect(safeReturnTo('/login?returnTo=/login')).toBe('/dashboard');
  });
});
