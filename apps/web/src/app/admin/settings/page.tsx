import { AdminSettings } from './admin-settings';

export const metadata = { title: 'تنظیمات کسب‌وکار' };

export default function AdminSettingsPage() {
  return (
    <section className="container dashboard">
      <div className="eyebrow">مدیریت وازانو</div>
      <h1>تنظیمات کسب‌وکار و پیام‌ها</h1>
      <p className="muted">مقادیر قابل‌ویرایش و متن اعلان‌ها را بدون تغییر کد مدیریت کنید. همه تغییرات در Audit Log ثبت می‌شوند.</p>
      <AdminSettings />
    </section>
  );
}
