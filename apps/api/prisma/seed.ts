import { PrismaClient } from '@prisma/client';
import { normalizeIranianMobile } from '../src/modules/auth/domain/mobile';

const prisma = new PrismaClient();
const permissions = [
  'user.read', 'user.manage', 'organization.read', 'organization.manage', 'supplier.verify',
  'category.read', 'category.manage', 'rfq.create', 'rfq.create_on_behalf', 'rfq.read', 'rfq.review',
  'rfq.manage', 'quotation.create', 'quotation.read', 'quotation.manage', 'subscription.read',
  'subscription.manage', 'billing.read', 'billing.manage', 'payment.manage', 'content.manage',
  'support.manage', 'audit.read', 'settings.read', 'settings.manage',
];
const roles: Record<string, string[]> = {
  SUPER_ADMIN: permissions,
  ADMIN: permissions.filter((key) => !['settings.manage'].includes(key)),
  SUPPORT: ['user.read', 'organization.read', 'rfq.read', 'rfq.create_on_behalf', 'quotation.read', 'support.manage'],
  FINANCE: ['organization.read', 'subscription.read', 'subscription.manage', 'billing.read', 'billing.manage', 'payment.manage'],
  CONTENT_MANAGER: ['category.read', 'category.manage', 'content.manage'],
  BUYER_OWNER: ['organization.read', 'organization.manage', 'category.read', 'rfq.create', 'rfq.read', 'quotation.read'],
  BUYER_MEMBER: ['organization.read', 'category.read', 'rfq.create', 'rfq.read', 'quotation.read'],
  SUPPLIER_OWNER: ['organization.read', 'organization.manage', 'category.read', 'rfq.read', 'quotation.create', 'quotation.read', 'subscription.read', 'billing.read'],
  SUPPLIER_MANAGER: ['organization.read', 'category.read', 'rfq.read', 'quotation.create', 'quotation.read', 'subscription.read'],
  SUPPLIER_SALES: ['organization.read', 'category.read', 'rfq.read', 'quotation.create', 'quotation.read'],
};

const naturalStoneCategories = [
  ['travertine', 'travertine', 'تراورتن', 'Travertine'],
  ['marmarit', 'marmarit', 'مرمریت', 'Marmarit'],
  ['granite', 'granite', 'گرانیت', 'Granite'],
  ['crystal-china', 'crystal-china', 'چینی و کریستال', 'Crystal / China Stone'],
  ['onyx-marble', 'onyx-marble', 'مرمر', 'Onyx Marble'],
  ['andesite', 'andesite', 'آندزیت', 'Andesite'],
  ['basalt', 'basalt', 'بازالت', 'Basalt'],
  ['tramite', 'tramite', 'ترامیت', 'Tramite'],
  ['travonyx', 'travonyx', 'تراونیکس', 'Travonyx'],
  ['limestone', 'limestone', 'لایم‌استون و سنگ آهک', 'Limestone'],
  ['sandstone', 'sandstone', 'ماسه‌سنگ', 'Sandstone'],
  ['quartzite', 'quartzite', 'کوارتزیت', 'Quartzite'],
  ['slate', 'slate', 'اسلیت و سنگ لوح', 'Slate'],
  ['tuff', 'tuff', 'توف', 'Tuff'],
  ['conglomerate', 'conglomerate', 'کنگلومرا', 'Conglomerate'],
] as const;

const systemSettings = [
  ['market.coverage.country', 'IR', 'کشور بازار اولیه وازانو'],
  ['market.coverage.mode', 'NATIONWIDE', 'پوشش جغرافیایی بازار'],
  ['pricing.display_tax_inclusive', false, 'نمایش قیمت‌ها بدون مالیات'],
  ['platform.legal_role', 'INFORMATION_INTERMEDIARY', 'نقش حقوقی پایه پلتفرم'],
  ['quality_control.enabled', true, 'فعال بودن خدمت اختیاری کنترل کیفیت'],
  ['quality_control.fee_bps', 300, 'کارمزد کنترل کیفیت بر حسب صدم درصد'],
  ['rfq.operator_entry_enabled', true, 'ثبت استعلام به نمایندگی از خریدار توسط اپراتور'],
  ['rfq.pilot_manual_review', true, 'بازبینی دستی همه استعلام‌های پایلوت'],
  ['rfq.buyer_commitment_amount_rial', 2_500_000, 'سپرده تعهد خریدار جدید در پایلوت'],
  ['rfq.buyer_commitment_policy_version', 'BUYER_PRICE_V1_0', 'نسخه سیاست سپرده تعهد خریدار'],
  ['subscription.grace_period_days', 7, 'مهلت تنفس پس از پایان اشتراک'],
  ['subscription.renewal_warning_offsets_days', [-14, -7, -3, 0, 7], 'روزهای ارسال اخطار تمدید نسبت به انقضا'],
  ['notification.sms.send_window_local', { startHour: 9, endHour: 20, timezone: 'Asia/Tehran' }, 'بازه مجاز ارسال پیامک'],
  ['notification.sms.renewal_max_per_24h', 1, 'حداکثر پیامک تمدید در ۲۴ ساعت'],
  ['seller.proposal_fee_policy', { version: '1.2', rate: '0.001', minToman: 100_000, maxToman: 5_000_000, refundFractionIfEligible: '2/3' }, 'سیاست هزینه ارسال پیشنهاد فروشنده'],
  ['seller.daily_proposal_limit', { base: 2, shortageOverrideMax: 6 }, 'محدودیت روزانه پیشنهاد موفق'],
] as const;

