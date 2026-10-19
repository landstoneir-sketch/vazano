import { LocationManager } from './location-manager';

export const metadata = { title: 'مدیریت استان‌ها و شهرها' };

export default function AdminLocationsPage() {
  return <section className="container dashboard"><div className="eyebrow">داده‌های مرجع وازانو</div><h1>استان‌ها و شهرها</h1><p className="muted">مقاصد قابل‌انتخاب در استعلام‌ها را بدون تغییر کد مدیریت کنید. رکوردهای استفاده‌شده حذف نمی‌شوند و فقط غیرفعال خواهند شد.</p><LocationManager /></section>;
}
