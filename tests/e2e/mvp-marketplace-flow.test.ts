import { expect, test } from '@playwright/test';
import { PrismaClient } from '../../apps/api/node_modules/@prisma/client';

const prisma = new PrismaClient();
const TEST_USER_ID = 'e2e-mvp-user';
const TEST_MOBILE_LOCAL = '09120000099';
const TEST_MOBILE_NORMALIZED = TEST_MOBILE_LOCAL;
const TEST_RFQ_TITLE = 'آزمون اجرایی جریان کامل وازانو';
const BUYER_ORGANIZATION_ID = 'demo-buyer-organization';
const SUPPLIER_ORGANIZATION_ID = 'demo-supplier-organization';

async function cleanupTestData() {
  const rfqs = await prisma.rfq.findMany({
    where: {
      OR: [{ createdByUserId: TEST_USER_ID }, { title: TEST_RFQ_TITLE }],
    },
    select: { id: true },
  });
  const rfqIds = rfqs.map(({ id }) => id);
  const quotations = rfqIds.length
    ? await prisma.quotation.findMany({ where: { rfqId: { in: rfqIds } }, select: { id: true } })
    : [];
  const quotationIds = quotations.map(({ id }) => id);
  const aggregateIds = [TEST_USER_ID, ...rfqIds, ...quotationIds];

  if (aggregateIds.length) {
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: aggregateIds } } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ actorUserId: TEST_USER_ID }, { entityId: { in: aggregateIds } }],
      },
    });
  }
  await prisma.notification.deleteMany({ where: { recipientUserId: TEST_USER_ID } });
  await prisma.securityEvent.deleteMany({
    where: { OR: [{ userId: TEST_USER_ID }, { resolvedByUserId: TEST_USER_ID }] },
  });
  if (quotationIds.length) {
    await prisma.attachment.deleteMany({ where: { quotationId: { in: quotationIds } } });
    await prisma.quotation.deleteMany({ where: { id: { in: quotationIds } } });
  }
  if (rfqIds.length) {
    await prisma.supportTicket.deleteMany({ where: { relatedRfqId: { in: rfqIds } } });
    await prisma.messageThread.deleteMany({ where: { rfqId: { in: rfqIds } } });
    await prisma.attachment.deleteMany({ where: { rfqId: { in: rfqIds } } });
    await prisma.rfq.deleteMany({ where: { id: { in: rfqIds } } });
  }
  await prisma.otpCode.deleteMany({ where: { mobile: TEST_MOBILE_NORMALIZED } });
  await prisma.user.deleteMany({
    where: { OR: [{ id: TEST_USER_ID }, { mobile: TEST_MOBILE_NORMALIZED }] },
  });
}

async function prepareTestUser() {
  await cleanupTestData();

  const [adminRole, buyerOrganization, supplierOrganization] = await Promise.all([
    prisma.role.findUnique({ where: { key: 'SUPER_ADMIN' } }),
    prisma.organization.findUnique({ where: { id: BUYER_ORGANIZATION_ID } }),
    prisma.organization.findUnique({ where: { id: SUPPLIER_ORGANIZATION_ID } }),
  ]);

  if (!adminRole || !buyerOrganization || !supplierOrganization) {
    throw new Error('داده پایه محیط توسعه موجود نیست. ابتدا npm run prisma:seed را اجرا کنید.');
  }

  const user = await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      mobile: TEST_MOBILE_NORMALIZED,
      firstName: 'کاربر',
      lastName: 'تست اجرایی',
      mobileVerifiedAt: new Date(),
    },
  });

  await prisma.$transaction([
    prisma.userRole.create({
      data: { userId: user.id, roleId: adminRole.id },
    }),
    prisma.organizationMember.create({
      data: {
        organizationId: BUYER_ORGANIZATION_ID,
        userId: user.id,
        role: 'BUYER_OWNER',
      },
    }),
    prisma.organizationMember.create({
      data: {
        organizationId: SUPPLIER_ORGANIZATION_ID,
        userId: user.id,
        role: 'SUPPLIER_OWNER',
      },
    }),
  ]);
}

