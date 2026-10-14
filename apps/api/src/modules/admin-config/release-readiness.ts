export type ReleaseReadinessStatus = 'READY' | 'WARNING' | 'BLOCKED';

export type ReleaseReadinessCheck = {
  key: string;
  title: string;
  status: ReleaseReadinessStatus;
  detail: string;
  actionPath?: string;
};

export type ReleaseReadinessInput = {
  nodeEnvironment: string;
  otpDebugEnabled: boolean;
  smsConfigured: boolean;
  subscriptionSmsConfigured: boolean;
  paymentConfigured: boolean;
  fileScanningConfigured: boolean;
  notificationWorkerEnabled: boolean;
  subscriptionWorkerEnabled: boolean;
  rfqLifecycleWorkerEnabled: boolean;
  termsPublished: boolean;
  privacyPublished: boolean;
  paidPlanCount: number;
  activeCategoryCount: number;
  activeUnitCount: number;
  activeProvinceCount: number;
  marketCoverageConfigured: boolean;
  activeBuyerOrganizationCount: number;
  eligibleSupplierCount: number;
  uncoveredCategoryCount: number;
  uncoveredProvinceCount: number;
  uncoveredCategoryNames: string[];
  uncoveredProvinceNames: string[];
  activeSuperAdminCount: number;
};

