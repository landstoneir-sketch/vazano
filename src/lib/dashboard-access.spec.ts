import { describe, expect, it } from 'vitest';
import { dashboardManagementLinks, hasBuyerWorkspace, hasSupplierWorkspace } from './dashboard-access';
import type { RouteIdentity } from './route-access';

function identity(overrides: Partial<RouteIdentity> = {}): RouteIdentity {
  return { permissions: [], globalRoles: [], memberships: [], ...overrides };
}

describe('dashboard access', () => {
  it('shows only the workspace owned by the current organization member', () => {
    expect(hasBuyerWorkspace(identity({ memberships: [{ organizationId: 'buyer', role: 'BUYER_MEMBER' }] }))).toBe(true);
    expect(hasSupplierWorkspace(identity({ memberships: [{ organizationId: 'buyer', role: 'BUYER_MEMBER' }] }))).toBe(false);
    expect(hasSupplierWorkspace(identity({ memberships: [{ organizationId: 'supplier', role: 'SUPPLIER_SALES' }] }))).toBe(true);
  });

  it('does not expose unrelated management destinations', () => {
    const links = dashboardManagementLinks(identity({ permissions: ['content.manage'] }));
    expect(links).toEqual([{ href: '/admin/content', label: 'مدیریت محتوا' }]);
  });

  it('shows every management destination to the super administrator', () => {
    const links = dashboardManagementLinks(identity({ globalRoles: ['SUPER_ADMIN'] }));
    expect(links.length).toBeGreaterThan(10);
    expect(links).toContainEqual({ href: '/admin/audit-logs', label: 'ممیزی و امنیت' });
  });
});
