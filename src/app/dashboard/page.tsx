import Link from 'next/link';
import type { Route } from 'next';

export const metadata = { title: 'داشبورد' };

const managementLinks: Array<{ href: Route; label: string }> = [
  { href: '/admin/rfqs', label: 'صف استعلام‌ها' },
  { href: '/admin/suppliers', label: 'بررسی فروشندگان' },
  { href: '/admin/support', label: 'صف پشتیبانی' },
  { href: '/admin/catalog', label: 'دسته‌بندی و ویژگی‌ها' },
  { href: '/admin/locations', label: 'استان‌ها و شهرها' },
  { href: '/admin/quality-control', label: 'عملیات کنترل کیفیت' },
  { href: '/admin/contracts' as Route, label: 'درخواست‌های قرارداد' },
  { href: '/admin/billing', label: 'اشتراک‌ها و پرداخت‌ها' },
  { href: '/admin/settings', label: 'تنظیمات کسب‌وکار' },
  { href: '/admin/content', label: 'مدیریت محتوا' },
  { href: '/admin/users', label: 'مدیریت کاربران' },
  { href: '/admin/audit-logs', label: 'ممیزی و امنیت' },
];

export default function DashboardPage() {
  return <section className="container dashboard">
    <div className="eyebrow">نسخه MVP</div>
    <h1>داشبورد وازانو</h1>
    <p className="muted">ثبت استعلام، توزیع قاعده‌محور، پیشنهاد فروشنده و مقایسه قیمت به هسته عملیاتی متصل است.</p>
    <div className="dashboard-grid">
      <article className="card"><h2>استعلام‌های من</h2><strong>قابل پیگیری</strong></article>
      <article className="card"><h2>پوشش بازار</h2><strong>کل ایران</strong></article>
      <article className="card"><h2>نمایش قیمت</h2><strong>بدون مالیات</strong></article>
    </div>
    <div className="actions">
      <Link className="button button-primary" href="/dashboard/rfqs/new">ثبت استعلام جدید</Link>
      <Link className="button button-secondary" href="/dashboard/rfqs">استعلام‌های من</Link>
      <Link className="button button-secondary" href="/supplier">فرصت‌های فروش</Link>
      <Link className="button button-secondary" href="/messages">مرکز پیام</Link>
      <Link className="button button-secondary" href="/support">پشتیبانی و تخلفات</Link>
      <Link className="button button-secondary" href="/dashboard/organization">حساب‌های سازمانی</Link>
      {managementLinks.map((item) => <Link className="button button-secondary" href={item.href} key={item.href}>{item.label}</Link>)}
    </div>
  </section>;
}
