import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { renderNotificationTemplate } from './template-renderer';

const SUPPORTED_EVENT_TYPES = [
  'ir.vazano.rfq.submitted.v1',
  'ir.vazano.rfq.reviewed.v1',
  'ir.vazano.rfq.distributed.v1',
  'ir.vazano.quotation.submitted.v1',
  'ir.vazano.quotation.accepted.v1',
  'ir.vazano.subscription.activated.v1',
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
      select: { id: true, eventType: true, aggregateType: true, aggregateId: true },
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
      default:
        return [];
    }
  }

  private uniqueTargets(targets: NotificationTarget[]): NotificationTarget[] {
    return [...new Map(targets.map((target) => [target.userId, target])).values()];
  }

  private approvalLabel(status: string): string {
    return ({ APPROVED: 'تأیید شد', NEEDS_CHANGES: 'نیازمند اصلاح است', REJECTED: 'رد شد' } as Record<string, string>)[status] ?? status;
  }
}
