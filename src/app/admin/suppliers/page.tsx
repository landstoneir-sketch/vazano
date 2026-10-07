import { SupplierVerificationQueue } from './supplier-verification-queue';

export const metadata = { title: 'بررسی فروشندگان' };

export default function AdminSuppliersPage() {
  return <section className="container dashboard"><div className="eyebrow">اعتماد و احراز هویت</div><h1>صف بررسی فروشندگان</h1><p className="muted">پروفایل، دسته‌های قابل تأمین و محدوده فعالیت را پیش از فعال‌سازی بررسی کنید.</p><SupplierVerificationQueue /></section>;
}
