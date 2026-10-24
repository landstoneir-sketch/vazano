import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const QA_PREFIX = 'qa-';
const DAY = 86_400_000;

const ids = {
  users: {
    admin: 'qa-user-admin',
    buyer: 'qa-user-buyer-owner',
    supplierA: 'qa-user-supplier-a',
    supplierB: 'qa-user-supplier-b',
    supplierC: 'qa-user-supplier-c',
  },
  organizations: {
    buyer: 'qa-org-buyer-atlas',
    supplierA: 'qa-org-supplier-alborz',
    supplierB: 'qa-org-supplier-sepahan',
    supplierC: 'qa-org-supplier-edge',
  },
} as const;

type ValidationResult = {
  code: string;
  title: string;
  passed: boolean;
  details: string;
};

function assertSafeEnvironment(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is required.');
  const parsed = new URL(raw);
  const databaseName = parsed.pathname.replace(/^\//, '');
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error('QA dataset is restricted to a local PostgreSQL host.');
  }
  if (!databaseName.endsWith('_qa') && !databaseName.endsWith('_test')) {
    throw new Error('QA database name must end with _qa or _test.');
  }
  if (process.env.NODE_ENV === 'production') throw new Error('QA dataset cannot run with NODE_ENV=production.');
  if ((process.env.SMS_PROVIDER ?? 'debug') !== 'debug') {
    throw new Error('SMS_PROVIDER must be debug while generating QA data.');
  }
  if ((process.env.PAYMENT_PROVIDER ?? 'mock') !== 'mock') {
    throw new Error('PAYMENT_PROVIDER must be mock while generating QA data.');
  }
}

function dateFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY);
}

async function cleanup(): Promise<void> {
  assertSafeEnvironment();
  const qaRfqs = await prisma.rfq.findMany({
    where: { id: { startsWith: QA_PREFIX } },
    select: { id: true },
  });
  const rfqIds = qaRfqs.map(({ id }) => id);
  const quotations = rfqIds.length
    ? await prisma.quotation.findMany({ where: { rfqId: { in: rfqIds } }, select: { id: true } })
    : [];
  const quotationIds = quotations.map(({ id }) => id);
  const qaOrganizationIds = Object.values(ids.organizations);
  const qaUserIds = Object.values(ids.users);

  await prisma.$transaction(async (tx) => {
    await tx.outboxEvent.deleteMany({
      where: { OR: [{ aggregateId: { startsWith: QA_PREFIX } }, { aggregateId: { in: [...rfqIds, ...quotationIds] } }] },
    });
    await tx.auditLog.deleteMany({
      where: { OR: [{ actorUserId: { in: qaUserIds } }, { organizationId: { in: qaOrganizationIds } }, { entityId: { startsWith: QA_PREFIX } }] },
    });
    await tx.notification.deleteMany({ where: { recipientUserId: { in: qaUserIds } } });
    await tx.securityEvent.deleteMany({ where: { OR: [{ userId: { in: qaUserIds } }, { resolvedByUserId: { in: qaUserIds } }] } });
    await tx.session.deleteMany({ where: { userId: { in: qaUserIds } } });
    await tx.otpCode.deleteMany({ where: { mobile: { startsWith: '0999100' } } });
    await tx.legalAcceptance.deleteMany({ where: { userId: { in: qaUserIds } } });
    await tx.supplierReview.deleteMany({ where: { rfqId: { in: rfqIds } } });
    await tx.contractRequest.deleteMany({ where: { rfqId: { in: rfqIds } } });
    await tx.paymentReceipt.deleteMany({ where: { organizationId: { in: qaOrganizationIds } } });
    await tx.paymentIntent.deleteMany({ where: { payerOrganizationId: { in: qaOrganizationIds } } });
    await tx.qualityControlRequest.deleteMany({ where: { rfqId: { in: rfqIds } } });
    await tx.supportTicket.deleteMany({ where: { organizationId: { in: qaOrganizationIds } } });
    await tx.messageThread.deleteMany({ where: { rfqId: { in: rfqIds } } });
    await tx.attachment.deleteMany({ where: { organizationId: { in: qaOrganizationIds } } });
    await tx.creditLedgerEntry.deleteMany({ where: { idempotencyKey: { startsWith: QA_PREFIX } } });
    await tx.quotation.deleteMany({ where: { id: { in: quotationIds } } });
    await tx.rfq.deleteMany({ where: { id: { in: rfqIds } } });
    await tx.subscriptionReminder.deleteMany({ where: { subscription: { organizationId: { in: qaOrganizationIds } } } });
    await tx.billingInvoice.deleteMany({ where: { organizationId: { in: qaOrganizationIds } } });
    await tx.subscriptionDiscountRedemption.deleteMany({ where: { organizationId: { in: qaOrganizationIds } } });
    await tx.subscription.deleteMany({ where: { organizationId: { in: qaOrganizationIds } } });
    await tx.creditWallet.deleteMany({ where: { organizationId: { in: qaOrganizationIds } } });
    await tx.supplierProduct.deleteMany({ where: { supplierProfile: { organizationId: { in: qaOrganizationIds } } } });
    await tx.supplierProfile.deleteMany({ where: { organizationId: { in: qaOrganizationIds } } });
    await tx.userRole.deleteMany({ where: { userId: { in: qaUserIds } } });
    await tx.organizationMember.deleteMany({ where: { OR: [{ userId: { in: qaUserIds } }, { organizationId: { in: qaOrganizationIds } }] } });
    await tx.organization.deleteMany({ where: { id: { in: qaOrganizationIds } } });
    await tx.user.deleteMany({ where: { id: { in: qaUserIds } } });
  });
}

