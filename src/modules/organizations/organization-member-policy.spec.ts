import { canAssignOrganizationRole, canManageOrganizationMembers } from './organization-member-policy';

describe('organization member policy', () => {
  it('lets buyer owners assign buyer members only', () => {
    expect(canAssignOrganizationRole('BUYER_OWNER', 'BUYER_MEMBER', 'BUYER')).toBe(true);
    expect(canAssignOrganizationRole('BUYER_OWNER', 'SUPPLIER_SALES', 'BUYER')).toBe(false);
  });

  it('limits supplier managers to sales members', () => {
    expect(canAssignOrganizationRole('SUPPLIER_MANAGER', 'SUPPLIER_SALES', 'SUPPLIER')).toBe(true);
    expect(canAssignOrganizationRole('SUPPLIER_MANAGER', 'SUPPLIER_MANAGER', 'SUPPLIER')).toBe(false);
  });

  it('does not grant member-management rights to ordinary members', () => {
    expect(canManageOrganizationMembers('BUYER_MEMBER')).toBe(false);
    expect(canManageOrganizationMembers('SUPPLIER_SALES')).toBe(false);
  });
});
