# وازانو — دستیار خرید و تأمین سنگ

رابط کاربری کامل پلتفرم وازانو؛ دستیار خرید و تأمین سنگ ساختمانی برای بازار ایران. این مخزن شامل رابط کاربری واقعی، واکنش‌گرا و قابل‌اجرا برای سه نقش خریدار، فروشنده/تولیدکننده و مدیر سیستم است.

## پشته فنی

Next.js 16 (App Router) · TypeScript (Strict) · Tailwind CSS v4 · React Hook Form + Zod · Zustand · Vitest · Playwright

## شروع سریع

```bash
npm install
npm run dev
```

سپس `http://localhost:3000` را باز کنید.

حساب‌های نمایشی: از `/login` با هر شماره موبایل معتبر ایران (مثلاً `09121234567`) و کد تأیید نمایشی `۱۲۳۴` وارد شوید. برای ورود مستقیم به هرکدام از پنل‌ها می‌توانید بدون ورود هم مسیرهای `/buyer/dashboard`، `/seller/dashboard` یا `/admin/dashboard` را باز کنید (داده‌های نمایشی به‌صورت پیش‌فرض بارگذاری می‌شوند).

## ساختار پروژه

```text
src/
  app/                  صفحات (App Router) به تفکیک نقش: (public)، (auth)، buyer، seller، admin
  components/
    ui/                 Design System — کامپوننت‌های پایه مستقل از دامنه
    features/           کامپوننت‌های وابسته به دامنه کسب‌وکار (Wizard استعلام، مقایسه، ...)
    layout/             پوسته صفحات (Header/Footer عمومی، AppShell پنل‌ها)
  lib/                  types، mock-data، utils، navigation config
  store/                وضعیت سبک با Zustand (احراز هویت)
docs/                   مستندات معماری، جریان‌ها، سیستم طراحی و استقرار
tests/
  unit/                 آزمون‌های واحد (Vitest)
  e2e/                  آزمون‌های سرتاسری (Playwright)
```

## اسکریپت‌ها

| دستور | توضیح |
|---|---|
| `npm run dev` | اجرای محیط توسعه |
| `npm run build` | Build عملیاتی |
| `npm run start` | اجرای نسخه Build‌شده |
| `npm run lint` | بررسی ESLint |
| `npm run test` | آزمون‌های واحد |
| `npm run test:e2e` | آزمون‌های سرتاسری (نیازمند `npx playwright install`) |

## مستندات

- [`docs/ui-ux-implementation-plan.md`](docs/ui-ux-implementation-plan.md) — منابع، الزامات و برنامه اجرا
- [`docs/information-architecture.md`](docs/information-architecture.md) — نقشه کامل صفحات
- [`docs/user-flows.md`](docs/user-flows.md) — جریان‌های اصلی UX
- [`docs/design-system.md`](docs/design-system.md) — سیستم طراحی
- [`docs/deployment-guide.md`](docs/deployment-guide.md) — راهنمای Build و استقرار
- [`docs/implementation-report.md`](docs/implementation-report.md) — گزارش کارهای انجام‌شده
- [`docs/pending-backend-integrations.md`](docs/pending-backend-integrations.md) — کارهای باقی‌مانده وابسته به Backend

## وضعیت داده‌ها

تمام داده‌های نمایش‌داده‌شده (استعلام‌ها، پیشنهادها، سفارش‌ها، کاربران) **آزمایشی** هستند و در `src/lib/mock-data.ts` تعریف شده‌اند؛ هیچ‌کدام اطلاعات واقعی نیستند.
