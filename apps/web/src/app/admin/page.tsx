import { AdminOverview } from './admin-overview';

export const metadata = { title: 'مرکز مدیریت' };

export default function AdminPage() {
  return <section className="container dashboard">
    <div className="eyebrow">کنترل عملیات وازانو</div>
    <h1>مرکز مدیریت</h1>
    <p className="muted">وضعیت انتشار و تمام بخش‌هایی که براساس نقش شما قابل مدیریت‌اند، از این صفحه در دسترس هستند.</p>
    <AdminOverview />
  </section>;
}
