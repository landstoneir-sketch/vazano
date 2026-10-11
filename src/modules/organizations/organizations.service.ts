import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole, OrganizationKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { normalizeIranianMobile } from '../auth/domain/mobile';
import { CreateOrganizationDto } from './create-organization.dto';
import { InviteOrganizationMemberDto } from './invite-organization-member.dto';
import { canAssignOrganizationRole, canManageOrganizationMembers } from './organization-member-policy';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}
  listForUser(userId: string) {
    return this.prisma.organization.findMany({
      where: { members: { some: { userId, status: 'ACTIVE' } } },
      include: { members: { where: { userId }, select: { role: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listBuyerOptions(user: AuthenticatedUser) {
    if (!user.permissions.includes('rfq.create_on_behalf')) {
      throw new ForbiddenException('مجوز مشاهده حساب‌های خریدار را ندارید.');
    }
    const organizations = await this.prisma.organization.findMany({
      where: {
        kind: 'BUYER',
        status: 'ACTIVE',
        members: { some: { status: 'ACTIVE', role: { in: ['BUYER_OWNER', 'BUYER_MEMBER'] } } },
      },
      select: {
        id: true,
        displayName: true,
        province: true,
        city: true,
        members: {
          where: { status: 'ACTIVE', role: { in: ['BUYER_OWNER', 'BUYER_MEMBER'] } },
          select: { role: true, user: { select: { id: true, firstName: true, lastName: true, mobile: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { displayName: 'asc' },
    });
    return organizations.map(({ members, ...organization }) => ({
      ...organization,
      contacts: members.map(({ role, user: contact }) => ({
        id: contact.id,
        role,
        displayName: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || this.maskMobile(contact.mobile),
        mobileMasked: this.maskMobile(contact.mobile),
      })),
    }));
  }

  listInvitations(userId: string) {
    return this.prisma.organizationMember.findMany({
      where: { userId, status: 'INVITED' },
      select: { id: true, role: true, createdAt: true, organization: { select: { id: true, displayName: true, kind: true, province: true, city: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listMembers(userId: string, organizationId: string) {
    await this.requireActiveMembership(userId, organizationId);
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId, status: { not: 'REMOVED' } },
      select: { id: true, role: true, status: true, createdAt: true, user: { select: { id: true, mobile: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
    return members.map((member) => ({ ...member, user: { ...member.user, mobile: undefined, mobileMasked: this.maskMobile(member.user.mobile) } }));
  }

  async inviteMember(actorUserId: string, organizationId: string, input: InviteOrganizationMemberDto) {
    const manager = await this.requireManager(actorUserId, organizationId);
    if (!canAssignOrganizationRole(manager.role, input.role, manager.organization.kind)) {
      throw new ForbiddenException('این نقش را نمی‌توانید به عضو جدید اختصاص دهید.');
    }
    const mobile = normalizeIranianMobile(input.mobile);
    const result = await this.prisma.$transaction(async (tx) => {
      const invitee = await tx.user.upsert({ where: { mobile }, create: { mobile }, update: {} });
      if (invitee.id === actorUserId) throw new BadRequestException('امکان دعوت خودتان وجود ندارد.');
      const existing = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: invitee.id } } });
      if (existing?.status === 'ACTIVE') throw new ConflictException('این کاربر هم‌اکنون عضو فعال سازمان است.');
      const membership = existing
        ? await tx.organizationMember.update({ where: { id: existing.id }, data: { role: input.role, status: 'INVITED' } })
        : await tx.organizationMember.create({ data: { organizationId, userId: invitee.id, role: input.role, status: 'INVITED' } });
      await tx.auditLog.create({ data: {
        actorUserId, organizationId, action: 'organization.member.invite', entityType: 'OrganizationMember', entityId: membership.id,
        metadata: { invitedUserId: invitee.id, role: input.role },
      } });
      await tx.outboxEvent.create({ data: {
        aggregateType: 'OrganizationMember', aggregateId: membership.id, eventType: 'ir.vazano.organization.member_invited.v1',
        payload: { organizationId, invitedUserId: invitee.id, role: input.role },
      } });
      return membership;
    });
    return { ...result, mobileMasked: this.maskMobile(mobile) };
  }

  async respondToInvitation(userId: string, membershipId: string, accepted: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.organizationMember.findFirst({ where: { id: membershipId, userId, status: 'INVITED' } });
      if (!membership) throw new NotFoundException('دعوت‌نامه فعال پیدا نشد.');
      const status = accepted ? 'ACTIVE' : 'REMOVED';
      const updated = await tx.organizationMember.update({ where: { id: membership.id }, data: { status } });
      await tx.auditLog.create({ data: {
        actorUserId: userId, organizationId: membership.organizationId,
        action: accepted ? 'organization.member.invitation_accept' : 'organization.member.invitation_reject',
        entityType: 'OrganizationMember', entityId: membership.id,
      } });
      return updated;
    });
  }

  async updateMemberRole(actorUserId: string, organizationId: string, memberId: string, role: MemberRole) {
    const manager = await this.requireManager(actorUserId, organizationId);
    if (!canAssignOrganizationRole(manager.role, role, manager.organization.kind)) {
      throw new ForbiddenException('امکان اختصاص این نقش را ندارید.');
    }
    const target = await this.prisma.organizationMember.findFirst({ where: { id: memberId, organizationId, status: { not: 'REMOVED' } } });
    if (!target) throw new NotFoundException('عضو سازمان پیدا نشد.');
    if (target.role === 'BUYER_OWNER' || target.role === 'SUPPLIER_OWNER') throw new ForbiddenException('نقش مالک از این مسیر قابل تغییر نیست.');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.organizationMember.update({ where: { id: target.id }, data: { role } });
      await tx.auditLog.create({ data: {
        actorUserId, organizationId, action: 'organization.member.role_update', entityType: 'OrganizationMember', entityId: target.id,
        metadata: { from: target.role, to: role },
      } });
      return updated;
    });
  }

  async removeMember(actorUserId: string, organizationId: string, memberId: string) {
    const manager = await this.requireManager(actorUserId, organizationId);
    const target = await this.prisma.organizationMember.findFirst({ where: { id: memberId, organizationId, status: { not: 'REMOVED' } } });
    if (!target) throw new NotFoundException('عضو سازمان پیدا نشد.');
    if (target.role === 'BUYER_OWNER' || target.role === 'SUPPLIER_OWNER') throw new ForbiddenException('مالک سازمان از این مسیر قابل حذف نیست.');
    if (!canAssignOrganizationRole(manager.role, target.role, manager.organization.kind)) throw new ForbiddenException('امکان حذف این عضو را ندارید.');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.organizationMember.update({ where: { id: target.id }, data: { status: 'REMOVED' } });
      await tx.auditLog.create({ data: {
        actorUserId, organizationId, action: 'organization.member.remove', entityType: 'OrganizationMember', entityId: target.id,
        metadata: { role: target.role },
      } });
      return updated;
    });
  }

  async create(userId: string, input: CreateOrganizationDto) {
    if (input.kind === OrganizationKind.PLATFORM) throw new BadRequestException('ایجاد سازمان پلتفرم از این مسیر مجاز نیست.');
    const ownerRole = input.kind === OrganizationKind.BUYER ? MemberRole.BUYER_OWNER : MemberRole.SUPPLIER_OWNER;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({ data: { ...input, status: input.kind === OrganizationKind.BUYER ? 'ACTIVE' : 'PENDING' } });
        await tx.organizationMember.create({ data: { organizationId: organization.id, userId, role: ownerRole } });
        await tx.auditLog.create({ data: { actorUserId: userId, organizationId: organization.id, action: 'organization.create', entityType: 'Organization', entityId: organization.id } });
        await tx.outboxEvent.create({ data: { aggregateType: 'Organization', aggregateId: organization.id, eventType: 'ir.vazano.organization.created.v1', payload: { organizationId: organization.id, kind: organization.kind } } });
        return organization;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('شناسه ملی قبلاً ثبت شده است.');
      throw error;
    }
  }

  private async requireActiveMembership(userId: string, organizationId: string) {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId, status: 'ACTIVE' },
      include: { organization: { select: { kind: true } } },
    });
    if (!membership) throw new ForbiddenException('به اطلاعات این سازمان دسترسی ندارید.');
    return membership;
  }

  private async requireManager(userId: string, organizationId: string) {
    const membership = await this.requireActiveMembership(userId, organizationId);
    if (!canManageOrganizationMembers(membership.role)) throw new ForbiddenException('مجوز مدیریت اعضای این سازمان را ندارید.');
    return membership;
  }

  private maskMobile(mobile: string): string {
    return `${mobile.slice(0, 4)}***${mobile.slice(-3)}`;
  }
}
