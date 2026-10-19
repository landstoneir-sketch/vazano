import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateSupplierReviewDto } from './create-supplier-review.dto';
import { ModerateSupplierReviewDto } from './moderate-supplier-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForRfq(user: AuthenticatedUser, rfqId: string) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      select: { buyerOrganizationId: true, quotations: { where: { status: 'ACCEPTED' }, select: { supplierOrganizationId: true }, take: 1 } },
    });
    if (!rfq) throw new NotFoundException('استعلام پیدا نشد.');
    const organizationIds = new Set(user.memberships.map((membership) => membership.organizationId));
    const canRead = organizationIds.has(rfq.buyerOrganizationId)
      || (rfq.quotations[0] ? organizationIds.has(rfq.quotations[0].supplierOrganizationId) : false)
      || user.permissions.includes('support.manage');
    if (!canRead) throw new ForbiddenException('مجوز مشاهده امتیاز این استعلام را ندارید.');
    return this.prisma.supplierReview.findUnique({ where: { rfqId } });
  }

  async create(user: AuthenticatedUser, rfqId: string, input: CreateSupplierReviewDto) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      select: {
        id: true,
        buyerOrganizationId: true,
        operationalStatus: true,
        quotations: { where: { status: 'ACCEPTED' }, select: { id: true, supplierOrganizationId: true }, take: 1 },
      },
    });
    if (!rfq) throw new NotFoundException('استعلام پیدا نشد.');
    const buyerMembership = user.memberships.find((membership) => membership.organizationId === rfq.buyerOrganizationId && ['BUYER_OWNER', 'BUYER_MEMBER'].includes(membership.role));
    if (!buyerMembership) throw new ForbiddenException('فقط اعضای سازمان خریدار می‌توانند به این فروشنده امتیاز دهند.');
    const quotation = rfq.quotations[0];
    if (rfq.operationalStatus !== 'SELLER_SELECTED' || !quotation) throw new ConflictException('امتیازدهی فقط پس از انتخاب قطعی فروشنده امکان‌پذیر است.');
    if (await this.prisma.supplierReview.findUnique({ where: { rfqId } })) throw new ConflictException('برای این خرید قبلاً امتیاز ثبت شده است.');

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.supplierReview.create({ data: {
        rfqId,
        quotationId: quotation.id,
        buyerOrganizationId: rfq.buyerOrganizationId,
        supplierOrganizationId: quotation.supplierOrganizationId,
        createdByUserId: user.id,
        rating: input.rating,
        comment: input.comment?.trim() || null,
      } });
      await tx.auditLog.create({ data: {
        actorUserId: user.id,
        organizationId: rfq.buyerOrganizationId,
        action: 'supplier_review.create',
        entityType: 'SupplierReview',
        entityId: review.id,
        metadata: { rfqId, quotationId: quotation.id, supplierOrganizationId: quotation.supplierOrganizationId, rating: input.rating },
      } });
      await tx.outboxEvent.create({ data: {
        aggregateType: 'SupplierReview',
        aggregateId: review.id,
        eventType: 'ir.vazano.supplier.review_published.v1',
        payload: { reviewId: review.id, rfqId, supplierOrganizationId: quotation.supplierOrganizationId, rating: input.rating },
      } });
      return review;
    });
  }

  listForModeration(user: AuthenticatedUser) {
    this.requireModeration(user);
    return this.prisma.supplierReview.findMany({
      include: {
        rfq: { select: { code: true, title: true } },
        buyerOrganization: { select: { displayName: true } },
        supplierOrganization: { select: { displayName: true } },
        createdBy: { select: { firstName: true, lastName: true, mobile: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async moderate(user: AuthenticatedUser, reviewId: string, input: ModerateSupplierReviewDto) {
    this.requireModeration(user);
    if (input.status === 'HIDDEN' && !input.reason?.trim()) throw new ConflictException('برای پنهان‌کردن امتیاز ثبت دلیل الزامی است.');
    const review = await this.prisma.supplierReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('امتیاز پیدا نشد.');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.supplierReview.update({
        where: { id: review.id },
        data: { status: input.status, moderationReason: input.reason?.trim() || null, moderatedByUserId: user.id, moderatedAt: new Date() },
      });
      await tx.auditLog.create({ data: {
        actorUserId: user.id,
        organizationId: review.supplierOrganizationId,
        action: `supplier_review.moderate.${input.status.toLowerCase()}`,
        entityType: 'SupplierReview',
        entityId: review.id,
        metadata: { reason: input.reason?.trim() || null },
      } });
      return updated;
    });
  }

  async summaryForSupplier(organizationId: string) {
    const [aggregate, recent] = await Promise.all([
      this.prisma.supplierReview.aggregate({ where: { supplierOrganizationId: organizationId, status: 'PUBLISHED' }, _count: { _all: true }, _avg: { rating: true } }),
      this.prisma.supplierReview.findMany({
        where: { supplierOrganizationId: organizationId, status: 'PUBLISHED' },
        select: { id: true, rating: true, comment: true, createdAt: true, rfq: { select: { code: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { count: aggregate._count._all, averageRating: aggregate._avg.rating, recent };
  }

  private requireModeration(user: AuthenticatedUser): void {
    if (!user.permissions.includes('support.manage')) throw new ForbiddenException('مجوز مدیریت امتیازها را ندارید.');
  }
}
