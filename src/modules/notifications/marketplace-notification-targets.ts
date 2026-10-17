import { Prisma } from '@prisma/client';
import type { NotificationTarget, SupportedOutboxEvent } from './operational-notification-targets';

export async function resolveMarketplaceNotificationTargets(
  tx: Prisma.TransactionClient,
  event: SupportedOutboxEvent,
): Promise<NotificationTarget[] | null> {
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
        variables: { rfqCode: rfq.code, rfqTitle: rfq.title, approvalStatus: approvalLabel(rfq.approvalStatus) },
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
      return uniqueTargets(rfq.invitations.flatMap((invitation) => invitation.supplierOrganization.members.map((member) => ({
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
      return uniqueTargets(organizations.flatMap((organization) => organization.members.map((member) => ({
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
      return uniqueTargets([
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
      return uniqueTargets([
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
      return uniqueTargets(quotation.supplierOrganization.members.map((member) => ({
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
    default:
      return null;
  }
}

function uniqueTargets(targets: NotificationTarget[]): NotificationTarget[] {
  return [...new Map(targets.map((target) => [target.userId, target])).values()];
}

function approvalLabel(status: string): string {
  return ({ APPROVED: 'تأیید شد', NEEDS_CHANGES: 'نیازمند اصلاح است', REJECTED: 'رد شد' } as Record<string, string>)[status] ?? status;
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
