# وازانو — پلتفرم استعلام قیمت و مدیریت درخواست خرید

وازانو یک RFQ Marketplace چندسازمانی برای خریداران و تأمین‌کنندگان مصالح ساختمانی است. بازار نخست، سنگ ساختمانی ایران است؛ دسته‌بندی و ویژگی‌ها به‌صورت داده‌محور طراحی شده‌اند تا حوزه‌های دیگر بدون بازنویسی هسته اضافه شوند.

## وضعیت فعلی

نسخه جاری یک پایه عملیاتی MVP است و داده‌های آن در PostgreSQL ذخیره می‌شوند. احراز هویت OTP، سازمان‌ها و نقش‌ها، فروشندگان، استعلام، توزیع، پیشنهاد قیمت، مقایسه، اشتراک، پرداخت زرین‌پال، اعلان، پیام، فایل، پشتیبانی، ممیزی امنیتی و CMS به Backend واقعی متصل هستند.

## فناوری‌ها

- Frontend: Next.js، React، TypeScript و Tailwind CSS
- Backend: NestJS با معماری Modular Monolith
- Database: PostgreSQL و Prisma ORM
- Infrastructure: Docker Compose، Redis و MinIO سازگار با S3
- Integration: Adapter برای SMS.ir، زرین‌پال و ذخیره‌سازی فایل

## اجرای ساده در ویندوز

فایل زیر را اجرا کنید. اگر Docker Desktop بسته باشد، فایل شروع آن را باز می‌کند، منتظر آماده‌شدن زیرساخت می‌ماند و سپس Migrationها، داده اولیه، API و سایت را اجرا می‌کند:

```text
START_VAZANO.bat
```

پس از آماده‌شدن سرویس‌ها، سایت در `http://localhost:3000` و API در `http://localhost:3001/v1` در دسترس است.

## اجرای دستی

```bash
docker compose up -d
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run dev
```

ورود از مسیر `/login` با شماره موبایل معتبر انجام می‌شود. در محیط متصل به SMS.ir، کد واقعی پیامک‌شده را وارد کنید. هیچ کد ثابت عمومی برای ورود وجود ندارد. حالت Debug فقط با تنظیم صریح متغیرهای محیطی توسعه فعال می‌شود.

## مسیرهای مهم

- `/dashboard` — داشبورد
- `/dashboard/rfqs/new` — ثبت استعلام
- `/dashboard/organization` — سازمان‌ها و اعضا
- `/supplier` — فرصت‌های فروشنده
- `/messages` — مرکز پیام
- `/plans` — پلن‌ها و اشتراک
- `/admin/rfqs` — صف بررسی استعلام‌ها
- `/admin/suppliers` — احراز فروشندگان
- `/admin/content` — مدیریت صفحات و FAQ
- `/admin/users` — مدیریت کاربران و نشست‌ها
- `/admin/audit-logs` — ممیزی و رخدادهای امنیتی

## کنترل کیفیت

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Migrationها نسخه‌بندی شده‌اند و اطلاعات اولیه محیط توسعه با `npm run prisma:seed` ثبت می‌شود.

## امنیت تنظیمات

- مقادیر واقعی فقط در `.env` محلی قرار می‌گیرند.
- `.env.example` صرفاً نام تنظیمات و مقادیر غیرمحرمانه نمونه را نگه می‌دارد.
- API Key، Merchant ID، Token و رمز واقعی نباید Commit شوند.
- دسترسی سازمانی و مدیریتی همیشه در Backend بررسی می‌شود.

## ساختار مخزن

```text
apps/
  api/       NestJS modules, Prisma schema and migrations
  web/       Next.js App Router UI
packages/    shared packages
```

شاخه توسعه فعلی: `rebuild/mvp-foundation`
