import { SupportQueue } from './support-queue';

export const metadata = { title: 'صف پشتیبانی' };

export default function AdminSupportPage() {
  return <section className="container dashboard"><div className="eyebrow">مدیریت عملیات</div><h1>صف پشتیبانی و گزارش‌های تخلف</h1><p className="muted">اولویت، وضعیت، نتیجه و پاسخ قابل‌مشاهده کاربر یا یادداشت داخلی را مدیریت کنید.</p><SupportQueue /></section>;
}
