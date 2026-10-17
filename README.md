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

فایل زیر را اجرا کنید. اگر Docker Desktop بسته باشد، فایل شروع آن را باز می‌کند، منتظر آماده‌شدن زیرساخت می‌ماند، نسخه وابستگی‌ها را با `package-lock.json` هماهنگ می‌کند و سپس Migrationها، داده اولیه، API و سایت را اجرا می‌کند. اگر سایت از قبل کامل فعال باشد، به‌جای اجرای تکراری همان صفحه باز می‌شود؛ اگر فقط یکی از سرویس‌ها باز مانده باشد، پیام روشن برای بستن پنجره قدیمی نمایش داده می‌شود:

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
- `/about`، `/terms` و `/privacy` — صفحات عمومی مدیریت‌شده از CMS
- `/dashboard/profile` — اطلاعات حساب کاربری
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
- `/admin/reports` — گزارش مدیریتی و شاخص‌های واقعی عملیات
- `/admin/contracts` — صف هماهنگی قراردادهای درخواستی

## پشتیبان‌گیری و آزمون بازیابی

برای تهیه نسخه پشتیبان فشرده از PostgreSQL محلی، دستور زیر را اجرا کنید. فایل Dump و SHA-256 آن داخل پوشه نادیده‌گرفته‌شده `backups` قرار می‌گیرند:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-database.ps1
```

سالم‌بودن نسخه پشتیبان با Restore در یک دیتابیس موقت و ایزوله بررسی می‌شود؛ دیتابیس اصلی تغییر نمی‌کند و دیتابیس آزمون پس از پایان حذف می‌شود:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-database-backup.ps1 -BackupPath .\backups\vazano-postgres-YYYYMMDD-HHMMSS.dump
```

## مرز شبکه در محیط انتشار

Image وب به‌صورت پیش‌فرض API را از مسیر هم‌دامنه `/v1` فراخوانی می‌کند؛ بنابراین آدرس داخلی یا `localhost` داخل مرورگر کاربر نهایی قرار نمی‌گیرد. نمونه تنظیم Reverse Proxy در `deploy/nginx.conf` مسیر `/v1` را به سرویس خصوصی `api:3001` و سایر مسیرها را به `web:3000` می‌فرستد. TLS باید در Load Balancer یا Reverse Proxy لبه فعال باشد و API مستقیماً روی اینترنت منتشر نشود.

برای انتشار نسخه‌دار، فایل `.env.production.example` را روی سرور به `.env.production` تبدیل و فقط با Secretهای واقعی محیط تکمیل کنید. Imageهای API، وب، Migration و Gateway باید با Tag یا Digest غیرقابل‌تغییر تعیین شوند. پیش از انتشار باید Backup گرفته و بازیابی آن با اسکریپت بالا آزموده شود؛ فایل رسید `.verified.json` به‌صورت خودکار کنار Backup ایجاد می‌شود. سپس اسکریپت انتشار با مسیر همان Backup اجرا می‌شود و پیش از Migration، Hash و تازگی رسید بازیابی را کنترل می‌کند:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-release.ps1 -VerifiedBackupPath .\backups\vazano-postgres-YYYYMMDD-HHMMSS.dump -PreviousEnvironmentFile .env.production.previous
```

اگر `PreviousEnvironmentFile` داده شود و Rollout یا Smoke Test نسخه جدید شکست بخورد، API، وب و Gateway نسخه سالم قبلی خودکار بازگردانده می‌شوند. در اولین انتشار که نسخه قبلی وجود ندارد این پارامتر را حذف کنید؛ در آن حالت Rollback خودکار برنامه در دسترس نیست.

برای بازگرداندن نسخه برنامه، فایل تنظیمات نسخه سالم قبلی را با نامی مانند `.env.production.previous` نگه دارید و دستور زیر را اجرا کنید. این فرایند فقط Imageهای قبلی API، وب و Gateway را فعال می‌کند، Migration معکوس اجرا نمی‌کند و پس از بازگشت کنترل سلامت و داده‌های مرجع را تکرار می‌کند:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\rollback-release.ps1 -PreviousEnvironmentFile .env.production.previous
```

بازگشت برنامه زمانی ایمن است که Migrationهای انتشار جدید با روش Expand–Migrate–Contract سازگار با نسخه قبلی طراحی شده باشند. برای بازگرداندن داده‌ها از Backup باید Runbook رخداد و تأیید مسئول فنی/داده جداگانه اجرا شود؛ اسکریپت بالا هرگز پایگاه‌داده را عقب نمی‌برد.

### انتشار اولیه قوانین پس از تأیید مالک و مشاور حقوقی

صفحات `terms` و `privacy` عمداً به‌صورت پیش‌نویس Seed می‌شوند و در Production تا زمان انتشار، ورود کاربران بسته می‌ماند. ابتدا Hash دقیق محتوای فعلی را بدون هیچ تغییری مشاهده کنید:

```powershell
docker compose --env-file .env.production -f compose.production.yml --profile operations run --rm -e LEGAL_PUBLICATION_MODE=inspect legal-publisher
```

پس از تطبیق دو Hash با نسخه‌ای که مالک و مشاور حقوقی تأیید کرده‌اند، انتشار یک‌باره و ثبت‌شده در Audit Log انجام می‌شود. مقادیر Hash زیر باید دقیقاً از خروجی تأییدشده مرحله قبل برداشته شوند:

```powershell
docker compose --env-file .env.production -f compose.production.yml --profile operations run --rm -e LEGAL_PUBLICATION_MODE=publish -e LEGAL_TERMS_APPROVED_SHA256=<TERMS_SHA256> -e LEGAL_PRIVACY_APPROVED_SHA256=<PRIVACY_SHA256> -e LEGAL_PUBLICATION_CONFIRMATION=PUBLISH_APPROVED_LEGAL_PAGES legal-publisher
```

این ابزار متن را تغییر نمی‌دهد و در صورت تفاوت حتی یک نویسه، تغییر هم‌زمان، نبود مدیر کل فعال یا نبود تأیید صریح متوقف می‌شود. انتشار محتوای حقوقی نباید بدون تأیید واقعی انجام شود.

## کنترل کیفیت

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

تست `test:e2e` مسیر حیاتی ورود، ثبت و انتشار استعلام، ثبت پیشنهاد و انتخاب فروشنده را با Chrome و داده موقت کنترل می‌کند؛ برای اجرای آن باید Docker Desktop و پایگاه‌داده توسعه فعال باشند. این تست پیامک واقعی ارسال نمی‌کند و داده موقت خود را پس از پایان پاک می‌کند.

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