async function main(): Promise<void> {
  for (const key of permissions) {
    await prisma.permission.upsert({ where: { key }, create: { key, description: key }, update: {} });
  }
  for (const [key, rolePermissions] of Object.entries(roles)) {
    const role = await prisma.role.upsert({ where: { key }, create: { key, nameFa: key }, update: {} });
    const records = await prisma.permission.findMany({ where: { key: { in: rolePermissions } }, select: { id: true } });
    await prisma.rolePermission.createMany({ data: records.map(({ id }) => ({ roleId: role.id, permissionId: id })), skipDuplicates: true });
  }

  const industry = await prisma.industry.upsert({
    where: { code: 'building-materials' },
    create: { code: 'building-materials', nameFa: 'مصالح ساختمانی', nameEn: 'Building Materials', sortOrder: 10 },
    update: { nameFa: 'مصالح ساختمانی', isActive: true },
  });
  const naturalStone = await prisma.category.upsert({
    where: { code: 'natural-stone' },
    create: { industryId: industry.id, code: 'natural-stone', slug: 'natural-stone', nameFa: 'سنگ طبیعی', nameEn: 'Natural Stone', sortOrder: 10 },
    update: { industryId: industry.id, nameFa: 'سنگ طبیعی', isActive: true },
  });
  for (const [code, slug, nameFa, nameEn] of naturalStoneCategories) {
    await prisma.category.upsert({
      where: { code },
      create: { industryId: industry.id, parentId: naturalStone.id, code, slug, nameFa, nameEn, sortOrder: naturalStoneCategories.findIndex((item) => item[0] === code) + 1 },
      update: { industryId: industry.id, parentId: naturalStone.id, nameFa, nameEn, isActive: true },
    });
  }

  const units = [
    ['square-meter', 'متر مربع', 'م²', 3],
    ['linear-meter', 'متر طول', 'متر', 3],
    ['piece', 'عدد', 'عدد', 0],
    ['tonne', 'تن', 'تن', 3],
    ['kilogram', 'کیلوگرم', 'کیلوگرم', 3],
    ['slab', 'اسلب', 'اسلب', 0],
  ] as const;
  for (const [code, nameFa, symbolFa, decimalScale] of units) {
    await prisma.unitOfMeasure.upsert({
      where: { code },
      create: { code, nameFa, symbolFa, decimalScale },
      update: { nameFa, symbolFa, decimalScale, isActive: true },
    });
  }

  const plans = [
    { code: 'SELLER_P1M_V1', nameFa: 'اشتراک فروشنده یک‌ماهه', billingCycle: 'P1M' as const, durationIso: 'P1M', priceRial: 50_000_000n, grantCredits: 5_000_000n },
    { code: 'SELLER_P3M_V1', nameFa: 'اشتراک فروشنده سه‌ماهه', billingCycle: 'P3M' as const, durationIso: 'P3M', priceRial: 145_500_000n, grantCredits: 14_550_000n },
    { code: 'SELLER_P6M_V1', nameFa: 'اشتراک فروشنده شش‌ماهه', billingCycle: 'P6M' as const, durationIso: 'P6M', priceRial: 279_000_000n, grantCredits: 27_900_000n },
    { code: 'SELLER_P1Y_V1', nameFa: 'اشتراک فروشنده سالانه', billingCycle: 'P1Y' as const, durationIso: 'P1Y', priceRial: 480_000_000n, grantCredits: 48_000_000n },
  ];
  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      create: { ...plan, taxIncluded: false, entitlements: { canViewMatchedRfqs: true, dailyProposalLimit: 2, shortageOverrideMax: 6 } },
      update: { ...plan, taxIncluded: false, isActive: true, entitlements: { canViewMatchedRfqs: true, dailyProposalLimit: 2, shortageOverrideMax: 6 } },
    });
  }

  for (const [key, value, descriptionFa] of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, descriptionFa },
      update: { value, descriptionFa },
    });
  }

  const adminMobile = process.env.SEED_ADMIN_MOBILE;
  if (adminMobile) {
    const user = await prisma.user.upsert({ where: { mobile: normalizeIranianMobile(adminMobile) }, create: { mobile: normalizeIranianMobile(adminMobile), mobileVerifiedAt: new Date() }, update: {} });
    const role = await prisma.role.findUniqueOrThrow({ where: { key: 'SUPER_ADMIN' } });
    const existing = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id, organizationId: null } });
    if (!existing) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO_DATA !== 'false') {
      const buyer = await prisma.organization.upsert({
        where: { id: 'demo-buyer-organization' },
        create: { id: 'demo-buyer-organization', kind: 'BUYER', type: 'COMPANY', legalName: 'خریدار آزمایشی وازانو', displayName: 'خریدار آزمایشی', province: 'تهران', city: 'تهران', status: 'ACTIVE' },
        update: { status: 'ACTIVE' },
      });
      await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: buyer.id, userId: user.id } },
        create: { organizationId: buyer.id, userId: user.id, role: 'BUYER_OWNER' },
        update: { role: 'BUYER_OWNER', status: 'ACTIVE' },
      });
      const demoCategory = await prisma.category.findFirstOrThrow({ where: { parentId: naturalStone.id }, orderBy: { sortOrder: 'asc' } });
      const demoUnit = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'square-meter' } });
      await prisma.rfq.upsert({
        where: { id: 'demo-historical-rfq' },
        create: {
          id: 'demo-historical-rfq', code: 'VZ-DEMO-HISTORY', buyerOrganizationId: buyer.id, buyerContactUserId: user.id, createdByUserId: user.id,
          primaryDomainId: industry.id, title: 'سابقه آزمایشی تکمیل‌شده', lifecycleState: 'CLOSED', operationalStatus: 'COMPLETED', approvalStatus: 'APPROVED',
          source: 'PLATFORM_OPERATOR', manualReviewRequired: false, commitmentStatus: 'NOT_REQUIRED', displayPricesTaxInclusive: false, closedAt: new Date(),
          items: { create: { id: 'demo-historical-rfq-item', categoryId: demoCategory.id, unitId: demoUnit.id, title: 'ردیف آزمایشی سابقه', quantity: '1' } },
        },
        update: {},
      });

      const supplier = await prisma.organization.upsert({
        where: { id: 'demo-supplier-organization' },
        create: { id: 'demo-supplier-organization', kind: 'SUPPLIER', type: 'COMPANY', legalName: 'سنگ نمونه وازانو', displayName: 'سنگ نمونه وازانو', province: 'تهران', city: 'تهران', status: 'ACTIVE' },
        update: { status: 'ACTIVE' },
      });
      await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: supplier.id, userId: user.id } },
        create: { organizationId: supplier.id, userId: user.id, role: 'SUPPLIER_OWNER' },
        update: { role: 'SUPPLIER_OWNER', status: 'ACTIVE' },
      });
      const supplierProfile = await prisma.supplierProfile.upsert({
        where: { organizationId: supplier.id },
        create: { organizationId: supplier.id, description: 'داده آزمایشی محیط توسعه برای کنترل جریان کامل استعلام و پیشنهاد', nationwideCoverage: true, verificationStatus: 'VERIFIED', verifiedAt: new Date() },
        update: { nationwideCoverage: true, verificationStatus: 'VERIFIED', verifiedAt: new Date() },
      });
      const stoneCategories = await prisma.category.findMany({ where: { parentId: naturalStone.id }, select: { id: true } });
      await prisma.supplierCategory.createMany({ data: stoneCategories.map(({ id }) => ({ supplierProfileId: supplierProfile.id, categoryId: id })), skipDuplicates: true });

      const demoPlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: 'SELLER_P1M_V1' } });
      const startsAt = new Date();
      const expiresAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      await prisma.subscription.upsert({
        where: { id: 'demo-supplier-subscription' },
        create: { id: 'demo-supplier-subscription', organizationId: supplier.id, planId: demoPlan.id, status: 'ACTIVE', startsAt, expiresAt, graceEndsAt: new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000), priceRialSnapshot: demoPlan.priceRial, grantCreditSnapshot: demoPlan.grantCredits, planVersionSnapshot: demoPlan.version },
        update: { status: 'ACTIVE', startsAt, expiresAt, graceEndsAt: new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000) },
      });
      const wallet = await prisma.creditWallet.upsert({
        where: { organizationId: supplier.id },
        create: { organizationId: supplier.id, cachedBalanceCredits: 10_000_000n },
        update: {},
      });
      await prisma.creditLedgerEntry.upsert({
        where: { idempotencyKey: 'demo-supplier:initial-credit:v1' },
        create: { walletId: wallet.id, type: 'GRANT', amountCredits: 10_000_000n, referenceType: 'DevelopmentSeed', referenceId: supplier.id, idempotencyKey: 'demo-supplier:initial-credit:v1', reasonCode: 'DEVELOPMENT_DEMO_DATA' },
        update: {},
      });
    }
  }
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
