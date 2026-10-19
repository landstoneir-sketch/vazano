import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AddSupportCommentDto } from './add-support-comment.dto';
import { CreateSupportTicketDto } from './create-support-ticket.dto';
import { canTransitionSupportTicket, initialSupportPriority } from './support-ticket-policy';
import { UpdateSupportTicketDto } from './update-support-ticket.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(user: AuthenticatedUser) {
    return this.prisma.supportTicket.findMany({
      where: { requesterUserId: user.id },
      include: {
        organization: { select: { id: true, displayName: true } },
        subjectOrganization: { select: { id: true, displayName: true } },
        relatedRfq: { select: { id: true, code: true, title: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  listAdminQueue(user: AuthenticatedUser) {
    this.requireSupportPermission(user);
    return this.prisma.supportTicket.findMany({
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, mobile: true } },
        organization: { select: { id: true, displayName: true } },
        subjectOrganization: { select: { id: true, displayName: true } },
        relatedRfq: { select: { id: true, code: true, title: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    });
  }

  async create(user: AuthenticatedUser, input: CreateSupportTicketDto) {
    await this.validateScope(user, input);
    const code = `VZT-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const priority = initialSupportPriority(input.type, input.category);

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          code,
          requesterUserId: user.id,
          organizationId: input.organizationId,
          subjectOrganizationId: input.subjectOrganizationId,
          relatedRfqId: input.relatedRfqId,
          type: input.type,
          category: input.category,
          priority,
          subject: input.subject.trim(),
          description: input.description.trim(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          organizationId: input.organizationId,
          action: input.type === 'VIOLATION_REPORT' ? 'violation_report.create' : 'support_ticket.create',
          entityType: 'SupportTicket',
          entityId: ticket.id,
          metadata: { code: ticket.code, type: ticket.type, priority },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'SupportTicket',
          aggregateId: ticket.id,
          eventType: 'ir.vazano.support.ticket.created.v1',
          payload: { ticketId: ticket.id, code: ticket.code, type: ticket.type, priority },
        },
      });
      return ticket;
    });
  }

  async getOne(user: AuthenticatedUser, ticketId: string) {
    const supportAccess = user.permissions.includes('support.manage');
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, ...(supportAccess ? {} : { requesterUserId: user.id }) },
      include: {
        organization: { select: { id: true, displayName: true } },
        subjectOrganization: { select: { id: true, displayName: true } },
        relatedRfq: { select: { id: true, code: true, title: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        comments: {
          where: supportAccess ? {} : { isInternal: false },
          include: { author: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) throw new NotFoundException('تیکت پیدا نشد.');
    return {
      ...ticket,
      capabilities: {
        canUploadPaymentReceipt: ticket.requesterUserId === user.id
          && ticket.type === 'SERVICE_REQUEST'
          && ticket.category === 'BILLING'
          && !['RESOLVED', 'CLOSED', 'REJECTED'].includes(ticket.status),
      },
    };
  }

  async addComment(user: AuthenticatedUser, ticketId: string, input: AddSupportCommentDto) {
    const supportAccess = user.permissions.includes('support.manage');
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, ...(supportAccess ? {} : { requesterUserId: user.id }) },
    });
    if (!ticket) throw new NotFoundException('تیکت پیدا نشد.');
    if (['CLOSED', 'REJECTED'].includes(ticket.status)) throw new ConflictException('امکان پاسخ به این تیکت بسته وجود ندارد.');
    if (input.isInternal && !supportAccess) throw new ForbiddenException('ثبت یادداشت داخلی مجاز نیست.');
    const body = input.body.trim();
    if (!body) throw new BadRequestException('متن پاسخ نمی‌تواند خالی باشد.');

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.supportTicketComment.create({
        data: { ticketId, authorUserId: user.id, body, isInternal: input.isInternal ?? false },
      });
      if (!supportAccess && ticket.status === 'WAITING_FOR_REQUESTER') {
        await tx.supportTicket.update({ where: { id: ticketId }, data: { status: 'IN_REVIEW' } });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          organizationId: ticket.organizationId,
          action: input.isInternal ? 'support_ticket.internal_note.add' : 'support_ticket.comment.add',
          entityType: 'SupportTicket',
          entityId: ticket.id,
        },
      });
      if (supportAccess && !input.isInternal) {
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'SupportTicket',
            aggregateId: ticket.id,
            eventType: 'ir.vazano.support.ticket.replied.v1',
            payload: { ticketId: ticket.id, commentId: comment.id },
          },
        });
      }
      return comment;
    });
  }

  async updateAsAdmin(user: AuthenticatedUser, ticketId: string, input: UpdateSupportTicketDto) {
    this.requireSupportPermission(user);
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('تیکت پیدا نشد.');
    if (!canTransitionSupportTicket(ticket.status, input.status)) {
      throw new ConflictException('این تغییر وضعیت برای تیکت مجاز نیست.');
    }
    const resolution = input.resolution?.trim() || ticket.resolution;
    if (['RESOLVED', 'REJECTED'].includes(input.status) && !resolution) {
      throw new BadRequestException('ثبت نتیجه رسیدگی برای این وضعیت الزامی است.');
    }
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.supportTicket.updateMany({
        where: { id: ticketId, updatedAt: ticket.updatedAt },
        data: {
          status: input.status,
          priority: input.priority,
          resolution,
          assignedToUserId: ticket.assignedToUserId ?? user.id,
          acknowledgedAt: ticket.acknowledgedAt ?? (input.status !== 'SUBMITTED' ? now : null),
          resolvedAt: input.status === 'RESOLVED' ? now : (input.status === 'IN_REVIEW' ? null : ticket.resolvedAt),
          closedAt: input.status === 'CLOSED' ? now : null,
        },
      });
      if (updateResult.count !== 1) {
        throw new ConflictException('این تیکت هم‌زمان توسط اپراتور دیگری تغییر کرده است؛ صف را تازه‌سازی کنید.');
      }
      if (input.comment?.trim()) {
        await tx.supportTicketComment.create({
          data: {
            ticketId,
            authorUserId: user.id,
            body: input.comment.trim(),
            isInternal: input.isInternalComment ?? false,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          organizationId: ticket.organizationId,
          action: 'support_ticket.status.update',
          entityType: 'SupportTicket',
          entityId: ticket.id,
          metadata: { from: ticket.status, to: input.status, priority: input.priority },
        },
      });
      if (ticket.status !== input.status) {
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'SupportTicket',
            aggregateId: ticket.id,
            eventType: 'ir.vazano.support.ticket.status_changed.v1',
            payload: { ticketId: ticket.id, from: ticket.status, to: input.status },
          },
        });
      } else if (input.comment?.trim() && !input.isInternalComment) {
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'SupportTicket',
            aggregateId: ticket.id,
            eventType: 'ir.vazano.support.ticket.replied.v1',
            payload: { ticketId: ticket.id },
          },
        });
      }
      return tx.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async validateScope(user: AuthenticatedUser, input: CreateSupportTicketDto): Promise<void> {
    const organizationIds = user.memberships.map((membership) => membership.organizationId);
    if (input.organizationId && !organizationIds.includes(input.organizationId)) {
      throw new ForbiddenException('ثبت تیکت برای این سازمان مجاز نیست.');
    }
    if (input.subjectOrganizationId) {
      const subjectExists = await this.prisma.organization.count({ where: { id: input.subjectOrganizationId } });
      if (!subjectExists) throw new BadRequestException('سازمان موضوع گزارش معتبر نیست.');
    }
    if (input.relatedRfqId) {
      const rfq = await this.prisma.rfq.findFirst({
        where: {
          id: input.relatedRfqId,
          OR: [
            { buyerOrganizationId: { in: organizationIds } },
            { invitations: { some: { supplierOrganizationId: { in: organizationIds } } } },
          ],
        },
        select: { id: true },
      });
      if (!rfq) throw new ForbiddenException('استعلام مرتبط در دسترس شما نیست.');
    }
  }

  private requireSupportPermission(user: AuthenticatedUser): void {
    if (!user.permissions.includes('support.manage')) {
      throw new ForbiddenException('شما مجوز رسیدگی به تیکت‌ها را ندارید.');
    }
  }
}
