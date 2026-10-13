import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminOperationsService } from './admin-operations.service';

const superAdmin: AuthenticatedUser = {
  id: 'admin-1', mobile: '09120000000', status: 'ACTIVE', permissions: ['role.manage'], globalRoles: ['SUPER_ADMIN'], memberships: [],
};

describe('AdminOperationsService global role management', () => {
  it('rejects role management without the dedicated permission', async () => {
    const service = new AdminOperationsService({} as never);
    const operator = { ...superAdmin, permissions: ['user.manage'], globalRoles: ['ADMIN'] };

    await expect(Promise.resolve().then(() => service.listGlobalRoleOptions(operator))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('protects the last active super admin role', async () => {
    const target = { id: 'admin-1', status: 'ACTIVE', userRoles: [{ role: { key: 'SUPER_ADMIN' } }] };
    const tx = { user: { count: jest.fn().mockResolvedValue(1) } };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(target) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new AdminOperationsService(prisma as never);

    await expect(service.updateGlobalRoles(superAdmin, target.id, { roles: [], reason: 'انتقال مسئولیت مدیریت' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('atomically replaces manageable roles and writes security evidence', async () => {
    const target = { id: 'user-2', status: 'ACTIVE', userRoles: [{ role: { key: 'SUPPORT' } }] };
    const tx = {
      user: { count: jest.fn() },
      role: { findMany: jest.fn().mockResolvedValue([{ id: 'role-admin', key: 'ADMIN' }, { id: 'role-finance', key: 'FINANCE' }]) },
      userRole: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }), createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      securityEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(target) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new AdminOperationsService(prisma as never);

    await expect(service.updateGlobalRoles(superAdmin, target.id, {
      roles: ['FINANCE', 'ADMIN'], reason: 'واگذاری مسئولیت‌های عملیاتی',
    })).resolves.toEqual({ userId: target.id, globalRoles: ['ADMIN', 'FINANCE'] });
    expect(tx.userRole.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.userRole.createMany).toHaveBeenCalledWith({ data: [
      { userId: target.id, roleId: 'role-admin' }, { userId: target.id, roleId: 'role-finance' },
    ] });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.securityEvent.create).toHaveBeenCalledTimes(1);
  });
});
