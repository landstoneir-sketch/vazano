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
  termsPublished: boolean;
  privacyPublished: boolean;
  paidPlanCount: number;
  activeCategoryCount: number;
  activeProvinceCount: number;
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
    check('content.terms', 'قوانین و شرایط استفاده', input.termsPublished, 'صفحه قوانین منتشر شده است.', 'صفحه قوانین هنوز پیش‌نویس است و باید پس از تأیید مالک/حقوقی منتشر شود.', '/admin/content'),
    check('content.privacy', 'سیاست حریم خصوصی', input.privacyPublished, 'صفحه حریم خصوصی منتشر شده است.', 'صفحه حریم خصوصی هنوز پیش‌نویس است و باید پس از تأیید مالک/حقوقی منتشر شود.', '/admin/content'),
    check('billing.plan', 'پلن پولی قابل خرید', input.paidPlanCount > 0, `${input.paidPlanCount.toLocaleString('fa-IR')} پلن پولی فعال و عمومی وجود دارد.`, 'هیچ پلن پولی فعال و عمومی برای خرید وجود ندارد.', '/admin/billing'),
    check('catalog.categories', 'دسته‌بندی قابل استفاده', input.activeCategoryCount > 0, `${input.activeCategoryCount.toLocaleString('fa-IR')} دسته فعال وجود دارد.`, 'دسته‌بندی فعالی برای ثبت استعلام وجود ندارد.', '/admin/catalog'),
    check('locations.provinces', 'پوشش استان‌های ایران', input.activeProvinceCount >= 31, `${input.activeProvinceCount.toLocaleString('fa-IR')} استان فعال ثبت شده است.`, `فقط ${input.activeProvinceCount.toLocaleString('fa-IR')} استان فعال ثبت شده است.`, '/admin/locations'),
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

function check(key: string, title: string, condition: boolean, readyDetail: string, blockedDetail: string, actionPath?: string): ReleaseReadinessCheck {
  return {
    key,
    title,
    status: condition ? 'READY' : key === 'environment.production' ? 'WARNING' : 'BLOCKED',
    detail: condition ? readyDetail : blockedDetail,
    ...(actionPath ? { actionPath } : {}),
  };
}
