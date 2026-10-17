import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { renderNotificationTemplate } from './template-renderer';

const SUPPORTED_EVENT_TYPES = [
  'ir.vazano.organization.member_invited.v1',
  'ir.vazano.supplier.profile.submitted.v1',
  'ir.vazano.supplier.verification.changed.v1',
  'ir.vazano.quality_control.quoted.v1',
  'ir.vazano.quality_control.accepted.v1',
  'ir.vazano.quality_control.in_progress.v1',
  'ir.vazano.quality_control.completed.v1',
  'ir.vazano.quality_control.cancelled.v1',
  'ir.vazano.supplier.review_published.v1',
  'ir.vazano.buyer.commitment.held.v1',
  'ir.vazano.rfq.submitted.v1',
  'ir.vazano.rfq.reviewed.v1',
  'ir.vazano.rfq.distributed.v1',
  'ir.vazano.rfq.cancelled.v1',
  'ir.vazano.rfq.quote_window_closed.v1',
  'ir.vazano.quotation.submitted.v1',
  'ir.vazano.quotation.accepted.v1',
  'ir.vazano.quotation.rejected.v1',
  'ir.vazano.quotation.withdrawn.v1',
  'ir.vazano.contract.requested.v1',
  'ir.vazano.contract.under_review.v1',
  'ir.vazano.contract.terms_prepared.v1',
  'ir.vazano.contract.accepted.v1',
  'ir.vazano.contract.completed.v1',
  'ir.vazano.contract.cancelled.v1',
  'ir.vazano.message.sent.v1',
  'ir.vazano.support.ticket.created.v1',
  'ir.vazano.support.ticket.status_changed.v1',
  'ir.vazano.support.ticket.replied.v1',
  'ir.vazano.subscription.activated.v1',
  'ir.vazano.subscription.renewal.14_days_before.v1',
  'ir.vazano.subscription.renewal.7_days_before.v1',
  'ir.vazano.subscription.renewal.3_days_before.v1',
  'ir.vazano.subscription.renewal.expired.v1',
  'ir.vazano.subscription.renewal.grace_ended.v1',
  'ir.vazano.subscription.trial.7_days_before.v1',
  'ir.vazano.subscription.trial.3_days_before.v1',
  'ir.vazano.subscription.trial.1_day_before.v1',
  'ir.vazano.subscription.trial.expired.v1',
  'ir.vazano.payment.retry_requested.v1',
] as const;

type NotificationTarget = {
  userId: string;
  organizationId?: string;
  actionPath?: string;
  variables: Record<string, string>;
};

