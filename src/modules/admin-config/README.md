# Admin configuration module

This module exposes audited, permission-protected editing for business settings and notification templates.

- System settings require `settings.manage` and must be explicitly marked editable.
- Notification templates require `settings.manage` or `content.manage`.
- Optimistic version checks prevent silent overwrites when two administrators edit concurrently.
- Template action links are restricted to internal Vazano paths.
- `GET /v1/admin/config/release-readiness` وضعیت عملیاتی انتشار را بدون بازگرداندن مقدار Secretها گزارش می‌کند؛ تنظیمات Providerها فقط به‌صورت آماده/ناقص نمایش داده می‌شوند.
