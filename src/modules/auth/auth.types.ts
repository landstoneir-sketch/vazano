import type { MemberRole, UserStatus } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  mobile: string;
  status: UserStatus;
  permissions: string[];
  globalRoles: string[];
  memberships: Array<{ organizationId: string; role: MemberRole }>;
};
