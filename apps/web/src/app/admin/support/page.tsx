import Link from 'next/link';
import type { Route } from 'next';
import { SupportQueue } from './support-queue';

export const metadata = { title: 'صف پشتیبانی' };

export default function AdminSupportPage() {
  return <section className="container dashboard"><div className="eyebrow">مدیریت عملیات</div><div className="admin-card-title"><div><h1>صف پشتیبانی و گزارش‌های تخلف</h1><p className="muted">اولویت، وضعیت، نتیجه و پاسخ قابل‌مشاهده کاربر یا یادداشت داخلی را مدیریت کنید.</p></div><Link className="button button-secondary" href={'/admin/reviews' as Route}>مدیریت امتیاز فروشندگان</Link></div><SupportQueue /></section>;
}
