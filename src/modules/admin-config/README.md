# Admin configuration module

This module exposes audited, permission-protected editing for business settings and notification templates.

- System settings require `settings.manage` and must be explicitly marked editable.
- Notification templates require `settings.manage` or `content.manage`.
- Optimistic version checks prevent silent overwrites when two administrators edit concurrently.
- Template action links are restricted to internal Vazano paths.
- `GET /v1/admin/config/release-readiness` وضعیت عملیاتی انتشار را بدون بازگرداندن مقدار Secretها گزارش می‌کند؛ علاوه بر امنیت و Providerها، وجود داده مرجع، پوشش معتبر بازار، خریدار پایلوت و فروشنده واجد شرایط را نیز به‌عنوان دروازه انتشار کنترل می‌کند. آمادگی ۹ قالب تمدید SMS.ir جدا از کلید فعال‌سازی ارسال واقعی نمایش داده می‌شود تا مالک بداند کدام بخش آماده و کدام بخش عمداً خاموش است.
- همان کنترل آمادگی، وجود هر `NotificationDispatch` ناموفق را مانع فنی پایلوت و انتشار می‌داند تا خرابی قالب یا Worker پیش از ورود کاربر واقعی آشکار شود.