async function seed(): Promise<void> {
  assertSafeEnvironment();
  await cleanup();

  const [industry, unit, plan, adminRole, provinces, categories] = await Promise.all([
    prisma.industry.findUniqueOrThrow({ where: { code: 'building-materials' } }),
    prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'square-meter' } }),
    prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: 'SELLER_P1M_V1' } }),
    prisma.role.findUniqueOrThrow({ where: { key: 'SUPER_ADMIN' } }),
    prisma.province.findMany({ where: { code: { in: ['tehran', 'isfahan', 'fars', 'razavi-khorasan', 'mazandaran', 'yazd'] } } }),
    prisma.category.findMany({ where: { code: { in: ['travertine', 'marmarit', 'granite', 'crystal-china', 'onyx-marble', 'basalt'] } } }),
  ]);
  const provinceByCode = new Map(provinces.map((province) => [province.code, province]));
  const categoryByCode = new Map(categories.map((category) => [category.code, category]));
  const requiredProvince = (code: string) => {
    const province = provinceByCode.get(code);
    if (!province) throw new Error(`Missing province reference: ${code}`);
    return province;
  };
  const requiredCategory = (code: string) => {
    const category = categoryByCode.get(code);
    if (!category) throw new Error(`Missing category reference: ${code}`);
    return category;
  };

  const userRows = [
    { id: ids.users.admin, mobile: '09991000001', firstName: 'مدیر', lastName: 'آزمون' },
    { id: ids.users.buyer, mobile: '09991000002', firstName: 'مهسا', lastName: 'کریمی' },
    { id: ids.users.supplierA, mobile: '09991000003', firstName: 'علی', lastName: 'رضایی' },
    { id: ids.users.supplierB, mobile: '09991000004', firstName: 'سارا', lastName: 'مرادی' },
    { id: ids.users.supplierC, mobile: '09991000005', firstName: 'رضا', lastName: 'احمدی' },
  ];
  await prisma.user.createMany({
    data: userRows.map((user) => ({ ...user, status: 'ACTIVE', mobileVerifiedAt: new Date() })),
  });

  await prisma.organization.createMany({ data: [
    { id: ids.organizations.buyer, kind: 'BUYER', type: 'COMPANY', legalName: 'شرکت توسعه سازه اطلس (آزمایشی)', displayName: 'توسعه سازه اطلس', nationalId: 'QA140500001', province: 'تهران', city: 'تهران', status: 'ACTIVE' },
    { id: ids.organizations.supplierA, kind: 'SUPPLIER', type: 'COMPANY', legalName: 'صنایع سنگ البرز روشن (آزمایشی)', displayName: 'سنگ البرز روشن', nationalId: 'QA140500002', province: 'مرکزی', city: 'محلات', status: 'ACTIVE' },
    { id: ids.organizations.supplierB, kind: 'SUPPLIER', type: 'COMPANY', legalName: 'سنگبری سپاهان دقیق (آزمایشی)', displayName: 'سنگ سپاهان دقیق', nationalId: 'QA140500003', province: 'اصفهان', city: 'اصفهان', status: 'ACTIVE' },
    { id: ids.organizations.supplierC, kind: 'SUPPLIER', type: 'COMPANY', legalName: 'تأمین سنگ مرزی (آزمایشی)', displayName: 'تأمین سنگ مرزی', nationalId: 'QA140500004', province: 'یزد', city: 'یزد', status: 'ACTIVE' },
  ] });

  await prisma.organizationMember.createMany({ data: [
    { organizationId: ids.organizations.buyer, userId: ids.users.buyer, role: 'BUYER_OWNER', status: 'ACTIVE' },
    { organizationId: ids.organizations.supplierA, userId: ids.users.supplierA, role: 'SUPPLIER_OWNER', status: 'ACTIVE' },
    { organizationId: ids.organizations.supplierB, userId: ids.users.supplierB, role: 'SUPPLIER_MANAGER', status: 'ACTIVE' },
    { organizationId: ids.organizations.supplierC, userId: ids.users.supplierC, role: 'SUPPLIER_SALES', status: 'ACTIVE' },
  ] });
  await prisma.userRole.create({ data: { userId: ids.users.admin, roleId: adminRole.id } });

  const supplierProfiles = await Promise.all([
    prisma.supplierProfile.create({ data: {
      id: 'qa-profile-supplier-a', organizationId: ids.organizations.supplierA, verificationStatus: 'VERIFIED',
      description: 'تولیدکننده تراورتن و مرمریت پروژه‌ای با پوشش سراسری', productionCapacityDescription: 'تا ۸۰۰۰ متر مربع در ماه',
      minimumOrderDescription: 'حداقل ۸۰ متر مربع', leadTimeDescription: '۷ تا ۱۸ روز کاری', officialInvoiceAvailable: true,
      sampleAvailable: true, nationwideCoverage: true, verifiedAt: dateFromNow(-120),
    } }),
    prisma.supplierProfile.create({ data: {
      id: 'qa-profile-supplier-b', organizationId: ids.organizations.supplierB, verificationStatus: 'VERIFIED',
      description: 'تأمین گرانیت، چینی و بازالت برای پروژه‌های شهری', productionCapacityDescription: 'تا ۵۰۰۰ متر مربع در ماه',
      minimumOrderDescription: 'حداقل ۵۰ متر مربع', leadTimeDescription: '۱۰ تا ۲۵ روز کاری', officialInvoiceAvailable: true,
      sampleAvailable: true, nationwideCoverage: false, verifiedAt: dateFromNow(-90),
    } }),
    prisma.supplierProfile.create({ data: {
      id: 'qa-profile-supplier-c', organizationId: ids.organizations.supplierC, verificationStatus: 'PENDING',
      description: 'فروشنده لبه‌ای QA؛ احراز هویت و اشتراک معتبر ندارد', productionCapacityDescription: 'اظهارشده و تأییدنشده',
      minimumOrderDescription: 'نامشخص', leadTimeDescription: 'نامشخص', nationwideCoverage: true,
    } }),
  ]);

  const supplierCategoryRows = [
    ...['travertine', 'marmarit', 'onyx-marble'].map((code) => ({ supplierProfileId: supplierProfiles[0].id, categoryId: requiredCategory(code).id })),
    ...['granite', 'crystal-china', 'basalt'].map((code) => ({ supplierProfileId: supplierProfiles[1].id, categoryId: requiredCategory(code).id })),
    ...['travertine', 'granite', 'crystal-china', 'basalt'].map((code) => ({ supplierProfileId: supplierProfiles[2].id, categoryId: requiredCategory(code).id })),
  ];
  await prisma.supplierCategory.createMany({ data: supplierCategoryRows });
  await prisma.supplierServiceProvince.createMany({ data: [
    { supplierProfileId: supplierProfiles[1].id, provinceId: requiredProvince('tehran').id },
    { supplierProfileId: supplierProfiles[1].id, provinceId: requiredProvince('isfahan').id },
  ] });

  await prisma.supplierProduct.createMany({ data: [
    { id: 'qa-product-a-travertine', supplierProfileId: supplierProfiles[0].id, categoryId: requiredCategory('travertine').id, nameFa: 'تراورتن کرم محلات ممتاز', sku: 'QA-A-TR-01', specifications: { finish: 'چرمی', 'thickness-mm': 20, application: ['نمای خارجی'] }, status: 'PUBLISHED' },
    { id: 'qa-product-a-marmarit', supplierProfileId: supplierProfiles[0].id, categoryId: requiredCategory('marmarit').id, nameFa: 'مرمریت دهبید روشن', sku: 'QA-A-MR-01', specifications: { finish: 'سابیده', 'thickness-mm': 20, application: ['کف لابی'] }, status: 'PUBLISHED' },
    { id: 'qa-product-b-granite', supplierProfileId: supplierProfiles[1].id, categoryId: requiredCategory('granite').id, nameFa: 'گرانیت نطنز طوسی', sku: 'QA-B-GR-01', specifications: { finish: 'بوش‌همر', 'thickness-mm': 30, application: ['کف محوطه'] }, status: 'PUBLISHED' },
    { id: 'qa-product-b-crystal', supplierProfileId: supplierProfiles[1].id, categoryId: requiredCategory('crystal-china').id, nameFa: 'چینی نی‌ریز سفید', sku: 'QA-B-CR-01', specifications: { finish: 'سابیده', 'thickness-mm': 20, application: ['دیوار داخلی'] }, status: 'PUBLISHED' },
  ] });

  await prisma.subscription.createMany({ data: [
    { id: 'qa-subscription-a', organizationId: ids.organizations.supplierA, planId: plan.id, status: 'ACTIVE', startsAt: dateFromNow(-15), expiresAt: dateFromNow(45), graceEndsAt: dateFromNow(52), priceRialSnapshot: plan.priceRial, listPriceRialSnapshot: plan.priceRial, grantCreditSnapshot: plan.grantCredits, planVersionSnapshot: plan.version },
    { id: 'qa-subscription-b', organizationId: ids.organizations.supplierB, planId: plan.id, status: 'ACTIVE', startsAt: dateFromNow(-60), expiresAt: dateFromNow(30), graceEndsAt: dateFromNow(37), priceRialSnapshot: plan.priceRial, listPriceRialSnapshot: plan.priceRial, grantCreditSnapshot: plan.grantCredits, planVersionSnapshot: plan.version },
    { id: 'qa-subscription-c', organizationId: ids.organizations.supplierC, planId: plan.id, status: 'EXPIRED', startsAt: dateFromNow(-90), expiresAt: dateFromNow(-7), graceEndsAt: dateFromNow(-1), priceRialSnapshot: plan.priceRial, listPriceRialSnapshot: plan.priceRial, grantCreditSnapshot: plan.grantCredits, planVersionSnapshot: plan.version },
  ] });
  for (const [suffix, organizationId] of [['a', ids.organizations.supplierA], ['b', ids.organizations.supplierB]] as const) {
    const wallet = await prisma.creditWallet.create({ data: { id: `qa-wallet-${suffix}`, organizationId, cachedBalanceCredits: 50_000_000n } });
    await prisma.creditLedgerEntry.create({ data: { id: `qa-ledger-${suffix}`, walletId: wallet.id, type: 'GRANT', amountCredits: 50_000_000n, referenceType: 'QaDataset', referenceId: organizationId, idempotencyKey: `qa-wallet-${suffix}-grant`, reasonCode: 'QA_DATASET' } });
  }

  type RfqFixture = {
    id: string;
    code: string;
    title: string;
    categoryCodes: string[];
    quantities: number[];
    provinceCode?: string;
    lifecycleState: 'DRAFT' | 'SUBMITTED' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED' | 'EXPIRED';
    operationalStatus: 'DRAFT_INCOMPLETE' | 'UNDER_REVIEW' | 'OPEN_FOR_QUOTES' | 'HAS_QUOTES' | 'NEGOTIATING' | 'SELLER_SELECTED' | 'CANCELLED' | 'EXPIRED';
    approvalStatus: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED';
    deadlineDays?: number;
    description: string;
  };
  const rfqFixtures: RfqFixture[] = [
    { id: 'qa-rfq-01', code: 'VZ-QA-0001', title: 'تراورتن کرم نما برای مجتمع مسکونی تهران', categoryCodes: ['travertine'], quantities: [1850], provinceCode: 'tehran', lifecycleState: 'PUBLISHED', operationalStatus: 'HAS_QUOTES', approvalStatus: 'APPROVED', deadlineDays: 7, description: 'QA_MATCH_CASE | نمای خارجی، ضخامت ۲۰ میلی‌متر، برش طولی و سورت یکنواخت.' },
    { id: 'qa-rfq-02', code: 'VZ-QA-0002', title: 'گرانیت فلیم محوطه اداری اصفهان', categoryCodes: ['granite'], quantities: [920], provinceCode: 'isfahan', lifecycleState: 'PUBLISHED', operationalStatus: 'HAS_QUOTES', approvalStatus: 'APPROVED', deadlineDays: 4, description: 'QA_MATCH_CASE | مقاومت سایشی بالا و مناسب فضای باز.' },
    { id: 'qa-rfq-03', code: 'VZ-QA-0003', title: 'مرمریت روشن کف لابی هتل مشهد', categoryCodes: ['marmarit'], quantities: [640], provinceCode: 'razavi-khorasan', lifecycleState: 'PUBLISHED', operationalStatus: 'OPEN_FOR_QUOTES', approvalStatus: 'APPROVED', deadlineDays: 2, description: 'QA_MATCH_CASE | بدون پیشنهاد؛ ساب براق و جذب آب پایین.' },
    { id: 'qa-rfq-04', code: 'VZ-QA-0004', title: 'سنگ چینی سفید دیوار داخلی تهران', categoryCodes: ['crystal-china'], quantities: [410], provinceCode: 'tehran', lifecycleState: 'PUBLISHED', operationalStatus: 'HAS_QUOTES', approvalStatus: 'APPROVED', deadlineDays: 1, description: 'QA_MATCH_CASE | ابعاد ۴۰×۸۰ و لبه فارسی‌بر.' },
    { id: 'qa-rfq-05', code: 'VZ-QA-0005', title: 'بازالت محوطه ویلایی شیراز', categoryCodes: ['basalt'], quantities: [300], provinceCode: 'fars', lifecycleState: 'PUBLISHED', operationalStatus: 'OPEN_FOR_QUOTES', approvalStatus: 'APPROVED', deadlineDays: 5, description: 'QA_MATCH_CASE | سناریوی بدون فروشنده واجد شرایط جغرافیایی.' },
    { id: 'qa-rfq-06', code: 'VZ-QA-0006', title: 'پکیج نما و محوطه برج اداری تهران', categoryCodes: ['travertine', 'granite'], quantities: [1200, 750], provinceCode: 'tehran', lifecycleState: 'PUBLISHED', operationalStatus: 'HAS_QUOTES', approvalStatus: 'APPROVED', deadlineDays: 6, description: 'QA_MATCH_CASE | سناریوی چندردیفی با پیشنهاد کامل و جزئی.' },
    { id: 'qa-rfq-07', code: 'VZ-QA-0007', title: 'مرمر سبز کانتر پروژه لوکس مازندران', categoryCodes: ['onyx-marble'], quantities: [95], provinceCode: 'mazandaran', lifecycleState: 'SUBMITTED', operationalStatus: 'UNDER_REVIEW', approvalStatus: 'PENDING', deadlineDays: 10, description: 'در صف بررسی اپراتور؛ نیازمند کنترل مشخصات ظاهری.' },
    { id: 'qa-rfq-08', code: 'VZ-QA-0008', title: 'پیش‌نویس مرمریت پله پروژه یزد', categoryCodes: ['marmarit'], quantities: [1], provinceCode: 'yazd', lifecycleState: 'DRAFT', operationalStatus: 'DRAFT_INCOMPLETE', approvalStatus: 'NOT_SUBMITTED', deadlineDays: 14, description: 'سناریوی لبه‌ای حداقل مقدار معتبر و اطلاعات اختیاری ناقص.' },
    { id: 'qa-rfq-09', code: 'VZ-QA-0009', title: 'تراورتن نمای پروژه منقضی‌شده تهران', categoryCodes: ['travertine'], quantities: [500], provinceCode: 'tehran', lifecycleState: 'EXPIRED', operationalStatus: 'EXPIRED', approvalStatus: 'APPROVED', deadlineDays: -2, description: 'دعوت تاریخی فروشنده‌ای که اکنون فاقد شرایط است.' },
    { id: 'qa-rfq-10', code: 'VZ-QA-0010', title: 'مرمریت کف مرکز تجاری تهران در مذاکره', categoryCodes: ['marmarit'], quantities: [2200], provinceCode: 'tehran', lifecycleState: 'PUBLISHED', operationalStatus: 'NEGOTIATING', approvalStatus: 'APPROVED', deadlineDays: -1, description: 'مهلت بسته شده و مذاکره روی پیشنهادهای دریافت‌شده ادامه دارد.' },
    { id: 'qa-rfq-11', code: 'VZ-QA-0011', title: 'تراورتن نمای بیمارستان با فروشنده منتخب', categoryCodes: ['travertine'], quantities: [1450], provinceCode: 'tehran', lifecycleState: 'CLOSED', operationalStatus: 'SELLER_SELECTED', approvalStatus: 'APPROVED', deadlineDays: -10, description: 'جریان انتخاب فروشنده تکمیل شده است.' },
    { id: 'qa-rfq-12', code: 'VZ-QA-0012', title: 'گرانیت کف کارخانه لغوشده', categoryCodes: ['granite'], quantities: [780], provinceCode: 'isfahan', lifecycleState: 'CANCELLED', operationalStatus: 'CANCELLED', approvalStatus: 'APPROVED', deadlineDays: -5, description: 'سناریوی لغو پس از تغییر برنامه پروژه.' },
  ];

  for (const fixture of rfqFixtures) {
    const province = fixture.provinceCode ? requiredProvince(fixture.provinceCode) : undefined;
    const submitted = fixture.lifecycleState !== 'DRAFT';
    const published = ['PUBLISHED', 'CLOSED', 'EXPIRED', 'CANCELLED'].includes(fixture.lifecycleState);
    await prisma.rfq.create({ data: {
      id: fixture.id,
      code: fixture.code,
      buyerOrganizationId: ids.organizations.buyer,
      buyerContactUserId: ids.users.buyer,
      createdByUserId: ids.users.buyer,
      primaryDomainId: industry.id,
      title: fixture.title,
      description: fixture.description,
      lifecycleState: fixture.lifecycleState,
      operationalStatus: fixture.operationalStatus,
      approvalStatus: fixture.approvalStatus,
      source: 'BUYER_SELF_SERVICE',
      manualReviewRequired: true,
      commitmentStatus: 'NOT_REQUIRED',
      deliveryProvinceId: province?.id,
      deliveryProvince: province?.nameFa,
      requiredAt: dateFromNow(35),
      responseDeadline: fixture.deadlineDays === undefined ? null : dateFromNow(fixture.deadlineDays),
      submittedAt: submitted ? dateFromNow(-4) : null,
      publishedAt: published ? dateFromNow(-3) : null,
      closedAt: ['CLOSED', 'EXPIRED', 'CANCELLED'].includes(fixture.lifecycleState) ? dateFromNow(-1) : null,
      displayPricesTaxInclusive: false,
      items: { create: fixture.categoryCodes.map((code, index) => ({
        id: `${fixture.id}-item-${index + 1}`,
        categoryId: requiredCategory(code).id,
        unitId: unit.id,
        title: `${requiredCategory(code).nameFa} - ردیف ${index + 1}`,
        quantity: new Prisma.Decimal(fixture.quantities[index] ?? 1),
        specifications: { finish: index === 0 ? 'سابیده' : 'بوش‌همر', 'thickness-mm': index === 0 ? 20 : 30, application: [index === 0 ? 'نمای خارجی' : 'کف محوطه'], qaFixture: true },
        estimatedLineValueRial: BigInt((fixture.quantities[index] ?? 1) * (index === 0 ? 35_000_000 : 48_000_000)),
        sortOrder: index,
      })) },
    } });
  }

  const invitations = [
    ['qa-rfq-01', ids.organizations.supplierA, 'RESPONDED'],
    ['qa-rfq-02', ids.organizations.supplierB, 'RESPONDED'],
    ['qa-rfq-03', ids.organizations.supplierA, 'VIEWED'],
    ['qa-rfq-04', ids.organizations.supplierB, 'RESPONDED'],
    ['qa-rfq-06', ids.organizations.supplierA, 'RESPONDED'],
    ['qa-rfq-06', ids.organizations.supplierB, 'RESPONDED'],
    ['qa-rfq-09', ids.organizations.supplierC, 'EXPIRED'],
    ['qa-rfq-10', ids.organizations.supplierA, 'RESPONDED'],
    ['qa-rfq-11', ids.organizations.supplierA, 'RESPONDED'],
    ['qa-rfq-12', ids.organizations.supplierB, 'DECLINED'],
  ] as const;
  await prisma.rfqInvitation.createMany({ data: invitations.map(([rfqId, supplierOrganizationId, status], index) => ({
    id: `qa-invitation-${index + 1}`,
    rfqId,
    supplierOrganizationId,
    status,
    matchReasons: rfqId === 'qa-rfq-09'
      ? { strategy: 'NEGATIVE_FIXTURE', eligibleAtInvite: true, currentEligibility: false, reason: 'verification_and_subscription_expired' }
      : { strategy: 'RULE_BASED_V1', qaFixture: true },
    viewedAt: status === 'VIEWED' || status === 'RESPONDED' ? dateFromNow(-2) : null,
    respondedAt: status === 'RESPONDED' ? dateFromNow(-1) : null,
    declinedAt: status === 'DECLINED' ? dateFromNow(-1) : null,
  })) });

  type QuoteLine = { rfqItemId: string; quantity: number; unitPriceRial: bigint; discountRial?: bigint; alternative?: boolean };
  async function createQuotation(input: {
    id: string; code: string; rfqId: string; supplierOrganizationId: string; createdByUserId: string;
    status: 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'; lines: QuoteLine[];
    shippingRial?: bigint; packagingRial?: bigint; taxRial?: bigint; preparationDays?: number;
  }): Promise<void> {
    const lineRows = input.lines.map((line, index) => {
      const subtotal = BigInt(line.quantity) * line.unitPriceRial;
      const discount = line.discountRial ?? 0n;
      return { id: `${input.id}-item-${index + 1}`, ...line, subtotal, discount, net: subtotal - discount };
    });
    const subtotalRial = lineRows.reduce((sum, line) => sum + line.subtotal, 0n);
    const lineDiscountRial = lineRows.reduce((sum, line) => sum + line.discount, 0n);
    const shippingRial = input.shippingRial ?? 0n;
    const packagingRial = input.packagingRial ?? 0n;
    const taxRial = input.taxRial ?? 0n;
    const finalAmountRial = subtotalRial - lineDiscountRial + shippingRial + packagingRial + taxRial;
    await prisma.quotation.create({ data: {
      id: input.id, code: input.code, rfqId: input.rfqId, supplierOrganizationId: input.supplierOrganizationId,
      createdByUserId: input.createdByUserId, status: input.status, preparationDays: input.preparationDays ?? 14,
      paymentTerms: '۳۰٪ پیش‌پرداخت، تسویه پیش از بارگیری', validUntil: dateFromNow(12),
      subtotalRial, discountRial: lineDiscountRial, taxRial, packagingRial, shippingRial, finalAmountRial,
      submittedAt: input.status === 'DRAFT' ? null : dateFromNow(-1),
      items: { create: lineRows.map((line) => ({
        id: line.id, rfqItemId: line.rfqItemId, quantity: new Prisma.Decimal(line.quantity), unitPriceRial: line.unitPriceRial,
        discountRial: line.discount, lineSubtotalRial: line.subtotal, lineNetRial: line.net,
        isAlternative: line.alternative ?? false, offeredDescription: line.alternative ? 'گزینه جایگزین هم‌رده برای بررسی خریدار' : null,
      })) },
    } });
  }

  await createQuotation({ id: 'qa-quote-01-a', code: 'VZQ-QA-0001-A', rfqId: 'qa-rfq-01', supplierOrganizationId: ids.organizations.supplierA, createdByUserId: ids.users.supplierA, status: 'SUBMITTED', lines: [{ rfqItemId: 'qa-rfq-01-item-1', quantity: 1850, unitPriceRial: 38_500_000n, discountRial: 650_000_000n }], shippingRial: 920_000_000n, preparationDays: 16 });
  await createQuotation({ id: 'qa-quote-02-b', code: 'VZQ-QA-0002-B', rfqId: 'qa-rfq-02', supplierOrganizationId: ids.organizations.supplierB, createdByUserId: ids.users.supplierB, status: 'SUBMITTED', lines: [{ rfqItemId: 'qa-rfq-02-item-1', quantity: 920, unitPriceRial: 46_000_000n }], shippingRial: 380_000_000n, packagingRial: 95_000_000n, preparationDays: 20 });
  await createQuotation({ id: 'qa-quote-04-b', code: 'VZQ-QA-0004-B', rfqId: 'qa-rfq-04', supplierOrganizationId: ids.organizations.supplierB, createdByUserId: ids.users.supplierB, status: 'SUBMITTED', lines: [{ rfqItemId: 'qa-rfq-04-item-1', quantity: 410, unitPriceRial: 92_000_000n, alternative: true }], shippingRial: 210_000_000n, preparationDays: 28 });
  await createQuotation({ id: 'qa-quote-06-a', code: 'VZQ-QA-0006-A', rfqId: 'qa-rfq-06', supplierOrganizationId: ids.organizations.supplierA, createdByUserId: ids.users.supplierA, status: 'SUBMITTED', lines: [{ rfqItemId: 'qa-rfq-06-item-1', quantity: 1000, unitPriceRial: 37_000_000n }], shippingRial: 620_000_000n, preparationDays: 15 });
  await createQuotation({ id: 'qa-quote-06-b', code: 'VZQ-QA-0006-B', rfqId: 'qa-rfq-06', supplierOrganizationId: ids.organizations.supplierB, createdByUserId: ids.users.supplierB, status: 'SUBMITTED', lines: [{ rfqItemId: 'qa-rfq-06-item-1', quantity: 1200, unitPriceRial: 41_000_000n, alternative: true }, { rfqItemId: 'qa-rfq-06-item-2', quantity: 750, unitPriceRial: 49_500_000n }], shippingRial: 1_200_000_000n, preparationDays: 23 });
  await createQuotation({ id: 'qa-quote-10-a', code: 'VZQ-QA-0010-A', rfqId: 'qa-rfq-10', supplierOrganizationId: ids.organizations.supplierA, createdByUserId: ids.users.supplierA, status: 'SUBMITTED', lines: [{ rfqItemId: 'qa-rfq-10-item-1', quantity: 2200, unitPriceRial: 44_000_000n }], shippingRial: 800_000_000n, preparationDays: 18 });
  await createQuotation({ id: 'qa-quote-11-a', code: 'VZQ-QA-0011-A', rfqId: 'qa-rfq-11', supplierOrganizationId: ids.organizations.supplierA, createdByUserId: ids.users.supplierA, status: 'ACCEPTED', lines: [{ rfqItemId: 'qa-rfq-11-item-1', quantity: 1450, unitPriceRial: 39_500_000n }], shippingRial: 640_000_000n, preparationDays: 14 });

  await prisma.auditLog.createMany({ data: [
    { id: 'qa-audit-seed', actorUserId: ids.users.admin, action: 'qa.dataset.seeded', entityType: 'QaDataset', entityId: 'qa-marketplace-v1', metadata: { rfqCount: 12, supplierCount: 3 } },
    { id: 'qa-audit-selection', actorUserId: ids.users.buyer, organizationId: ids.organizations.buyer, action: 'quotation.accept', entityType: 'Quotation', entityId: 'qa-quote-11-a' },
  ] });
}

