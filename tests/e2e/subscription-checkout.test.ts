import { expect, test } from '@playwright/test';
import { PrismaClient } from '../../apps/api/node_modules/@prisma/client';

const prisma = new PrismaClient();
const TEST_USER_ID = 'e2e-subscription-user';
const TEST_MOBILE = '09120000098';
const SUPPLIER_ORGANIZATION_ID = 'demo-supplier-organization';
const DISCOUNT_CODE = 'E2E10';
let initialWalletBalance: bigint | null = null;

async function cleanupSubscriptionCheckout(): Promise<void> {
  const subscriptions = await prisma.subscription.findMany({
    where: { organizationId: SUPPLIER_ORGANIZATION_ID, discountCodeSnapshot: DISCOUNT_CODE },
    select: { id: true },
  });
  const subscriptionIds = subscriptions.map(({ id }) => id);
  const payments = subscriptionIds.length
    ? await prisma.paymentIntent.findMany({ where: { referenceType: 'Subscription', referenceId: { in: subscriptionIds } }, select: { id: true } })
    : [];
  const paymentIds = payments.map(({ id }) => id);

  if (subscriptionIds.length || paymentIds.length) {
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: [...subscriptionIds, ...paymentIds] } } });
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorUserId: TEST_USER_ID }, { entityId: { in: [...subscriptionIds, ...paymentIds] } }] } });
    await prisma.paymentReceipt.deleteMany({ where: { subscriptionId: { in: subscriptionIds } } });
    await prisma.billingInvoice.deleteMany({ where: { subscriptionId: { in: subscriptionIds } } });
    await prisma.subscriptionDiscountRedemption.deleteMany({ where: { subscriptionId: { in: subscriptionIds } } });
    await prisma.paymentIntent.deleteMany({ where: { id: { in: paymentIds } } });
    await prisma.subscriptionReminder.deleteMany({ where: { subscriptionId: { in: subscriptionIds } } });
    await prisma.creditLedgerEntry.deleteMany({ where: { referenceType: 'Subscription', referenceId: { in: subscriptionIds } } });
    await prisma.subscription.deleteMany({ where: { id: { in: subscriptionIds } } });
  }
  await prisma.notification.deleteMany({ where: { recipientUserId: TEST_USER_ID } });
  await prisma.otpCode.deleteMany({ where: { mobile: TEST_MOBILE } });
  await prisma.user.deleteMany({ where: { OR: [{ id: TEST_USER_ID }, { mobile: TEST_MOBILE }] } });
  await prisma.subscriptionDiscountCode.deleteMany({ where: { code: DISCOUNT_CODE } });
  if (initialWalletBalance !== null) {
    await prisma.creditWallet.updateMany({
      where: { organizationId: SUPPLIER_ORGANIZATION_ID },
      data: { cachedBalanceCredits: initialWalletBalance },
    });
  }
}

async function prepareSubscriptionCheckout(): Promise<void> {
  initialWalletBalance = (await prisma.creditWallet.findUnique({
    where: { organizationId: SUPPLIER_ORGANIZATION_ID },
    select: { cachedBalanceCredits: true },
  }))?.cachedBalanceCredits ?? null;
  await cleanupSubscriptionCheckout();
  const organization = await prisma.organization.findUnique({ where: { id: SUPPLIER_ORGANIZATION_ID } });
  if (!organization) throw new Error('سازمان فروشنده Seed نشده است.');
  await prisma.organization.update({ where: { id: organization.id }, data: { status: 'ACTIVE' } });
  await prisma.user.create({ data: {
    id: TEST_USER_ID,
    mobile: TEST_MOBILE,
    firstName: 'مالک',
    lastName: 'آزمایش اشتراک',
    mobileVerifiedAt: new Date(),
    memberships: { create: { organizationId: organization.id, role: 'SUPPLIER_OWNER' } },
  } });
  await prisma.subscriptionDiscountCode.create({ data: {
    code: DISCOUNT_CODE,
    nameFa: 'تخفیف تست اجرایی',
    type: 'PERCENTAGE',
    percentageBps: 1000,
    minimumPurchaseRial: 0n,
    perOrganizationLimit: 1,
    maxRedemptions: 1,
    validFrom: new Date(Date.now() - 60_000),
    validUntil: new Date(Date.now() + 60 * 60 * 1000),
  } });
}

test.beforeEach(async () => prepareSubscriptionCheckout());
test.afterEach(async () => cleanupSubscriptionCheckout());
test.afterAll(async () => prisma.$disconnect());

test('کد تخفیف در خرید اشتراک اعمال و پرداخت قطعی ثبت می‌شود', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('شماره موبایل').fill(TEST_MOBILE);
  await page.getByLabel('پذیرش قوانین و حریم خصوصی').check();
  await page.getByRole('button', { name: 'ارسال کد تأیید' }).click();
  await page.getByLabel('کد تأیید').fill('11111');
  await page.getByRole('button', { name: 'ورود' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const legalAcceptance = await prisma.legalAcceptance.findFirst({ where: { userId: TEST_USER_ID } });
  expect(legalAcceptance).toMatchObject({ termsVersion: expect.any(Number), privacyVersion: expect.any(Number) });
  expect(legalAcceptance?.termsContentHash).toMatch(/^[0-9a-f]{64}$/);
  expect(legalAcceptance?.privacyContentHash).toMatch(/^[0-9a-f]{64}$/);

  await page.goto('/supplier/subscription');
  await page.getByLabel('کد تخفیف (اختیاری)').fill(DISCOUNT_CODE);
  const planCard = page.locator('article').filter({ hasText: 'اشتراک فروشنده یک‌ماهه' });
  await planCard.getByRole('button', { name: 'محاسبه قیمت با کد' }).click();
  await expect(planCard.getByText(/تخفیف .* کد E2E10/)).toBeVisible();
  await planCard.getByRole('button', { name: /خرید این پلن|تمدید با این پلن/ }).click();

  await expect(page).toHaveURL(/\/supplier\/subscription\?payment=success/);
  await expect(page.getByText('پرداخت با موفقیت تأیید شد و اشتراک شما فعال است.')).toBeVisible();

  const subscription = await prisma.subscription.findFirstOrThrow({
    where: { organizationId: SUPPLIER_ORGANIZATION_ID, discountCodeSnapshot: DISCOUNT_CODE },
    include: { discountRedemption: true, billingInvoice: true, paymentReceipt: true },
    orderBy: { createdAt: 'desc' },
  });
  expect(subscription.listPriceRialSnapshot).toBe(50_000_000n);
  expect(subscription.discountRialSnapshot).toBe(5_000_000n);
  expect(subscription.priceRialSnapshot).toBe(45_000_000n);
  expect(subscription.status).toBe('ACTIVE');
  expect(subscription.discountRedemption?.status).toBe('REDEEMED');
  expect(subscription.billingInvoice?.status).toBe('PAID');
  expect(subscription.paymentReceipt?.amountRial).toBe(45_000_000n);
});
