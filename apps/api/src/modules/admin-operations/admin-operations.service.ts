import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SecurityEventSeverity } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpdateUserStatusDto } from './update-user-status.dto';
import { ManageableGlobalRole, manageableGlobalRoles, UpdateGlobalRolesDto } from './update-global-roles.dto';

type AuditLogFilters = { limit?: string; action?: string; entityType?: string; before?: string };
type SecurityEventFilters = { severity?: string; resolved?: string };

@Injectable()
export class AdminOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(user: AuthenticatedUser, rawQuery?: string) {
    this.requirePermission(user, 'user.read');
    const query = rawQuery?.trim().slice(0, 100);
    const users = await this.prisma.user.findMany({
      where: query ? {
        OR: [
          { mobile: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
        ],
      } : undefined,
      select: {
        id: true,
        mobile: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        userRoles: { where: { organizationId: null }, select: { role: { select: { key: true, nameFa: true } } } },
        memberships: { where: { status: 'ACTIVE' }, select: { organization: { select: { id: true, displayName: true, kind: true } }, role: true } },
        _count: { select: { sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return users.map(({ mobile, ...item }) => ({ ...item, mobileMasked: this.maskMobile(mobile) }));
  }

  async updateUserStatus(user: AuthenticatedUser, targetUserId: string, input: UpdateUserStatusDto) {
    this.requirePermission(user, 'user.manage');
    if (targetUserId === user.id && input.status === 'SUSPENDED') {
      throw new ConflictException('امکان تعلیق حساب کاربری خودتان وجود ندارد.');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { userRoles: { where: { organizationId: null }, include: { role: true } } },
    });
    if (!target) throw new NotFoundException('کاربر پیدا نشد.');
    if (target.status === input.status) return { id: target.id, status: target.status };
    const isSuperAdmin = target.userRoles.some((item) => item.role.key === 'SUPER_ADMIN');
    if (input.status === 'SUSPENDED' && isSuperAdmin) {
      const activeSuperAdmins = await this.prisma.user.count({
        where: { status: 'ACTIVE', userRoles: { some: { organizationId: null, role: { key: 'SUPER_ADMIN' } } } },
      });
      if (activeSuperAdmins <= 1) throw new ConflictException('آخرین مدیر ارشد فعال قابل تعلیق نیست.');
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: target.id, updatedAt: target.updatedAt },
        data: { status: input.status },
      });
      if (result.count !== 1) throw new ConflictException('اطلاعات کاربر هم‌زمان تغییر کرده است؛ فهرست را تازه‌سازی کنید.');
      let revokedSessions = 0;
      if (input.status === 'SUSPENDED') {
        const revoked = await tx.session.updateMany({
          where: { userId: target.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        revokedSessions = revoked.count;
      }
      await tx.auditLog.create({ data: {
        actorUserId: user.id,
        action: `user.status.${input.status.toLowerCase()}`,
        entityType: 'User',
        entityId: target.id,
        metadata: { from: target.status, to: input.status, reason: input.reason, revokedSessions },
      } });
      await tx.securityEvent.create({ data: {
        eventType: `admin.user.${input.status.toLowerCase()}`,
        severity: input.status === 'SUSPENDED' ? 'HIGH' : 'MEDIUM',
        outcome: 'SUCCESS',
        userId: target.id,
        metadata: { actorUserId: user.id, reason: input.reason, revokedSessions },
      } });
      return { id: target.id, status: input.status, revokedSessions };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  listGlobalRoleOptions(user: AuthenticatedUser) {
    this.requirePermission(user, 'role.manage');
    return this.prisma.role.findMany({
      where: { key: { in: [...manageableGlobalRoles] } },
      select: { key: true, nameFa: true, description: true },
      orderBy: { key: 'asc' },
    });
  }

  async updateGlobalRoles(user: AuthenticatedUser, targetUserId: string, input: UpdateGlobalRolesDto) {
    this.requirePermission(user, 'role.manage');
    const requestedRoles = [...new Set(input.roles)].sort();
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true, status: true,
        userRoles: { where: { organizationId: null }, select: { role: { select: { key: true } } } },
      },
    });
    if (!target) throw new NotFoundException('کاربر پیدا نشد.');
    const existingRoles = target.userRoles
      .map((item) => item.role.key)
      .filter((key): key is ManageableGlobalRole => manageableGlobalRoles.includes(key as ManageableGlobalRole))
      .sort();
    if (existingRoles.join('|') === requestedRoles.join('|')) return { userId: target.id, globalRoles: existingRoles };

    const removesSuperAdmin = target.status === 'ACTIVE'
      && existingRoles.includes('SUPER_ADMIN')
      && !requestedRoles.includes('SUPER_ADMIN');

    return this.prisma.$transaction(async (tx) => {
      if (removesSuperAdmin) {
        const activeSuperAdmins = await tx.user.count({
          where: { status: 'ACTIVE', userRoles: { some: { organizationId: null, role: { key: 'SUPER_ADMIN' } } } },
        });
        if (activeSuperAdmins <= 1) throw new ConflictException('نقش آخرین مدیر ارشد فعال قابل حذف نیست.');
      }
      const roles = await tx.role.findMany({
        where: { key: { in: requestedRoles } },
        select: { id: true, key: true },
      });
      if (roles.length !== requestedRoles.length) throw new BadRequestException('یک یا چند نقش مدیریتی در سامانه تعریف نشده است.');
      await tx.userRole.deleteMany({
        where: { userId: target.id, organizationId: null, role: { key: { in: [...manageableGlobalRoles] } } },
      });
      if (roles.length > 0) {
        await tx.userRole.createMany({
          data: roles.map((role) => ({ userId: target.id, roleId: role.id })),
        });
      }
      await tx.auditLog.create({ data: {
        actorUserId: user.id,
        action: 'user.global_roles.replace',
        entityType: 'User',
        entityId: target.id,
        metadata: { from: existingRoles, to: requestedRoles, reason: input.reason },
      } });
      await tx.securityEvent.create({ data: {
        eventType: 'admin.user.global_roles_changed', severity: 'HIGH', outcome: 'SUCCESS', userId: target.id,
        metadata: { actorUserId: user.id, from: existingRoles, to: requestedRoles, reason: input.reason },
      } });
      return { userId: target.id, globalRoles: requestedRoles };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async revokeUserSessions(user: AuthenticatedUser, targetUserId: string, reason: string) {
    this.requirePermission(user, 'user.manage');
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!target) throw new NotFoundException('کاربر پیدا نشد.');
    const result = await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.session.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({ data: {
        actorUserId: user.id,
        action: 'user.sessions.revoke_all',
        entityType: 'User',
        entityId: targetUserId,
        metadata: { reason, revokedSessions: revoked.count },
      } });
      await tx.securityEvent.create({ data: {
        eventType: 'admin.user.sessions_revoked', severity: 'MEDIUM', outcome: 'SUCCESS', userId: targetUserId,
        metadata: { actorUserId: user.id, reason, revokedSessions: revoked.count },
      } });
      return revoked.count;
    });
    return { userId: targetUserId, revokedSessions: result };
  }

  listAuditLogs(user: AuthenticatedUser, filters: AuditLogFilters) {
    this.requirePermission(user, 'audit.read');
    const limit = this.boundedLimit(filters.limit);
    const before = this.optionalDate(filters.before);
    return this.prisma.auditLog.findMany({
      where: {
        ...(filters.action?.trim() ? { action: { contains: filters.action.trim(), mode: 'insensitive' as const } } : {}),
        ...(filters.entityType?.trim() ? { entityType: filters.entityType.trim() } : {}),
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      select: {
        id: true, action: true, entityType: true, entityId: true, organizationId: true,
        metadata: true, ipAddress: true, createdAt: true,
        actor: { select: { id: true, firstName: true, lastName: true, mobile: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }).then((items) => items.map((item) => ({
      ...item,
      actor: item.actor ? { ...item.actor, mobile: undefined, mobileMasked: this.maskMobile(item.actor.mobile) } : null,
    })));
  }

  listSecurityEvents(user: AuthenticatedUser, filters: SecurityEventFilters) {
    this.requirePermission(user, 'audit.read');
    const severity = filters.severity && Object.values(SecurityEventSeverity).includes(filters.severity as SecurityEventSeverity)
      ? filters.severity as SecurityEventSeverity
      : undefined;
    const resolved = filters.resolved === 'true' ? true : filters.resolved === 'false' ? false : undefined;
    return this.prisma.securityEvent.findMany({
      where: {
        ...(severity ? { severity } : {}),
        ...(resolved === true ? { resolvedAt: { not: null } } : resolved === false ? { resolvedAt: null } : {}),
      },
      select: {
        id: true, eventType: true, severity: true, outcome: true, ipAddress: true, userAgent: true,
        metadata: true, createdAt: true, resolvedAt: true,
        user: { select: { id: true, mobile: true, firstName: true, lastName: true } },
        resolvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }).then((items) => items.map((item) => ({
      ...item,
      user: item.user ? { ...item.user, mobile: undefined, mobileMasked: this.maskMobile(item.user.mobile) } : null,
    })));
  }

  async resolveSecurityEvent(user: AuthenticatedUser, eventId: string, reason: string) {
    this.requirePermission(user, 'audit.read');
    const event = await this.prisma.securityEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('رخداد امنیتی پیدا نشد.');
    if (event.resolvedAt) return event;
    const existingMetadata = event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
      ? event.metadata
      : {};
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.securityEvent.update({
        where: { id: event.id },
        data: {
          resolvedAt: new Date(),
          resolvedByUserId: user.id,
          metadata: { ...existingMetadata, resolutionReason: reason },
        },
      });
      await tx.auditLog.create({ data: {
        actorUserId: user.id,
        action: 'security_event.resolve',
        entityType: 'SecurityEvent',
        entityId: event.id,
        metadata: { reason, eventType: event.eventType, severity: event.severity },
      } });
      return updated;
    });
  }

  private requirePermission(user: AuthenticatedUser, permission: string): void {
    if (!user.permissions.includes(permission)) throw new ForbiddenException('شما مجوز انجام این عملیات را ندارید.');
  }

  private boundedLimit(value: string | undefined): number {
    const parsed = Number.parseInt(value ?? '100', 10);
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : 100;
  }

  private optionalDate(value: string | undefined): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('تاریخ صفحه‌بندی معتبر نیست.');
    return date;
  }

  private maskMobile(mobile: string): string {
    return mobile.length >= 7 ? `${mobile.slice(0, 4)}***${mobile.slice(-3)}` : '***';
  }
}
