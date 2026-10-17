import { Prisma } from '@prisma/client';

export type NotificationTarget = {
  userId: string;
  organizationId?: string;
  actionPath?: string;
  variables: Record<string, string>;
};

export type SupportedOutboxEvent = {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Prisma.JsonValue;
};

export async function resolveOperationalNotificationTargets(
  tx: Prisma.TransactionClient,
  event: SupportedOutboxEvent,
): Promise<NotificationTarget[] | null> {
  switch (event.eventType) {
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
          verificationStatus: supplierVerificationLabel(profile.verificationStatus),
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
        qualityStatus: qualityControlStatusLabel(request.status),
        feeAmountToman: ((request.feeAmountRial ?? 0n) / 10n).toLocaleString('fa-IR'),
        note: jsonStringField(event.payload, 'note') ?? 'بدون توضیح تکمیلی',
      };
      const buyerTargets = request.rfq.buyerOrganization.members.map(({ userId }) => ({
        userId,
        organizationId: request.rfq.buyerOrganizationId,
        actionPath: `/dashboard/rfqs/${request.rfq.id}`,
        variables,
      }));
      if (event.eventType !== 'ir.vazano.quality_control.accepted.v1') return buyerTargets;
      const operators = await tx.user.findMany({
        where: {
          status: 'ACTIVE',
          userRoles: { some: { organizationId: null, role: { key: { in: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] } } } },
        },
        select: { id: true },
      });
      return uniqueTargets([
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
        variables: { rfqCode: review.rfq.code, rating: review.rating.toLocaleString('fa-IR') },
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
        contractStatus: contractStatusLabel(request.status),
        note: jsonStringField(event.payload, 'note') ?? 'بدون توضیح تکمیلی',
      };
      const buyerTarget = {
        userId: request.requestedByUserId,
        organizationId: request.buyerOrganizationId,
        actionPath: `/dashboard/rfqs/${request.rfq.id}`,
        variables,
      };
      if (event.eventType === 'ir.vazano.contract.under_review.v1') return [buyerTarget];
      return uniqueTargets([
        buyerTarget,
        ...request.supplierOrganization.members.map(({ userId }) => ({
          userId,
          organizationId: request.supplierOrganizationId,
          actionPath: '/supplier',
          variables,
        })),
      ]);
    }
    default:
      return null;
  }
}

function uniqueTargets(targets: NotificationTarget[]): NotificationTarget[] {
  return [...new Map(targets.map((target) => [target.userId, target])).values()];
}

function supplierVerificationLabel(status: string): string {
  return ({
    VERIFIED: 'تأیید شد', NEEDS_CORRECTION: 'نیازمند اصلاح است', REJECTED: 'رد شد', SUSPENDED: 'تعلیق شد',
  } as Record<string, string>)[status] ?? status;
}

function qualityControlStatusLabel(status: string): string {
  return ({
    QUOTED: 'آماده پرداخت', ACCEPTED: 'پرداخت‌شده و آماده اجرا', IN_PROGRESS: 'در حال انجام',
    COMPLETED: 'تکمیل‌شده', CANCELLED: 'لغوشده',
  } as Record<string, string>)[status] ?? status;
}

function contractStatusLabel(status: string): string {
  return ({ UNDER_REVIEW: 'در حال بررسی', COMPLETED: 'تکمیل‌شده', CANCELLED: 'لغوشده' } as Record<string, string>)[status] ?? status;
}

function jsonStringField(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : null;
}
