import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ReviewsService } from './reviews.service';

const buyer: AuthenticatedUser = {
  id: 'buyer-1', mobile: '09120000000', status: 'ACTIVE', permissions: [], globalRoles: [],
  memberships: [{ organizationId: 'buyer-organization-1', role: 'BUYER_OWNER' }],
};

describe('ReviewsService', () => {
  it('publishes one review only for the buyer that selected the quotation', async () => {
    const rfq = {
      id: 'rfq-1', buyerOrganizationId: 'buyer-organization-1', operationalStatus: 'SELLER_SELECTED',
      quotations: [{ id: 'quotation-1', supplierOrganizationId: 'supplier-organization-1' }],
    };
    const review = { id: 'review-1', rfqId: rfq.id, rating: 5, status: 'PUBLISHED' };
    const tx = {
      supplierReview: { create: jest.fn().mockResolvedValue(review) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      rfq: { findUnique: jest.fn().mockResolvedValue(rfq) },
      supplierReview: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ReviewsService(prisma as never);

    await expect(service.create(buyer, rfq.id, { rating: 5, comment: 'کیفیت محصول و پاسخ‌گویی فروشنده مناسب بود.' })).resolves.toEqual(review);
    expect(tx.supplierReview.create).toHaveBeenCalledWith({ data: {
      rfqId: rfq.id,
      quotationId: 'quotation-1',
      buyerOrganizationId: 'buyer-organization-1',
      supplierOrganizationId: 'supplier-organization-1',
      createdByUserId: buyer.id,
      rating: 5,
      comment: 'کیفیت محصول و پاسخ‌گویی فروشنده مناسب بود.',
    } });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a user outside the buyer organization', async () => {
    const prisma = { rfq: { findUnique: jest.fn().mockResolvedValue({
      id: 'rfq-1', buyerOrganizationId: 'another-buyer', operationalStatus: 'SELLER_SELECTED',
      quotations: [{ id: 'quotation-1', supplierOrganizationId: 'supplier-1' }],
    }) } };
    const service = new ReviewsService(prisma as never);
    await expect(service.create(buyer, 'rfq-1', { rating: 4 })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects review before a seller has been selected', async () => {
    const prisma = {
      rfq: { findUnique: jest.fn().mockResolvedValue({ id: 'rfq-1', buyerOrganizationId: 'buyer-organization-1', operationalStatus: 'RECEIVING_QUOTES', quotations: [] }) },
    };
    const service = new ReviewsService(prisma as never);
    await expect(service.create(buyer, 'rfq-1', { rating: 4 })).rejects.toBeInstanceOf(ConflictException);
  });
});
