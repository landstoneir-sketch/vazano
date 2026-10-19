import { expect, test } from '@playwright/test';
import { PrismaClient } from '../../apps/api/node_modules/@prisma/client';

const prisma = new PrismaClient();
const TEST_USER_ID = 'e2e-mvp-user';
const TEST_MOBILE_LOCAL = '09120000099';
const TEST_MOBILE_NORMALIZED = TEST_MOBILE_LOCAL;
const TEST_RFQ_TITLE = 'آزمون اجرایی جریان کامل وازانو';
const OPERATOR_RFQ_TITLE = 'آزمون ثبت استعلام توسط اپراتور وازانو';
const BUYER_ORGANIZATION_ID = 'demo-buyer-organization';
const SUPPLIER_ORGANIZATION_ID = 'demo-supplier-organization';
const SECONDARY_SUPPLIER_ORGANIZATION_ID = 'e2e-secondary-supplier-organization';
const SECONDARY_QUOTATION_CODE = 'VZ-E2E-SECONDARY-QUOTE';

async function cleanupTestData() {
  const rfqs = await prisma.rfq.findMany({
    where: {
      OR: [{ createdByUserId: TEST_USER_ID }, { title: { in: [TEST_RFQ_TITLE, OPERATOR_RFQ_TITLE] } }],
    },
    select: { id: true },
  });
  const rfqIds = rfqs.map(({ id }) => id);
  const quotations = rfqIds.length
    ? await prisma.quotation.findMany({ where: { rfqId: { in: rfqIds } }, select: { id: true } })
    : [];
  const quotationIds = quotations.map(({ id }) => id);
  const quotationLedgerEntries = quotationIds.length
    ? await prisma.creditLedgerEntry.findMany({ where: { referenceType: 'Quotation', referenceId: { in: quotationIds } }, select: { walletId: true } })
    : [];
  const affectedWalletIds = [...new Set(quotationLedgerEntries.map(({ walletId }) => walletId))];
  const qualityControlRequests = rfqIds.length
    ? await prisma.qualityControlRequest.findMany({ where: { rfqId: { in: rfqIds } }, select: { id: true } })
    : [];
  const qualityControlRequestIds = qualityControlRequests.map(({ id }) => id);
  const paymentIntents = qualityControlRequestIds.length
    ? await prisma.paymentIntent.findMany({ where: { referenceType: 'QualityControlRequest', referenceId: { in: qualityControlRequestIds } }, select: { id: true } })
    : [];
  const paymentIntentIds = paymentIntents.map(({ id }) => id);
  const contractRequests = rfqIds.length
    ? await prisma.contractRequest.findMany({ where: { rfqId: { in: rfqIds } }, select: { id: true } })
    : [];
  const contractRequestIds = contractRequests.map(({ id }) => id);
  const aggregateIds = [TEST_USER_ID, ...rfqIds, ...quotationIds, ...qualityControlRequestIds, ...contractRequestIds, ...paymentIntentIds];

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
  await prisma.attachment.deleteMany({ where: { uploadedByUserId: TEST_USER_ID } });
  if (rfqIds.length) {
    await prisma.contractRequest.deleteMany({ where: { rfqId: { in: rfqIds } } });
    await prisma.paymentReceipt.deleteMany({ where: { qualityControlRequestId: { in: qualityControlRequestIds } } });
    await prisma.paymentIntent.deleteMany({ where: { id: { in: paymentIntentIds } } });
    await prisma.qualityControlRequest.deleteMany({ where: { rfqId: { in: rfqIds } } });
  }
  if (quotationIds.length) {
    await prisma.creditLedgerEntry.deleteMany({ where: { referenceType: 'Quotation', referenceId: { in: quotationIds } } });
    await prisma.attachment.deleteMany({ where: { quotationId: { in: quotationIds } } });
    await prisma.quotation.deleteMany({ where: { id: { in: quotationIds } } });
  }
  for (const walletId of affectedWalletIds) {
    const wallet = await prisma.creditWallet.findUnique({ where: { id: walletId }, select: { organizationId: true } });
    if (!wallet || wallet.organizationId === SECONDARY_SUPPLIER_ORGANIZATION_ID) continue;
    const balance = await prisma.creditLedgerEntry.aggregate({ where: { walletId }, _sum: { amountCredits: true } });
    await prisma.creditWallet.update({ where: { id: walletId }, data: { cachedBalanceCredits: balance._sum.amountCredits ?? 0n } });
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
  const secondaryWallet = await prisma.creditWallet.findUnique({ where: { organizationId: SECONDARY_SUPPLIER_ORGANIZATION_ID }, select: { id: true } });
  if (secondaryWallet) {
    await prisma.creditLedgerEntry.deleteMany({ where: { walletId: secondaryWallet.id } });
    await prisma.creditWallet.delete({ where: { id: secondaryWallet.id } });
  }
  await prisma.organization.deleteMany({ where: { id: SECONDARY_SUPPLIER_ORGANIZATION_ID } });
  const supplierProfile = await prisma.supplierProfile.findUnique({ where: { organizationId: SUPPLIER_ORGANIZATION_ID }, select: { id: true } });
  if (supplierProfile) {
    await prisma.supplierServiceProvince.deleteMany({ where: { supplierProfileId: supplierProfile.id } });
    await prisma.supplierProfile.update({
      where: { id: supplierProfile.id },
      data: {
        productionCapacityDescription: 'امکان تأمین سفارش‌های پروژه‌ای در چند نوع سنگ طبیعی و چند مرحله فرآوری',
        minimumOrderDescription: 'حداقل سفارش براساس نوع سنگ، ابعاد و فرآوری در پیشنهاد قیمت اعلام می‌شود.',
        leadTimeDescription: 'زمان آماده‌سازی معمول بین ۷ تا ۲۰ روز کاری و وابسته به مشخصات سفارش است.',
        officialInvoiceAvailable: true,
        sampleAvailable: true,
        installationAvailable: false,
        nationwideCoverage: true,
        serviceProvinces: [],
        verificationStatus: 'VERIFIED',
        verificationReason: null,
        verifiedAt: new Date(),
      },
    });
    await prisma.organization.update({ where: { id: SUPPLIER_ORGANIZATION_ID }, data: { status: 'ACTIVE' } });
  }
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
  test.setTimeout(240_000);
  await page.goto('/login');
  await page.getByLabel('شماره موبایل').fill(TEST_MOBILE_LOCAL);
  await page.getByLabel('پذیرش قوانین و حریم خصوصی').check();
  await page.getByRole('button', { name: 'ارسال کد تأیید' }).click();
  await expect(page.getByLabel('کد تأیید')).toBeVisible();
  await page.getByLabel('کد تأیید').fill('11111');
  await page.getByRole('button', { name: 'ورود' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/supplier/profile/${SUPPLIER_ORGANIZATION_ID}`);
  await expect(page.getByRole('heading', { name: 'توانمندی و محدوده تأمین' })).toBeVisible();
  await expect(page.getByText('تأیید شده', { exact: true })).toBeVisible();
  await page.getByLabel('ظرفیت تولید و تأمین').fill('ظرفیت تأمین ماهانه تا ۵۰۰۰ متر مربع با امکان فرآوری سفارشی');
  await page.getByLabel('حداقل سفارش').fill('حداقل ۱۰۰ متر مربع');
  await page.getByLabel('زمان معمول آماده‌سازی').fill('۱۰ تا ۱۵ روز کاری');
  await page.getByLabel('امکان صدور فاکتور رسمی').check();
  await page.getByLabel('امکان ارائه نمونه محصول').check();
  await page.getByLabel('امکان تأمین در کل ایران').uncheck();
  await expect(page.getByLabel('امکان تأمین در کل ایران')).not.toBeChecked();
  await page.getByLabel('تهران', { exact: true }).check();
  await page.getByRole('button', { name: 'ارسال برای بررسی' }).click();
  await expect(page.getByText('پروفایل برای بررسی وازانو ارسال شد.')).toBeVisible();

  const submittedSupplierProfile = await prisma.supplierProfile.findUniqueOrThrow({ where: { organizationId: SUPPLIER_ORGANIZATION_ID } });
  await prisma.attachment.create({ data: {
    organizationId: SUPPLIER_ORGANIZATION_ID,
    uploadedByUserId: TEST_USER_ID,
    supplierProfileId: submittedSupplierProfile.id,
    purpose: 'CERTIFICATE',
    status: 'READY',
    bucket: 'vazano-dev',
    storageKey: `e2e/supplier-verification/${Date.now()}.pdf`,
    originalName: 'مجوز-آزمایشی.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 128,
    uploadedAt: new Date(),
    scannedAt: new Date(),
    scanProvider: 'e2e-fixture',
  } });

  await page.goto('/admin/suppliers');
  const supplierReviewCard = page.locator('article').filter({ hasText: 'سنگ نمونه وازانو' });
  await expect(supplierReviewCard).toContainText('پوشش: تهران');
  await expect(supplierReviewCard).toContainText('ظرفیت تأمین ماهانه تا ۵۰۰۰ متر مربع');
  await expect(supplierReviewCard).toContainText('حداقل ۱۰۰ متر مربع');
  await expect(supplierReviewCard).toContainText('فاکتور رسمی، نمونه محصول');
  await expect(supplierReviewCard).toContainText('مجوز-آزمایشی.pdf');
  await supplierReviewCard.getByRole('button', { name: 'تأیید و فعال‌سازی' }).click();
  await expect(page.getByText('فروشنده تأیید و فعال شد.')).toBeVisible();

  await page.goto(`/suppliers/${SUPPLIER_ORGANIZATION_ID}`);
  await expect(page.getByText('ظرفیت تأمین ماهانه تا ۵۰۰۰ متر مربع')).toBeVisible();
  await expect(page.getByText('حداقل سفارش: حداقل ۱۰۰ متر مربع')).toBeVisible();
  await expect(page.getByText('صدور فاکتور رسمی')).toBeVisible();

  await page.goto('/admin/catalog');
  await expect(page.getByRole('heading', { name: 'دسته‌بندی‌ها و ویژگی‌های محصول' })).toBeVisible();
  await page.getByRole('button', { name: /تراورتن/ }).click();
  await page.getByRole('button', { name: 'ذخیره تغییرات' }).click();
  await expect(page.getByText('دسته‌بندی به‌روزرسانی شد.')).toBeVisible();
  await page.getByRole('button', { name: 'تعریف ویژگی‌های محصول' }).click();
  await expect(page.getByText('نوع فرآوری', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'واحدهای اندازه‌گیری' }).click();
  await page.getByRole('button', { name: /متر مربع/ }).click();
  await page.getByRole('button', { name: 'ذخیره تغییرات واحد' }).click();
  await expect(page.getByText('واحد اندازه‌گیری به‌روزرسانی شد.')).toBeVisible();

  await page.goto('/admin/locations');
  await expect(page.getByRole('heading', { name: 'استان‌ها و شهرها' })).toBeVisible();
  await expect(page.getByText('۳۱ استان ثبت شده است.')).toBeVisible();

  await page.goto('/admin/billing');
  await expect(page.getByRole('heading', { name: 'اشتراک‌ها، پلن‌ها و پرداخت‌ها' })).toBeVisible();
  await page.getByRole('button', { name: /اشتراک فروشنده یک‌ماهه/ }).click();
  await page.getByRole('button', { name: 'ذخیره تغییرات پلن' }).click();
  await expect(page.getByText(/پلن اشتراک به‌روزرسانی شد/)).toBeVisible();

  await page.goto('/supplier/subscription');
  await expect(page.getByRole('heading', { name: 'اشتراک و پرداخت' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'انتخاب پلن' })).toBeVisible();
  const paidPlanAction = page.getByRole('button', {
    name: /خرید آنلاین هنوز فعال نیست|خرید این پلن|تمدید با این پلن/,
  }).first();
  await expect(paidPlanAction).toBeVisible();
  if (await paidPlanAction.isDisabled()) {
    await expect(page.getByRole('link', { name: 'ثبت درخواست تمدید دستی' })).toBeVisible();
  }

  await page.goto('/admin/rfqs/new');
  await expect(page.getByRole('heading', { name: 'ثبت استعلام از طرف خریدار' })).toBeVisible();
  await expect(page.getByLabel('حساب خریدار')).toContainText('خریدار آزمایشی');
  await page.getByLabel('حساب خریدار').selectOption(BUYER_ORGANIZATION_ID);
  await page.getByLabel('فرد تماس خریدار').selectOption(TEST_USER_ID);
  await expect(page.getByLabel('فرد تماس خریدار')).toHaveValue(TEST_USER_ID);
  await page.getByLabel('عنوان استعلام').fill(OPERATOR_RFQ_TITLE);
  await page.getByLabel('نوع سنگ').selectOption({ index: 1 });
  await expect(page.getByLabel('نوع فرآوری')).toBeVisible();
  await page.getByLabel('نوع فرآوری').selectOption({ index: 1 });
  await page.getByLabel('ضخامت (میلی‌متر)').fill('20');
  await page.getByLabel('نمای خارجی', { exact: true }).check();
  await page.getByLabel('شرح محصول').fill('سنگ تراورتن کرم برای ثبت اپراتوری');
  await page.getByLabel('مقدار').fill('40');
  await page.getByLabel('استان تحویل').selectOption({ label: 'تهران' });
  await page.getByRole('button', { name: 'ثبت پیش‌نویس از طرف خریدار' }).click();
  await expect(page.getByText('پیش‌نویس ذخیره شده است.')).toBeVisible();
  const operatorRfq = await prisma.rfq.findFirstOrThrow({ where: { title: OPERATOR_RFQ_TITLE } });
  expect(operatorRfq).toMatchObject({
    buyerOrganizationId: BUYER_ORGANIZATION_ID,
    buyerContactUserId: TEST_USER_ID,
    createdByUserId: TEST_USER_ID,
    operatorUserId: TEST_USER_ID,
    source: 'PLATFORM_OPERATOR',
  });
  expect(await prisma.auditLog.count({
    where: { actorUserId: TEST_USER_ID, action: 'rfq.create_on_behalf', entityType: 'Rfq', entityId: operatorRfq.id },
  })).toBe(1);

  await page.goto('/dashboard/rfqs/new');
  await expect(page.getByLabel('حساب خریدار')).toContainText('خریدار آزمایشی');
  await page.getByLabel('عنوان استعلام').fill(TEST_RFQ_TITLE);
  await page.getByLabel('نوع سنگ').selectOption({ index: 1 });
  await expect(page.getByLabel('نوع فرآوری')).toBeVisible();
  await page.getByLabel('نوع فرآوری').selectOption({ index: 1 });
  await page.getByLabel('ضخامت (میلی‌متر)').fill('20');
  await page.getByLabel('نمای خارجی', { exact: true }).check();
  await page.getByLabel('شرح محصول').fill('سنگ تراورتن کرم، ضخامت ۲ سانتی‌متر');
  await page.getByLabel('مقدار').fill('120');
  await page.getByLabel('استان تحویل').selectOption({ label: 'تهران' });
  await expect(page.getByLabel('شهر تحویل')).toBeEnabled();
  await page.getByLabel('شهر تحویل').selectOption({ index: 1 });
  await page.getByLabel(/کنترل کیفیت توسط وازانو/).check();
  await page.getByRole('button', { name: 'ذخیره پیش‌نویس استعلام' }).click();
  await expect(page.getByText('پیش‌نویس ذخیره شده است.')).toBeVisible();
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

  let primaryQuotation = await prisma.quotation.findFirstOrThrow({
    where: { rfqId: rfqId!, supplierOrganizationId: SUPPLIER_ORGANIZATION_ID, status: 'SUBMITTED' },
  });
  await page.goto('/supplier');
  const submittedQuotationCard = page.locator('.supplier-performance-card .list-card').filter({ hasText: primaryQuotation.code });
  await submittedQuotationCard.getByRole('link', { name: 'ثبت نسخه جدید' }).click();
  await expect(page.getByText(/اطلاعات نسخه ۱ برای ساخت نسخه جدید کپی شد/)).toBeVisible();
  await expect(page.getByLabel('قیمت هر واحد (تومان)')).toHaveValue('1000000');
  await expect(page.getByLabel('حمل (تومان)')).toHaveValue('5000000');
  await page.getByRole('button', { name: 'ذخیره پیش‌نویس' }).click();
  await expect(page.getByText(/پیش‌نویس پیشنهاد ذخیره شد/)).toBeVisible();
  await page.getByRole('button', { name: 'ارسال نهایی پیشنهاد' }).click();
  await expect(page.getByText(/پیشنهاد قیمت با موفقیت ارسال شد/)).toBeVisible();
  expect((await prisma.quotation.findUniqueOrThrow({ where: { id: primaryQuotation.id } })).status).toBe('REVISED');
  primaryQuotation = await prisma.quotation.findFirstOrThrow({
    where: { rfqId: rfqId!, supplierOrganizationId: SUPPLIER_ORGANIZATION_ID, status: 'SUBMITTED' },
  });
  expect(primaryQuotation.version).toBe(2);
  const secondarySupplier = await prisma.organization.create({
    data: {
      id: SECONDARY_SUPPLIER_ORGANIZATION_ID,
      kind: 'SUPPLIER',
      type: 'COMPANY',
      legalName: 'فروشنده دوم تست اجرایی',
      displayName: 'فروشنده دوم تست اجرایی',
      province: 'اصفهان',
      city: 'اصفهان',
      status: 'ACTIVE',
    },
  });
  const secondaryWallet = await prisma.creditWallet.create({
    data: { organizationId: secondarySupplier.id, cachedBalanceCredits: 1_000_000n },
  });
  await prisma.creditLedgerEntry.create({
    data: {
      walletId: secondaryWallet.id,
      type: 'GRANT',
      amountCredits: 1_000_000n,
      referenceType: 'E2eFixture',
      referenceId: secondarySupplier.id,
      idempotencyKey: 'e2e-secondary-supplier:initial-credit:v1',
      reasonCode: 'E2E_FIXTURE',
    },
  });
  const secondaryQuotation = await prisma.quotation.create({
    data: {
      code: SECONDARY_QUOTATION_CODE,
      rfqId: rfqId!,
      supplierOrganizationId: secondarySupplier.id,
      createdByUserId: TEST_USER_ID,
      status: 'SUBMITTED',
      subtotalRial: 1_300_000_000n,
      finalAmountRial: 1_300_000_000n,
      submittedAt: new Date(),
    },
  });
  await prisma.creditLedgerEntry.create({
    data: {
      walletId: secondaryWallet.id,
      type: 'CONSUME',
      amountCredits: -300_000n,
      referenceType: 'Quotation',
      referenceId: secondaryQuotation.id,
      idempotencyKey: `quotation:${secondaryQuotation.id}:submit:v1`,
      reasonCode: 'QUOTATION_SUBMISSION_FEE',
      metadata: { policyVersion: '1.2', finalAmountRial: '1300000000', rate: '0.001', refundFractionIfEligible: '2/3' },
    },
  });
  await prisma.creditWallet.update({ where: { id: secondaryWallet.id }, data: { cachedBalanceCredits: 700_000n } });

  await page.goto(`/dashboard/rfqs/${rfqId}`);
  await expect(page.getByText(TEST_RFQ_TITLE)).toBeVisible();
  await expect(page.getByText('سنگ نمونه وازانو')).toBeVisible();
  await expect(page.getByText('فروشنده دوم تست اجرایی')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('article').filter({ hasText: 'سنگ نمونه وازانو' }).getByRole('button', { name: 'انتخاب فروشنده' }).click();
  await expect(page.getByText('فروشنده منتخب ثبت شد.')).toBeVisible();
  await expect(page.locator('article').filter({ hasText: 'سنگ نمونه وازانو' }).locator('.status-badge', { hasText: 'فروشنده منتخب' })).toBeVisible();
  const rejectedQuotation = await prisma.quotation.findUniqueOrThrow({ where: { id: secondaryQuotation.id } });
  expect(rejectedQuotation.status).toBe('REJECTED');
  const secondaryWalletAfterSelection = await prisma.creditWallet.findUniqueOrThrow({ where: { id: secondaryWallet.id } });
  expect(secondaryWalletAfterSelection.cachedBalanceCredits).toBe(900_000n);
  expect(await prisma.creditLedgerEntry.count({ where: { idempotencyKey: `quotation:${secondaryQuotation.id}:not-selected-refund:v1` } })).toBe(1);

  const repeatedSelection = await page.request.post(`http://localhost:3101/v1/quotations/${primaryQuotation.id}/accept`, {
    headers: { Origin: 'http://localhost:3100' },
  });
  expect(repeatedSelection.ok()).toBeTruthy();
  expect((await prisma.creditWallet.findUniqueOrThrow({ where: { id: secondaryWallet.id } })).cachedBalanceCredits).toBe(900_000n);
  expect(await prisma.creditLedgerEntry.count({ where: { idempotencyKey: `quotation:${secondaryQuotation.id}:not-selected-refund:v1` } })).toBe(1);
  await expect(page.getByRole('button', { name: 'پرداخت کارمزد و فعال‌سازی خدمت' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'پرداخت کارمزد و فعال‌سازی خدمت' }).click();
  await expect(page).toHaveURL(/qualityPayment=success/);
  await expect(page.getByText('پرداخت کنترل کیفیت تأیید شد و درخواست وارد صف عملیات وازانو شده است.')).toBeVisible();
  const qualityControl = await prisma.qualityControlRequest.findUnique({ where: { rfqId: rfqId! }, include: { paymentReceipt: true } });
  expect(qualityControl?.status).toBe('ACCEPTED');
  expect(qualityControl?.feeAmountRial).toBe(37_500_000n);
  expect(qualityControl?.paymentReceipt?.providerReference).toMatch(/^MOCKREF-/);

  await page.goto('/admin/quality-control');
  const qualityControlCard = page.locator('article').filter({ hasText: TEST_RFQ_TITLE });
  await expect(qualityControlCard).toContainText('آماده شروع');
  await qualityControlCard.getByRole('button', { name: 'شروع کنترل کیفیت' }).click();
  await expect(page.getByText('عملیات کنترل کیفیت آغاز شد.')).toBeVisible();
  await qualityControlCard.getByRole('button', { name: 'ثبت تکمیل خدمت' }).click();
  await expect(page.getByText('عملیات کنترل کیفیت تکمیل شد.')).toBeVisible();
  const completedQualityControl = await prisma.qualityControlRequest.findUnique({ where: { rfqId: rfqId! } });
  expect(completedQualityControl?.status).toBe('COMPLETED');
  expect(completedQualityControl?.completedAt).not.toBeNull();

  await page.goto(`/dashboard/rfqs/${rfqId}`);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'درخواست قرارداد' }).click();
  await expect(page.getByText('درخواست هماهنگی قرارداد ثبت شد.')).toBeVisible();
  expect((await prisma.contractRequest.findUnique({ where: { rfqId: rfqId! } }))?.status).toBe('REQUESTED');

  await page.goto('/admin/contracts');
  const contractCard = page.locator('article').filter({ hasText: TEST_RFQ_TITLE });
  await contractCard.getByRole('button', { name: 'شروع بررسی' }).click();
  await expect(page.getByText('بررسی درخواست آغاز شد.')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept('شرایط نمونه قرارداد برای تأیید اجرایی خریدار'));
  await contractCard.getByRole('button', { name: 'ثبت و ارسال شرایط' }).click();
  await expect(page.getByText('شرایط برای تأیید خریدار ارسال شد.')).toBeVisible();

  await page.goto(`/dashboard/rfqs/${rfqId}`);
  await expect(page.getByText('شرایط نمونه قرارداد برای تأیید اجرایی خریدار')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'تأیید شرایط قرارداد' }).click();
  await expect(page.getByText('تأیید شرایط قرارداد ثبت شد.')).toBeVisible();

  await page.goto('/admin/contracts');
  const acceptedContractCard = page.locator('article').filter({ hasText: TEST_RFQ_TITLE });
  await acceptedContractCard.getByRole('button', { name: 'ثبت تکمیل هماهنگی' }).click();
  await expect(page.getByText('فرایند هماهنگی قرارداد تکمیل شد.')).toBeVisible();
  const completedContract = await prisma.contractRequest.findUnique({ where: { rfqId: rfqId! } });
  expect(completedContract?.status).toBe('COMPLETED');
  expect(completedContract?.completedAt).not.toBeNull();
});
