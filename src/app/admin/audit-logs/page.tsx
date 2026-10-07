import { AuditSecurityPanel } from './audit-security-panel';

export const metadata = { title: 'ممیزی و امنیت' };

export default function AdminAuditLogsPage() {
  return <section className="container dashboard">
    <div className="eyebrow">نظارت مدیریتی</div>
    <h1>لاگ ممیزی و رخدادهای امنیتی</h1>
    <p className="muted">عملیات حساس و هشدارهای ورود را بدون نمایش اطلاعات محرمانه بررسی کنید.</p>
    <AuditSecurityPanel />
  </section>;
}