async function validate(): Promise<{ passed: boolean; results: ValidationResult[]; summary: Record<string, number> }> {
  assertSafeEnvironment();
  const [users, organizations, rfqs, quotations, invitations] = await Promise.all([
    prisma.user.findMany({ where: { id: { startsWith: QA_PREFIX } }, select: { id: true } }),
    prisma.organization.findMany({ where: { id: { startsWith: 'qa-org-' } }, select: { id: true, kind: true } }),
    prisma.rfq.findMany({ where: { id: { startsWith: 'qa-rfq-' } }, include: { items: true } }),
    prisma.quotation.findMany({ where: { id: { startsWith: 'qa-quote-' } }, include: { items: true, rfq: { select: { items: { select: { id: true } } } } } }),
    prisma.rfqInvitation.findMany({ where: { id: { startsWith: 'qa-invitation-' } } }),
  ]);
  const results: ValidationResult[] = [];
  const add = (code: string, title: string, passed: boolean, details: string) => results.push({ code, title, passed, details });

  add('DATA-001', 'حداقل کاربران و سازمان‌ها', users.length >= 5 && organizations.filter((row) => row.kind === 'BUYER').length === 1 && organizations.filter((row) => row.kind === 'SUPPLIER').length === 3, `${users.length} کاربر، ${organizations.length} سازمان`);
  add('DATA-002', 'تعداد و تنوع استعلام‌ها', rfqs.length === 12 && new Set(rfqs.flatMap((rfq) => rfq.items.map((item) => item.categoryId))).size >= 6 && new Set(rfqs.map((rfq) => rfq.deliveryProvinceId).filter(Boolean)).size >= 5, `${rfqs.length} استعلام، ${new Set(rfqs.flatMap((rfq) => rfq.items.map((item) => item.categoryId))).size} دسته، ${new Set(rfqs.map((rfq) => rfq.deliveryProvinceId).filter(Boolean)).size} استان`);
  const lifecycleStates = new Set(rfqs.map((rfq) => rfq.lifecycleState));
  add('DATA-003', 'پوشش چرخه عمر RFQ', ['DRAFT', 'SUBMITTED', 'PUBLISHED', 'CLOSED', 'CANCELLED', 'EXPIRED'].every((state) => lifecycleStates.has(state as never)), [...lifecycleStates].join(', '));
  const now = new Date();
  add('DATA-004', 'مهلت‌های گذشته و آینده', rfqs.some((rfq) => rfq.responseDeadline && rfq.responseDeadline < now) && rfqs.some((rfq) => rfq.responseDeadline && rfq.responseDeadline > now), 'مهلت منقضی و فعال هر دو موجود است.');
  const noQuoteRfqs = rfqs.filter((rfq) => !quotations.some((quote) => quote.rfqId === rfq.id));
  const partialQuotes = quotations.filter((quote) => quote.items.length < quote.rfq.items.length);
  add('DATA-005', 'پیشنهادهای کامل، جزئی و بدون پاسخ', quotations.length >= 7 && partialQuotes.length >= 1 && noQuoteRfqs.length >= 3, `${quotations.length} پیشنهاد، ${partialQuotes.length} جزئی، ${noQuoteRfqs.length} RFQ بدون پیشنهاد`);

  const invalidTotals = quotations.filter((quote) => {
    const lineNet = quote.items.reduce((sum, item) => sum + item.lineNetRial, 0n);
    return lineNet + quote.taxRial + quote.packagingRial + quote.loadingRial + quote.shippingRial + quote.otherCostsRial !== quote.finalAmountRial;
  });
  add('DATA-006', 'صحت محاسبات پیشنهاد', invalidTotals.length === 0, invalidTotals.length ? `ناسازگار: ${invalidTotals.map((quote) => quote.code).join(', ')}` : 'تمام جمع‌ها با ردیف‌ها و هزینه‌های جانبی سازگارند.');

  const expectedMatches = new Map<string, string[]>([
    ['qa-rfq-01', [ids.organizations.supplierA]],
    ['qa-rfq-02', [ids.organizations.supplierB]],
    ['qa-rfq-03', [ids.organizations.supplierA]],
    ['qa-rfq-04', [ids.organizations.supplierB]],
    ['qa-rfq-05', []],
    ['qa-rfq-06', [ids.organizations.supplierA, ids.organizations.supplierB]],
  ]);
  const mismatch: string[] = [];
  for (const [rfqId, expected] of expectedMatches) {
    const actual = invitations.filter((invitation) => invitation.rfqId === rfqId).map((invitation) => invitation.supplierOrganizationId).sort();
    if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) mismatch.push(`${rfqId}: ${actual.join(',')}`);
  }
  add('MATCH-001', 'ماتریس دعوت واجد شرایط', mismatch.length === 0, mismatch.length ? mismatch.join(' | ') : 'دسته، جغرافیا، احراز و اشتراک مطابق انتظار پوشش داده شده‌اند.');
  const negativeInvitation = invitations.find((invitation) => invitation.rfqId === 'qa-rfq-09' && invitation.supplierOrganizationId === ids.organizations.supplierC);
  add('MATCH-002', 'دعوت منفی/تاریخی', negativeInvitation?.status === 'EXPIRED', negativeInvitation ? 'دعوت فروشنده فاقد شرایط با وضعیت EXPIRED و دلیل قابل ردیابی ثبت شده است.' : 'دعوت منفی یافت نشد.');

  const respondedWithoutQuote = invitations.filter((invitation) => invitation.status === 'RESPONDED' && !quotations.some((quote) => quote.rfqId === invitation.rfqId && quote.supplierOrganizationId === invitation.supplierOrganizationId));
  add('DATA-007', 'سازگاری دعوت و پیشنهاد', respondedWithoutQuote.length === 0, respondedWithoutQuote.length ? `ناسازگار: ${respondedWithoutQuote.map((row) => row.id).join(', ')}` : 'تمام دعوت‌های پاسخ‌داده‌شده حداقل یک پیشنهاد دارند.');

  return {
    passed: results.every((result) => result.passed),
    results,
    summary: {
      users: users.length,
      organizations: organizations.length,
      rfqs: rfqs.length,
      invitations: invitations.length,
      quotations: quotations.length,
      passedChecks: results.filter((result) => result.passed).length,
      failedChecks: results.filter((result) => !result.passed).length,
    },
  };
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'run';
  if (command === 'cleanup') {
    await cleanup();
    console.log(JSON.stringify({ command, cleaned: true }));
    return;
  }
  if (command === 'seed' || command === 'run') await seed();
  if (command === 'validate' || command === 'run') {
    const validation = await validate();
    console.log(JSON.stringify({ command, ...validation }, null, 2));
    if (!validation.passed) process.exitCode = 1;
    return;
  }
  if (!['seed', 'validate', 'run'].includes(command)) throw new Error(`Unknown command: ${command}`);
  console.log(JSON.stringify({ command, seeded: true }));
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
