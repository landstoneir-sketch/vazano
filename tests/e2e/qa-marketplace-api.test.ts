import { expect, request, test, type APIRequestContext } from '@playwright/test';
import { PrismaClient } from '../../apps/api/node_modules/@prisma/client';

const prisma = new PrismaClient();
const API_BASE_URL = 'http://localhost:3101/v1/';
const RFQ_TITLE = 'QA API - تطبیق تراورتن تهران';
const mobiles = {
  admin: '09991000001',
  buyer: '09991000002',
  supplierA: '09991000003',
  supplierB: '09991000004',
  supplierC: '09991000005',
} as const;

async function login(mobile: string): Promise<APIRequestContext> {
  const context = await request.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: { Origin: 'http://localhost:3100' },
  });
  const requested = await context.post('auth/otp/request', { data: { mobile, purpose: 'LOGIN' } });
  expect(requested.status()).toBe(200);
  const payload = await requested.json() as { data: { debugCode?: string } };
  expect(payload.data.debugCode).toBe('11111');
  const verified = await context.post('auth/otp/verify', {
    data: { mobile, purpose: 'LOGIN', code: payload.data.debugCode, legalAccepted: true },
  });
  expect(verified.status()).toBe(200);
  return context;
}

async function cleanupDynamicRfq(): Promise<void> {
  const rfqs = await prisma.rfq.findMany({ where: { title: RFQ_TITLE }, select: { id: true } });
  const rfqIds = rfqs.map(({ id }) => id);
  if (rfqIds.length) {
    const quotations = await prisma.quotation.findMany({ where: { rfqId: { in: rfqIds } }, select: { id: true } });
    const quotationIds = quotations.map(({ id }) => id);
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: [...rfqIds, ...quotationIds] } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [...rfqIds, ...quotationIds] } } });
    await prisma.quotation.deleteMany({ where: { id: { in: quotationIds } } });
    await prisma.rfq.deleteMany({ where: { id: { in: rfqIds } } });
  }
  const qaUsers = await prisma.user.findMany({ where: { mobile: { in: Object.values(mobiles) } }, select: { id: true } });
  await prisma.session.deleteMany({ where: { userId: { in: qaUsers.map(({ id }) => id) } } });
  await prisma.otpCode.deleteMany({ where: { mobile: { in: Object.values(mobiles) } } });
}

test.beforeEach(async () => cleanupDynamicRfq());
test.afterEach(async () => cleanupDynamicRfq());
test.afterAll(async () => prisma.$disconnect());

test('validates RFQ input, distributes only to eligible suppliers, and isolates tenants', async () => {
  const [industry, category, unit, province] = await Promise.all([
    prisma.industry.findUniqueOrThrow({ where: { code: 'building-materials' } }),
    prisma.category.findUniqueOrThrow({ where: { code: 'travertine' } }),
    prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'square-meter' } }),
    prisma.province.findUniqueOrThrow({ where: { code: 'tehran' } }),
  ]);
  const buyer = await login(mobiles.buyer);
  const admin = await login(mobiles.admin);
  const supplierA = await login(mobiles.supplierA);
  const supplierB = await login(mobiles.supplierB);
  const supplierC = await login(mobiles.supplierC);

  const buyerRfqsResponse = await buyer.get('rfqs/mine');
  expect(buyerRfqsResponse.status()).toBe(200);
  const buyerRfqs = (await buyerRfqsResponse.json() as { data: Array<{ id: string }> }).data;
  expect(buyerRfqs.filter((rfq) => rfq.id.startsWith('qa-rfq-'))).toHaveLength(12);

  const reviewQueueResponse = await admin.get('rfqs/admin/review-queue');
  expect(reviewQueueResponse.status()).toBe(200);
  const reviewQueue = (await reviewQueueResponse.json() as { data: Array<{ id: string }> }).data;
  expect(reviewQueue.some((rfq) => rfq.id === 'qa-rfq-07')).toBe(true);

  const comparisonResponse = await buyer.get('quotations/rfqs/qa-rfq-06/comparison');
  expect(comparisonResponse.status()).toBe(200);
  const comparison = (await comparisonResponse.json() as { data: { quotations: Array<{ id: string }> } }).data;
  expect(comparison.quotations).toHaveLength(2);

  const supplierQuotesResponse = await supplierB.get('quotations/mine?organizationId=qa-org-supplier-sepahan');
  expect(supplierQuotesResponse.status()).toBe(200);
  const supplierQuotes = (await supplierQuotesResponse.json() as { data: Array<{ id: string }> }).data;
  expect(supplierQuotes.some((quotation) => quotation.id === 'qa-quote-06-b')).toBe(true);

  const baseInput = {
    buyerOrganizationId: 'qa-org-buyer-atlas',
    primaryDomainId: industry.id,
    title: RFQ_TITLE,
    description: 'آزمون خودکار تطبیق دسته، جغرافیا، احراز هویت و اشتراک.',
    deliveryProvinceId: province.id,
    responseDeadline: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    requiredAt: new Date(Date.now() + 25 * 86_400_000).toISOString(),
    items: [{
      categoryId: category.id,
      unitId: unit.id,
      title: 'تراورتن کرم نمای خارجی',
      quantity: '120',
      specifications: { finish: 'سابیده', 'thickness-mm': 20, application: ['نمای خارجی'] },
    }],
  };

  const invalidQuantity = await buyer.post('rfqs', {
    data: { ...baseInput, title: `${RFQ_TITLE} - مقدار نامعتبر`, items: [{ ...baseInput.items[0], quantity: '0' }] },
  });
  expect(invalidQuantity.status()).toBe(400);

  const createdResponse = await buyer.post('rfqs', { data: baseInput });
  const createdPayload = await createdResponse.json() as { data?: { id: string }; error?: { message: string } };
  expect(createdResponse.status(), createdPayload.error?.message).toBe(201);
  const created = createdPayload.data!;

  const submitted = await buyer.post(`rfqs/${created.id}/submit`);
  expect(submitted.status()).toBe(201);
  const reviewed = await admin.post(`rfqs/${created.id}/review`, { data: { decision: 'APPROVE' } });
  expect(reviewed.status()).toBe(201);
  const published = await admin.post(`rfqs/${created.id}/publish`);
  expect(published.status()).toBe(201);
  expect((await published.json() as { data: { invitedSupplierCount: number } }).data.invitedSupplierCount).toBe(1);

  const invitedSupplierView = await supplierA.get(`rfqs/${created.id}`);
  expect(invitedSupplierView.status()).toBe(200);
  expect((await supplierA.get('rfqs/matched')).status()).toBe(200);

  expect((await supplierB.get(`rfqs/${created.id}`)).status()).toBe(404);
  expect((await supplierC.get(`rfqs/${created.id}`)).status()).toBe(404);
  expect((await supplierA.get('quotations/mine?organizationId=qa-org-supplier-sepahan')).status()).toBe(403);

  const unauthorizedQuote = await supplierB.post('quotations', { data: {
    rfqId: created.id,
    supplierOrganizationId: 'qa-org-supplier-sepahan',
    items: [{ rfqItemId: `${created.id}-unknown`, quantity: '10', unitPriceRial: '40000000' }],
  } });
  expect(unauthorizedQuote.status()).toBe(403);

  await Promise.all([buyer.dispose(), admin.dispose(), supplierA.dispose(), supplierB.dispose(), supplierC.dispose()]);
});