export function evaluateReleaseReadiness(input: ReleaseReadinessInput): { ready: boolean; checks: ReleaseReadinessCheck[] } {
  const checks: ReleaseReadinessCheck[] = [
    check('environment.production', 'حالت اجرای Production', input.nodeEnvironment === 'production', 'محیط روی Production تنظیم شده است.', 'نسخه فعلی در محیط توسعه اجرا می‌شود؛ این وضعیت برای کار محلی طبیعی است.'),
    check('security.otp-debug', 'غیرفعال بودن کد ورود آزمایشی', !input.otpDebugEnabled, 'کد ثابت آزمایشی غیرفعال است.', 'کد ثابت آزمایشی فعال است و در انتشار نهایی مجاز نیست.'),
    check('integration.sms', 'پیامک ورود SMS.ir', input.smsConfigured, 'ارائه‌دهنده، کلید و قالب ورود تنظیم شده‌اند.', 'تنظیمات کامل SMS.ir برای ورود موجود نیست.'),
    check('integration.subscription-sms', 'پیامک‌های تمدید اشتراک', input.subscriptionSmsConfigured, 'ارسال پیامک تمدید و همه قالب‌های لازم فعال‌اند.', 'پیامک تمدید یا یکی از قالب‌های سیاست تمدید هنوز فعال نشده است.'),
    check('integration.payment', 'درگاه واقعی زرین‌پال', input.paymentConfigured, 'پرداخت واقعی، Merchant و حالت غیرآزمایشی تنظیم شده‌اند.', 'درگاه واقعی زرین‌پال هنوز برای Production فعال نیست.'),
    check('security.file-scan', 'اسکن امنیتی فایل‌ها', input.fileScanningConfigured, 'فایل‌ها با ClamAV بررسی می‌شوند.', 'اسکن ClamAV فعال نیست؛ بارگذاری فایل در Production نباید بدون آن منتشر شود.'),
    check('worker.notifications', 'پردازش اعلان‌ها', input.notificationWorkerEnabled, 'Worker اعلان‌ها فعال است.', 'Worker اعلان‌ها غیرفعال است.'),
    check('worker.subscriptions', 'چرخه عمر اشتراک', input.subscriptionWorkerEnabled, 'Worker انقضا و تمدید اشتراک فعال است.', 'Worker چرخه عمر اشتراک غیرفعال است.'),
    check('worker.rfq-lifecycle', 'چرخه مهلت استعلام', input.rfqLifecycleWorkerEnabled, 'Worker پایان مهلت دریافت پیشنهاد فعال است.', 'Worker پایان مهلت استعلام غیرفعال است.'),
    check('content.terms', 'قوانین و شرایط استفاده', input.termsPublished, 'صفحه قوانین منتشر شده است.', 'صفحه قوانین هنوز پیش‌نویس است و باید پس از تأیید مالک/حقوقی منتشر شود.', '/admin/content'),
    check('content.privacy', 'سیاست حریم خصوصی', input.privacyPublished, 'صفحه حریم خصوصی منتشر شده است.', 'صفحه حریم خصوصی هنوز پیش‌نویس است و باید پس از تأیید مالک/حقوقی منتشر شود.', '/admin/content'),
    check('billing.plan', 'پلن پولی قابل خرید', input.paidPlanCount > 0, `${input.paidPlanCount.toLocaleString('fa-IR')} پلن پولی فعال و عمومی وجود دارد.`, 'هیچ پلن پولی فعال و عمومی برای خرید وجود ندارد.', '/admin/billing'),
    check('catalog.categories', 'دسته‌بندی قابل استفاده', input.activeCategoryCount > 0, `${input.activeCategoryCount.toLocaleString('fa-IR')} دسته فعال وجود دارد.`, 'دسته‌بندی فعالی برای ثبت استعلام وجود ندارد.', '/admin/catalog'),
    check('catalog.units', 'واحدهای اندازه‌گیری', input.activeUnitCount > 0, `${input.activeUnitCount.toLocaleString('fa-IR')} واحد اندازه‌گیری فعال وجود دارد.`, 'هیچ واحد فعالی برای اقلام استعلام وجود ندارد.', '/admin/catalog'),
    check('locations.provinces', 'پوشش استان‌های ایران', input.activeProvinceCount >= 31, `${input.activeProvinceCount.toLocaleString('fa-IR')} استان فعال ثبت شده است.`, `فقط ${input.activeProvinceCount.toLocaleString('fa-IR')} استان فعال ثبت شده است.`, '/admin/locations'),
    check('market.coverage', 'پوشش فعال بازار', input.marketCoverageConfigured, 'پوشش جغرافیایی بازار معتبر و با استان‌های فعال همخوان است.', 'تنظیم پوشش بازار نامعتبر است یا به استان غیرفعال اشاره می‌کند.', '/admin/settings'),
    check('market.buyers', 'خریدار پایلوت فعال', input.activeBuyerOrganizationCount > 0, `${input.activeBuyerOrganizationCount.toLocaleString('fa-IR')} سازمان خریدار فعال و دارای عضو وجود دارد.`, 'هنوز هیچ سازمان خریدار فعال و دارای عضو برای پایلوت وجود ندارد.', '/admin/users'),
    check('market.suppliers', 'فروشنده واجد شرایط', input.eligibleSupplierCount > 0, `${input.eligibleSupplierCount.toLocaleString('fa-IR')} فروشنده تأییدشده با اشتراک، دسته و پوشش فعال وجود دارد.`, 'هیچ فروشنده‌ای هم‌زمان تأییدشده، دارای اشتراک معتبر، دسته و پوشش فعال وجود ندارد.', '/admin/suppliers'),
    check('market.category-supply', 'پوشش عرضه انواع سنگ', input.activeCategoryCount > 0 && input.uncoveredCategoryCount === 0, 'همه دسته‌های فعال حداقل یک فروشنده واجد شرایط دارند.', coverageGapDetail(input.uncoveredCategoryCount, 'دسته فعال', input.uncoveredCategoryNames), '/admin/suppliers'),
    check('market.province-supply', 'پوشش عرضه جغرافیایی', input.activeProvinceCount > 0 && input.uncoveredProvinceCount === 0, 'همه استان‌های هدف حداقل توسط یک فروشنده واجد شرایط پوشش داده می‌شوند.', coverageGapDetail(input.uncoveredProvinceCount, 'استان هدف', input.uncoveredProvinceNames), '/admin/suppliers'),
    check(
      'access.super-admin',
      'مدیران ارشد بازیابی',
      input.activeSuperAdminCount >= 2,
      `${input.activeSuperAdminCount.toLocaleString('fa-IR')} مدیر ارشد فعال برای مدیریت و بازیابی وجود دارد.`,
      input.activeSuperAdminCount === 0
        ? 'هیچ مدیر ارشد فعالی برای بازیابی و مدیریت سامانه وجود ندارد.'
        : 'فقط یک مدیر ارشد فعال وجود دارد؛ برای جلوگیری از قفل‌شدن مدیریت سامانه، یک مدیر ارشد پشتیبان تعیین کنید.',
      '/admin/users',
    ),
  ];

  return { ready: checks.every((item) => item.status !== 'BLOCKED'), checks };
}

function coverageGapDetail(count: number, subject: string, names: string[]): string {
  const visibleNames = names.slice(0, 8);
  const remainingCount = Math.max(0, count - visibleNames.length);
  const namesDetail = visibleNames.length > 0
    ? ` موارد: ${visibleNames.join('، ')}${remainingCount > 0 ? ` و ${remainingCount.toLocaleString('fa-IR')} مورد دیگر` : ''}.`
    : '';
  return `${count.toLocaleString('fa-IR')} ${subject} هنوز فروشنده واجد شرایط ندارد.${namesDetail}`;
}

function check(key: string, title: string, condition: boolean, readyDetail: string, blockedDetail: string, actionPath?: string): ReleaseReadinessCheck {
  return {
    key,
    title,
    status: condition ? 'READY' : key === 'environment.production' ? 'WARNING' : 'BLOCKED',
    detail: condition ? readyDetail : blockedDetail,
    ...(actionPath ? { actionPath } : {}),
  };
}