test.beforeEach(async () => prepareTestUser());
test.afterEach(async () => cleanupTestData());
test.afterAll(async () => prisma.$disconnect());

test('جریان ورود، استعلام، انتشار، پیشنهاد و انتخاب فروشنده تکمیل می‌شود', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('شماره موبایل').fill(TEST_MOBILE_LOCAL);
  await page.getByRole('button', { name: 'ارسال کد تأیید' }).click();
  await expect(page.getByLabel('کد تأیید')).toBeVisible();
  await page.getByLabel('کد تأیید').fill('11111');
  await page.getByRole('button', { name: 'ورود' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/dashboard/rfqs/new');
  await expect(page.getByLabel('حساب خریدار')).toContainText('خریدار آزمایشی');
  await page.getByLabel('عنوان استعلام').fill(TEST_RFQ_TITLE);
  await page.getByLabel('نوع سنگ').selectOption({ index: 1 });
  await expect(page.getByLabel('نوع فرآوری')).toBeVisible();
  await page.getByLabel('نوع فرآوری').selectOption({ index: 1 });
  await page.getByLabel('ضخامت (میلی‌متر)').fill('20');
  await page.getByLabel('شرح محصول').fill('سنگ تراورتن کرم، ضخامت ۲ سانتی‌متر');
  await page.getByLabel('مقدار').fill('120');
  await page.getByLabel('استان تحویل').fill('تهران');
  await page.getByLabel('شهر تحویل').fill('تهران');
  await page.getByRole('button', { name: 'ذخیره پیش‌نویس استعلام' }).click();
  await expect(page.getByText('پیش‌نویس ثبت شد.')).toBeVisible();
  await page.getByRole('button', { name: 'ارسال برای بررسی وازانو' }).click();
  await expect(page.getByText('استعلام در صف بررسی است.')).toBeVisible();

  await page.goto('/admin/rfqs');
  const reviewCard = page.locator('article').filter({ hasText: TEST_RFQ_TITLE });
  await expect(reviewCard).toBeVisible();
  await reviewCard.getByRole('button', { name: 'تأیید', exact: true }).click();
  await expect(reviewCard.getByRole('button', { name: 'انتشار و توزیع' })).toBeVisible();
  await reviewCard.getByRole('button', { name: 'انتشار و توزیع' }).click();
  await expect(page.getByText(/استعلام منتشر شد و برای .* فروشنده واجد شرایط ارسال شد/)).toBeVisible();

  await page.goto('/supplier');
  const opportunityCard = page.locator('article').filter({ hasText: TEST_RFQ_TITLE });
  await expect(opportunityCard).toBeVisible();
  await opportunityCard.getByRole('link', { name: 'ثبت پیشنهاد قیمت' }).click();
  await expect(page).toHaveURL(/\/supplier\/rfqs\/[^/]+\/quote/);
  const rfqId = page.url().match(/\/supplier\/rfqs\/([^/]+)\/quote/)?.[1];
  expect(rfqId).toBeTruthy();

  await page.getByLabel('قیمت هر واحد (تومان)').fill('1000000');
  await page.getByLabel('حمل (تومان)').fill('5000000');
  await page.getByRole('button', { name: 'ذخیره پیش‌نویس' }).click();
  await expect(page.getByText(/پیش‌نویس پیشنهاد ذخیره شد/)).toBeVisible();
  await page.getByRole('button', { name: 'ارسال نهایی پیشنهاد' }).click();
  await expect(page.getByText(/پیشنهاد قیمت با موفقیت ارسال شد/)).toBeVisible();

  await page.goto(`/dashboard/rfqs/${rfqId}`);
  await expect(page.getByText(TEST_RFQ_TITLE)).toBeVisible();
  await expect(page.getByText('سنگ نمونه وازانو')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'انتخاب فروشنده' }).click();
  await expect(page.getByText('فروشنده منتخب ثبت شد.')).toBeVisible();
  await expect(page.getByText('فروشنده منتخب', { exact: true })).toBeVisible();
});
