import { MemberRole, OrganizationKind } from '@prisma/client';

const INVITABLE_ROLES: Partial<Record<MemberRole, readonly MemberRole[]>> = {
  BUYER_OWNER: ['BUYER_MEMBER'],
  SUPPLIER_OWNER: ['SUPPLIER_MANAGER', 'SUPPLIER_SALES'],
  SUPPLIER_MANAGER: ['SUPPLIER_SALES'],
};

export function canManageOrganizationMembers(role: MemberRole): boolean {
  return role in INVITABLE_ROLES;
}

export function canAssignOrganizationRole(actorRole: MemberRole, targetRole: MemberRole, kind: OrganizationKind): boolean {
  const allowed = INVITABLE_ROLES[actorRole] ?? [];
  const roleMatchesKind = kind === 'BUYER'
    ? targetRole === 'BUYER_MEMBER'
    : targetRole === 'SUPPLIER_MANAGER' || targetRole === 'SUPPLIER_SALES';
  return roleMatchesKind && allowed.includes(targetRole);
}