type SupportedOutboxEvent = {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Prisma.JsonValue;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(userId: string) {
    return this.prisma.notification.findMany({
      where: { recipientUserId: userId, channel: 'IN_APP', status: 'DELIVERED' },
      select: {
        id: true,
        eventType: true,
        title: true,
        body: true,
        actionPath: true,
        readAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { recipientUserId: userId, channel: 'IN_APP', status: 'DELIVERED', readAt: null },
    });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, recipientUserId: userId, channel: 'IN_APP' },
      data: { readAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('اعلان پیدا نشد.');
    return { notificationId, read: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { recipientUserId: userId, channel: 'IN_APP', status: 'DELIVERED', readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async processPendingEvents(limit = 50): Promise<{ events: number; notifications: number }> {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        eventType: { in: [...SUPPORTED_EVENT_TYPES] },
        availableAt: { lte: new Date() },
        notificationDispatches: { none: { channel: 'IN_APP' } },
      },
      select: { id: true, eventType: true, aggregateType: true, aggregateId: true, payload: true },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    let notificationCount = 0;
    let processedEvents = 0;
    for (const event of events) {
      const created = await this.processEvent(event);
      if (created !== null) {
        processedEvents += 1;
        notificationCount += created;
      }
    }
    return { events: processedEvents, notifications: notificationCount };
  }

  private processEvent(event: SupportedOutboxEvent): Promise<number | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.notificationDispatch.findUnique({
        where: { sourceEventId_channel: { sourceEventId: event.id, channel: 'IN_APP' } },
      });
      if (existing) return null;

      const template = await tx.notificationTemplate.findUnique({
        where: {
          eventType_channel_locale: {
            eventType: event.eventType,
            channel: NotificationChannel.IN_APP,
            locale: 'fa-IR',
          },
        },
      });
      if (!template?.isActive) {
        await tx.notificationDispatch.create({
          data: {
            sourceEventId: event.id,
            channel: 'IN_APP',
            status: 'FAILED',
            failureReason: 'ACTIVE_TEMPLATE_NOT_FOUND',
          },
        });
        return 0;
      }

      const targets = await this.resolveTargets(tx, event);
      if (targets.length > 0) {
        await tx.notification.createMany({
          data: targets.map((target) => ({
            recipientUserId: target.userId,
            organizationId: target.organizationId,
            sourceEventId: event.id,
            templateId: template.id,
            eventType: event.eventType,
            channel: NotificationChannel.IN_APP,
            status: 'DELIVERED',
            title: renderNotificationTemplate(template.titleTemplate, target.variables),
            body: renderNotificationTemplate(template.bodyTemplate, target.variables),
            actionPath: target.actionPath ?? (template.actionPathTemplate
              ? renderNotificationTemplate(template.actionPathTemplate, target.variables)
              : undefined),
            metadata: {
              aggregateType: event.aggregateType,
              aggregateId: event.aggregateId,
              templateCode: template.code,
              templateVersion: template.version,
            },
          })),
          skipDuplicates: true,
        });
      }
      await tx.notificationDispatch.create({
        data: { sourceEventId: event.id, channel: 'IN_APP', status: 'PROCESSED', recipientCount: targets.length },
      });
      return targets.length;
    });
  }

  private async resolveTargets(tx: Prisma.TransactionClient, event: SupportedOutboxEvent): Promise<NotificationTarget[]> {
    switch (event.eventType) {
      case 'ir.vazano.organization.member_invited.v1': {
        const membership = await tx.organizationMember.findUnique({
          where: { id: event.aggregateId },
          select: {
            userId: true,
            role: true,
            status: true,
            organizationId: true,
            organization: { select: { displayName: true } },
          },
        });
        if (!membership || membership.status !== 'INVITED') return [];
        return [{
          userId: membership.userId,
          organizationId: membership.organizationId,
          actionPath: '/dashboard/organization',
          variables: {
            organizationName: membership.organization.displayName,
            memberRole: this.memberRoleLabel(membership.role),
          },
        }];
      }
      case 'ir.vazano.supplier.profile.submitted.v1': {
        const [profile, verifiers] = await Promise.all([
          tx.supplierProfile.findUnique({
            where: { id: event.aggregateId },
            select: { organization: { select: { displayName: true } } },
          }),
          tx.user.findMany({
            where: {
              status: 'ACTIVE',
              userRoles: { some: { organizationId: null, role: { key: { in: ['SUPER_ADMIN', 'ADMIN'] } } } },
            },
            select: { id: true },
          }),
        ]);
        if (!profile) return [];
        return verifiers.map(({ id }) => ({
          userId: id,
          actionPath: '/admin/suppliers',
          variables: { supplierName: profile.organization.displayName },
        }));
      }
      case 'ir.vazano.supplier.verification.changed.v1': {
        const profile = await tx.supplierProfile.findUnique({
          where: { id: event.aggregateId },
          select: {
            organizationId: true,
            verificationStatus: true,
            verificationReason: true,
            organization: {
              select: {
                displayName: true,
                members: { where: { status: 'ACTIVE' }, select: { userId: true } },
              },
            },
          },
        });
        if (!profile) return [];
        return profile.organization.members.map(({ userId }) => ({
          userId,
          organizationId: profile.organizationId,
          actionPath: `/supplier/profile/${profile.organizationId}`,
          variables: {
            organizationId: profile.organizationId,
            supplierName: profile.organization.displayName,
            verificationStatus: this.supplierVerificationLabel(profile.verificationStatus),
            verificationReason: profile.verificationReason || 'بدون توضیح تکمیلی',
          },
        }));
      }
      case 'ir.vazano.quality_control.quoted.v1':
      case 'ir.vazano.quality_control.accepted.v1':
      case 'ir.vazano.quality_control.in_progress.v1':
      case 'ir.vazano.quality_control.completed.v1':
      case 'ir.vazano.quality_control.cancelled.v1': {
        const request = await tx.qualityControlRequest.findUnique({
          where: { id: event.aggregateId },
          select: {
            status: true,
            feeAmountRial: true,
            rfq: {
              select: {
                id: true,
                code: true,
                title: true,
                buyerOrganizationId: true,
                buyerOrganization: {
                  select: { members: { where: { status: 'ACTIVE' }, select: { userId: true } } },
                },
              },
            },
          },
        });
        if (!request) return [];
        const variables = {
          rfqId: request.rfq.id,
          rfqCode: request.rfq.code,
          rfqTitle: request.rfq.title,
          qualityStatus: this.qualityControlStatusLabel(request.status),
          feeAmountToman: ((request.feeAmountRial ?? 0n) / 10n).toLocaleString('fa-IR'),
          note: jsonStringField(event.payload, 'note') ?? 'بدون توضیح تکمیلی',
        };
        const buyerTargets = request.rfq.buyerOrganization.members.map(({ userId }) => ({
          userId,
          organizationId: request.rfq.buyerOrganizationId,
          actionPath: `/dashboard/rfqs/${request.rfq.id}`,
          variables,
        }));
        if (event.eventType !== 'ir.vazano.quality_control.accepted.v1') {
          return buyerTargets;
        }
        const operators = await tx.user.findMany({
          where: {
            status: 'ACTIVE',
            userRoles: { some: { organizationId: null, role: { key: { in: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] } } } },
          },
          select: { id: true },
        });
        return this.uniqueTargets([
          ...buyerTargets,
          ...operators.map(({ id }) => ({ userId: id, actionPath: '/admin/quality-control', variables })),
        ]);
      }
      case 'ir.vazano.supplier.review_published.v1': {
        const review = await tx.supplierReview.findUnique({
          where: { id: event.aggregateId },
          select: {
            rating: true,
            supplierOrganizationId: true,
            supplierOrganization: {
              select: { members: { where: { status: 'ACTIVE' }, select: { userId: true } } },
            },
            rfq: { select: { code: true } },
          },
        });
        if (!review) return [];
        return review.supplierOrganization.members.map(({ userId }) => ({
          userId,
          organizationId: review.supplierOrganizationId,
          actionPath: '/supplier',
          variables: {
            rfqCode: review.rfq.code,
            rating: review.rating.toLocaleString('fa-IR'),
          },
        }));
      }
      case 'ir.vazano.buyer.commitment.held.v1': {
        const rfq = await tx.rfq.findUnique({
          where: { id: event.aggregateId },
          select: {
            id: true,
            code: true,
            buyerOrganizationId: true,
            buyerOrganization: {
              select: { members: { where: { status: 'ACTIVE' }, select: { userId: true } } },
            },
          },
        });
        if (!rfq) return [];
        return rfq.buyerOrganization.members.map(({ userId }) => ({
          userId,
          organizationId: rfq.buyerOrganizationId,
          actionPath: `/dashboard/rfqs/${rfq.id}`,
          variables: {
            rfqId: rfq.id,
            rfqCode: rfq.code,
            receiptNumber: jsonStringField(event.payload, 'receiptNumber') ?? '—',
          },
        }));
      }
      case 'ir.vazano.rfq.submitted.v1': {
        const [rfq, admins] = await Promise.all([
          tx.rfq.findUnique({ where: { id: event.aggregateId }, select: { code: true, title: true } }),
          tx.user.findMany({
            where: {
              status: 'ACTIVE',
              userRoles: { some: { organizationId: null, role: { key: { in: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] } } } },
            },
            select: { id: true },
          }),
        ]);
        if (!rfq) return [];
        return admins.map(({ id }) => ({
          userId: id,
          actionPath: '/admin/rfqs',
          variables: { rfqCode: rfq.code, rfqTitle: rfq.title },
        }));
      }
      case 'ir.vazano.rfq.reviewed.v1': {
        const rfq = await tx.rfq.findUnique({
          where: { id: event.aggregateId },
          select: { id: true, code: true, title: true, buyerContactUserId: true, buyerOrganizationId: true, approvalStatus: true },
        });
        if (!rfq) return [];
        return [{
          userId: rfq.buyerContactUserId,
          organizationId: rfq.buyerOrganizationId,
          actionPath: `/dashboard/rfqs/${rfq.id}`,
          variables: { rfqCode: rfq.code, rfqTitle: rfq.title, approvalStatus: this.approvalLabel(rfq.approvalStatus) },
        }];
      }
      case 'ir.vazano.rfq.distributed.v1': {
        const rfq = await tx.rfq.findUnique({
          where: { id: event.aggregateId },
          select: {
            code: true,
            title: true,
            invitations: {
              select: {
                supplierOrganizationId: true,
                supplierOrganization: {
                  select: { members: { where: { status: 'ACTIVE' }, select: { userId: true } } },
                },
              },
            },
          },
        });
        if (!rfq) return [];
        return this.uniqueTargets(rfq.invitations.flatMap((invitation) => invitation.supplierOrganization.members.map((member) => ({
          userId: member.userId,
          organizationId: invitation.supplierOrganizationId,
          actionPath: '/supplier',
          variables: { rfqCode: rfq.code, rfqTitle: rfq.title },
        }))));
      }
      case 'ir.vazano.rfq.cancelled.v1': {
        const supplierOrganizationIds = jsonStringArrayField(event.payload, 'supplierOrganizationIds');
        if (supplierOrganizationIds.length === 0) return [];
        const [rfq, organizations] = await Promise.all([
          tx.rfq.findUnique({ where: { id: event.aggregateId }, select: { code: true, title: true } }),
          tx.organization.findMany({
            where: { id: { in: supplierOrganizationIds } },
            select: { id: true, members: { where: { status: 'ACTIVE' }, select: { userId: true } } },
          }),
        ]);
        if (!rfq) return [];
        return this.uniqueTargets(organizations.flatMap((organization) => organization.members.map((member) => ({
          userId: member.userId,
          organizationId: organization.id,
          actionPath: '/supplier',
          variables: { rfqCode: rfq.code, rfqTitle: rfq.title },
        }))));
      }
      case 'ir.vazano.rfq.quote_window_closed.v1': {
        const rfq = await tx.rfq.findUnique({
          where: { id: event.aggregateId },
          select: {
            id: true,
            code: true,
            buyerContactUserId: true,
            buyerOrganizationId: true,
            invitations: { select: { supplierOrganizationId: true, supplierOrganization: { select: { members: { where: { status: 'ACTIVE' }, select: { userId: true } } } } } },
          },
        });
        if (!rfq) return [];
        const outcome = jsonStringField(event.payload, 'outcome');
        const statusLabel = outcome === 'NEGOTIATING' ? 'آماده مقایسه و انتخاب' : 'بدون پیشنهاد منقضی شد';
        return this.uniqueTargets([
          { userId: rfq.buyerContactUserId, organizationId: rfq.buyerOrganizationId, actionPath: `/dashboard/rfqs/${rfq.id}`, variables: { rfqCode: rfq.code, statusLabel } },
          ...rfq.invitations.flatMap((invitation) => invitation.supplierOrganization.members.map((member) => ({
            userId: member.userId,
            organizationId: invitation.supplierOrganizationId,
            actionPath: '/supplier',
            variables: { rfqCode: rfq.code, statusLabel },
          }))),
        ]);
      }
      case 'ir.vazano.quotation.submitted.v1': {
        const quotation = await tx.quotation.findUnique({
          where: { id: event.aggregateId },
          select: {
            code: true,
            rfq: { select: { id: true, code: true, buyerContactUserId: true, buyerOrganizationId: true } },
            supplierOrganization: { select: { displayName: true } },
          },
        });
        if (!quotation) return [];
        return [{
          userId: quotation.rfq.buyerContactUserId,
          organizationId: quotation.rfq.buyerOrganizationId,
          actionPath: `/dashboard/rfqs/${quotation.rfq.id}`,
          variables: { quotationCode: quotation.code, rfqCode: quotation.rfq.code, supplierName: quotation.supplierOrganization.displayName },
        }];
      }
      case 'ir.vazano.quotation.accepted.v1': {
        const quotation = await tx.quotation.findUnique({
          where: { id: event.aggregateId },
          select: {
            code: true,
            supplierOrganizationId: true,
            supplierOrganization: { select: { displayName: true, members: { where: { status: 'ACTIVE' }, select: { userId: true } } } },
            rfq: { select: { id: true, code: true, buyerContactUserId: true, buyerOrganizationId: true } },
          },
        });
        if (!quotation) return [];
        const variables = { quotationCode: quotation.code, rfqCode: quotation.rfq.code, supplierName: quotation.supplierOrganization.displayName };
        return this.uniqueTargets([
          {
            userId: quotation.rfq.buyerContactUserId,
            organizationId: quotation.rfq.buyerOrganizationId,
            actionPath: `/dashboard/rfqs/${quotation.rfq.id}`,
            variables,
          },
          ...quotation.supplierOrganization.members.map((member) => ({
            userId: member.userId,
            organizationId: quotation.supplierOrganizationId,
            actionPath: '/supplier',
            variables,
          })),
        ]);
      }
      case 'ir.vazano.quotation.rejected.v1': {
        const quotation = await tx.quotation.findUnique({
          where: { id: event.aggregateId },
          select: {
            code: true,
            supplierOrganizationId: true,
            supplierOrganization: { select: { members: { where: { status: 'ACTIVE' }, select: { userId: true } } } },
            rfq: { select: { code: true } },
          },
        });
        if (!quotation) return [];
        const refundCredits = jsonStringField(event.payload, 'refundCredits') ?? '0';
        return this.uniqueTargets(quotation.supplierOrganization.members.map((member) => ({
          userId: member.userId,
          organizationId: quotation.supplierOrganizationId,
          actionPath: '/supplier',
          variables: { quotationCode: quotation.code, rfqCode: quotation.rfq.code, refundCredits },
        })));
      }
      case 'ir.vazano.quotation.withdrawn.v1': {
        const quotation = await tx.quotation.findUnique({
          where: { id: event.aggregateId },
          select: { code: true, rfq: { select: { id: true, code: true, buyerContactUserId: true, buyerOrganizationId: true } }, supplierOrganization: { select: { displayName: true } } },
        });
        if (!quotation) return [];
        return [{
          userId: quotation.rfq.buyerContactUserId,
          organizationId: quotation.rfq.buyerOrganizationId,
          actionPath: `/dashboard/rfqs/${quotation.rfq.id}`,
          variables: { quotationCode: quotation.code, rfqCode: quotation.rfq.code, supplierName: quotation.supplierOrganization.displayName },
        }];
      }
      case 'ir.vazano.contract.requested.v1': {
        const [request, operators] = await Promise.all([
          tx.contractRequest.findUnique({
            where: { id: event.aggregateId },
            select: { code: true, rfq: { select: { code: true } }, buyerOrganization: { select: { displayName: true } } },
          }),
          tx.user.findMany({
            where: { status: 'ACTIVE', userRoles: { some: { organizationId: null, role: { key: { in: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] } } } } },
            select: { id: true },
          }),
        ]);
        if (!request) return [];
        return operators.map(({ id }) => ({
          userId: id,
          actionPath: '/admin/contracts',
          variables: { contractCode: request.code, rfqCode: request.rfq.code, buyerName: request.buyerOrganization.displayName },
        }));
      }
      case 'ir.vazano.contract.under_review.v1':
      case 'ir.vazano.contract.completed.v1':
      case 'ir.vazano.contract.cancelled.v1': {
        const request = await tx.contractRequest.findUnique({
          where: { id: event.aggregateId },
          select: {
            code: true,
            status: true,
            requestedByUserId: true,
            buyerOrganizationId: true,
            supplierOrganizationId: true,
            rfq: { select: { id: true, code: true } },
            supplierOrganization: {
              select: { members: { where: { status: 'ACTIVE' }, select: { userId: true } } },
            },
          },
        });
        if (!request) return [];
        const variables = {
          contractCode: request.code,
          rfqCode: request.rfq.code,
          contractStatus: this.contractStatusLabel(request.status),
          note: jsonStringField(event.payload, 'note') ?? 'بدون توضیح تکمیلی',
        };
        const buyerTarget = {
          userId: request.requestedByUserId,
          organizationId: request.buyerOrganizationId,
          actionPath: `/dashboard/rfqs/${request.rfq.id}`,
          variables,
        };
        if (event.eventType === 'ir.vazano.contract.under_review.v1') return [buyerTarget];
        return this.uniqueTargets([
          buyerTarget,
          ...request.supplierOrganization.members.map(({ userId }) => ({
            userId,
            organizationId: request.supplierOrganizationId,
            actionPath: '/supplier',
            variables,
          })),
        ]);
      }
      case 'ir.vazano.contract.terms_prepared.v1': {
        const request = await tx.contractRequest.findUnique({
          where: { id: event.aggregateId },
          select: { code: true, requestedByUserId: true, buyerOrganizationId: true, rfq: { select: { id: true, code: true } } },
        });
        if (!request) return [];
        return [{
          userId: request.requestedByUserId,
          organizationId: request.buyerOrganizationId,
          actionPath: `/dashboard/rfqs/${request.rfq.id}`,
          variables: { contractCode: request.code, rfqCode: request.rfq.code, rfqId: request.rfq.id },
        }];
      }
      case 'ir.vazano.contract.accepted.v1': {
        const [request, operators] = await Promise.all([
          tx.contractRequest.findUnique({
            where: { id: event.aggregateId },
            select: {
              code: true,
              supplierOrganizationId: true,
              rfq: { select: { code: true } },
              supplierOrganization: { select: { members: { where: { status: 'ACTIVE' }, select: { userId: true } } } },
            },
          }),
          tx.user.findMany({
            where: { status: 'ACTIVE', userRoles: { some: { organizationId: null, role: { key: { in: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] } } } } },
            select: { id: true },
          }),
        ]);
        if (!request) return [];
        const variables = { contractCode: request.code, rfqCode: request.rfq.code };
        return this.uniqueTargets([
          ...operators.map(({ id }) => ({ userId: id, actionPath: '/admin/contracts', variables })),
          ...request.supplierOrganization.members.map(({ userId }) => ({ userId, organizationId: request.supplierOrganizationId, actionPath: '/supplier', variables })),
        ]);
      }
      case 'ir.vazano.message.sent.v1': {
        const message = await tx.message.findUnique({
          where: { id: event.aggregateId },
          select: {
            id: true,
            senderUserId: true,
            senderOrganizationId: true,
            sender: { select: { firstName: true, lastName: true } },
            senderOrganization: { select: { displayName: true } },
            thread: {
              select: {
                id: true,
                buyerOrganizationId: true,
                supplierOrganizationId: true,
                rfq: { select: { code: true } },
                buyerOrganization: {
                  select: { members: { where: { status: 'ACTIVE' }, select: { userId: true } } },
                },
                supplierOrganization: {
                  select: { members: { where: { status: 'ACTIVE' }, select: { userId: true } } },
                },
              },
            },
          },
        });
        if (!message) return [];
        const senderName = [message.sender.firstName, message.sender.lastName].filter(Boolean).join(' ')
          || message.senderOrganization.displayName;
        const recipientOrganizationId = message.senderOrganizationId === message.thread.buyerOrganizationId
          ? message.thread.supplierOrganizationId
          : message.thread.buyerOrganizationId;
        const members = recipientOrganizationId === message.thread.buyerOrganizationId
          ? message.thread.buyerOrganization.members
          : message.thread.supplierOrganization.members;
        return members
          .filter((member) => member.userId !== message.senderUserId)
          .map((member) => ({
            userId: member.userId,
            organizationId: recipientOrganizationId,
            actionPath: `/messages?thread=${message.thread.id}`,
            variables: {
              senderName,
              rfqCode: message.thread.rfq.code,
              threadId: message.thread.id,
            },
          }));
      }
      case 'ir.vazano.support.ticket.created.v1': {
        const ticket = await tx.supportTicket.findUnique({
          where: { id: event.aggregateId },
          select: { id: true, code: true, type: true, category: true, priority: true, subject: true },
        });
        if (!ticket) return [];
        const roleKeys = ticket.category === 'BILLING'
          ? ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'FINANCE']
          : ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'];
        const supportUsers = await tx.user.findMany({
          where: {
            status: 'ACTIVE',
            userRoles: { some: { organizationId: null, role: { key: { in: roleKeys } } } },
          },
          select: {
            id: true,
            userRoles: { where: { organizationId: null, role: { key: { in: roleKeys } } }, select: { role: { select: { key: true } } } },
          },
        });
        return supportUsers.map((target) => {
          const roles = target.userRoles.map((item) => item.role.key);
          const financeOnly = roles.includes('FINANCE') && !roles.some((role) => ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(role));
          return {
            userId: target.id,
            actionPath: financeOnly ? '/admin/billing' : '/admin/support',
            variables: {
              ticketCode: ticket.code,
              ticketSubject: ticket.subject,
              ticketPriority: ticket.priority,
              ticketType: this.ticketTypeLabel(ticket.type),
            },
          };
        });
      }
      case 'ir.vazano.support.ticket.status_changed.v1': {
        const ticket = await tx.supportTicket.findUnique({
          where: { id: event.aggregateId },
          select: { id: true, code: true, requesterUserId: true, organizationId: true, status: true },
        });
        if (!ticket) return [];
        return [{
          userId: ticket.requesterUserId,
          organizationId: ticket.organizationId ?? undefined,
          actionPath: `/support/${ticket.id}`,
          variables: {
            ticketCode: ticket.code,
            ticketStatus: this.ticketStatusLabel(ticket.status),
          },
        }];
      }
      case 'ir.vazano.support.ticket.replied.v1': {
        const ticket = await tx.supportTicket.findUnique({
          where: { id: event.aggregateId },
          select: { id: true, code: true, requesterUserId: true, organizationId: true },
        });
        if (!ticket) return [];
        return [{
          userId: ticket.requesterUserId,
          organizationId: ticket.organizationId ?? undefined,
          actionPath: `/support/${ticket.id}`,
          variables: { ticketCode: ticket.code },
        }];
      }
      case 'ir.vazano.subscription.activated.v1': {
        const subscription = await tx.subscription.findUnique({
          where: { id: event.aggregateId },
          select: {
            organizationId: true,
            expiresAt: true,
            plan: { select: { nameFa: true } },
            organization: { select: { members: { where: { status: 'ACTIVE' }, select: { userId: true } } } },
          },
        });
        if (!subscription) return [];
        const expiresAt = subscription.expiresAt
          ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeZone: 'Asia/Tehran' }).format(subscription.expiresAt)
          : '';
        return subscription.organization.members.map((member) => ({
          userId: member.userId,
          organizationId: subscription.organizationId,
          actionPath: '/supplier',
          variables: { planName: subscription.plan.nameFa, expiresAt },
        }));
      }
      case 'ir.vazano.subscription.renewal.14_days_before.v1':
      case 'ir.vazano.subscription.renewal.7_days_before.v1':
      case 'ir.vazano.subscription.renewal.3_days_before.v1':
      case 'ir.vazano.subscription.renewal.expired.v1':
      case 'ir.vazano.subscription.renewal.grace_ended.v1':
      case 'ir.vazano.subscription.trial.7_days_before.v1':
      case 'ir.vazano.subscription.trial.3_days_before.v1':
      case 'ir.vazano.subscription.trial.1_day_before.v1':
      case 'ir.vazano.subscription.trial.expired.v1': {
        const reminder = await tx.subscriptionReminder.findUnique({
          where: { id: event.aggregateId },
          select: {
            subscription: {
              select: {
                organizationId: true,
                expiresAt: true,
                graceEndsAt: true,
                priceRialSnapshot: true,
                plan: { select: { nameFa: true } },
                organization: { select: { members: { where: { status: 'ACTIVE' }, select: { userId: true } } } },
              },
            },
          },
        });
        if (!reminder) return [];
        const subscription = reminder.subscription;
        const formatDate = (date: Date | null) => date
          ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeZone: 'Asia/Tehran' }).format(date)
          : '';
        const variables = {
          planName: subscription.plan.nameFa,
          expiresAt: formatDate(subscription.expiresAt),
          graceEndsAt: formatDate(subscription.graceEndsAt),
          renewalAmountToman: (subscription.priceRialSnapshot / 10n).toLocaleString('fa-IR'),
        };
        return subscription.organization.members.map((member) => ({
          userId: member.userId,
          organizationId: subscription.organizationId,
          actionPath: '/plans',
          variables,
        }));
      }
      case 'ir.vazano.payment.retry_requested.v1': {
        const payment = await tx.paymentIntent.findUnique({
          where: { id: event.aggregateId },
          select: { amountRial: true, purpose: true, referenceId: true, payerOrganizationId: true },
        });
        if (!payment?.payerOrganizationId) return [];
        const organization = await tx.organization.findUnique({
          where: { id: payment.payerOrganizationId },
          select: {
            members: {
              where: {
                status: 'ACTIVE',
                role: { in: ['BUYER_OWNER', 'SUPPLIER_OWNER', 'SUPPLIER_MANAGER'] },
              },
              select: { userId: true },
            },
          },
        });
        if (!organization) return [];
        let actionPath = payment.purpose === 'SUBSCRIPTION'
          ? '/supplier/subscription'
          : `/dashboard/rfqs/${payment.referenceId}`;
        if (payment.purpose === 'QUALITY_CONTROL') {
          const qualityControl = await tx.qualityControlRequest.findUnique({
            where: { id: payment.referenceId },
            select: { rfqId: true },
          });
          if (!qualityControl) return [];
          actionPath = `/dashboard/rfqs/${qualityControl.rfqId}`;
        }
        const variables = {
          amountToman: (payment.amountRial / 10n).toLocaleString('fa-IR'),
          paymentPurpose: this.paymentPurposeLabel(payment.purpose),
        };
        return organization.members.map((member) => ({
          userId: member.userId,
          organizationId: payment.payerOrganizationId ?? undefined,
          actionPath,
          variables,
        }));
      }
      default:
        return [];
    }
  }

  private memberRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      BUYER_OWNER: 'مالک حساب خریدار',
      BUYER_MEMBER: 'عضو خریدار',
      SUPPLIER_OWNER: 'مالک حساب فروشنده',
      SUPPLIER_MANAGER: 'مدیر فروش',
      SUPPLIER_SALES: 'کارشناس فروش',
    };
    return labels[role] ?? role;
  }

  private uniqueTargets(targets: NotificationTarget[]): NotificationTarget[] {
    return [...new Map(targets.map((target) => [target.userId, target])).values()];
  }

  private approvalLabel(status: string): string {
    return ({ APPROVED: 'تأیید شد', NEEDS_CHANGES: 'نیازمند اصلاح است', REJECTED: 'رد شد' } as Record<string, string>)[status] ?? status;
  }

  private supplierVerificationLabel(status: string): string {
    return ({
      VERIFIED: 'تأیید شد',
      NEEDS_CORRECTION: 'نیازمند اصلاح است',
      REJECTED: 'رد شد',
      SUSPENDED: 'تعلیق شد',
    } as Record<string, string>)[status] ?? status;
  }

  private qualityControlStatusLabel(status: string): string {
    return ({
      QUOTED: 'آماده پرداخت',
      ACCEPTED: 'پرداخت‌شده و آماده اجرا',
      IN_PROGRESS: 'در حال انجام',
      COMPLETED: 'تکمیل‌شده',
      CANCELLED: 'لغوشده',
    } as Record<string, string>)[status] ?? status;
  }

  private contractStatusLabel(status: string): string {
    return ({
      UNDER_REVIEW: 'در حال بررسی',
      COMPLETED: 'تکمیل‌شده',
      CANCELLED: 'لغوشده',
    } as Record<string, string>)[status] ?? status;
  }

  private ticketTypeLabel(type: string): string {
    return ({
      QUESTION: 'پرسش', SERVICE_REQUEST: 'درخواست خدمت', ISSUE: 'مشکل', COMPLAINT: 'شکایت',
      VIOLATION_REPORT: 'گزارش تخلف', APPEAL: 'اعتراض',
    } as Record<string, string>)[type] ?? type;
  }

  private ticketStatusLabel(status: string): string {
    return ({
      SUBMITTED: 'ثبت‌شده', ACKNOWLEDGED: 'دریافت‌شده', IN_REVIEW: 'در حال بررسی',
      WAITING_FOR_REQUESTER: 'در انتظار پاسخ شما', RESOLVED: 'حل‌شده', CLOSED: 'بسته‌شده', REJECTED: 'ردشده',
    } as Record<string, string>)[status] ?? status;
  }

  private paymentPurposeLabel(purpose: string): string {
    return ({
      SUBSCRIPTION: 'اشتراک فروشنده',
      BUYER_COMMITMENT: 'سپرده تعهد خریدار',
      QUALITY_CONTROL: 'خدمت کنترل کیفیت',
    } as Record<string, string>)[purpose] ?? 'خدمت وازانو';
  }
}

function jsonStringField(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : null;
}

function jsonStringArrayField(value: unknown, key: string): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const field = (value as Record<string, unknown>)[key];
  return Array.isArray(field) ? field.filter((item): item is string => typeof item === 'string') : [];
}
