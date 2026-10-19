import { CatalogManager } from './catalog-manager';

export const metadata = { title: 'دسته‌بندی و ویژگی‌های محصول' };

export default function AdminCatalogPage() {
  return <section className="container dashboard"><div className="eyebrow">مدیریت وازانو</div><h1>دسته‌بندی‌ها و ویژگی‌های محصول</h1><p className="muted">ساختار فرم‌های استعلام را بدون تغییر کد برای سنگ و حوزه‌های آینده مدیریت کنید.</p><CatalogManager /></section>;
}
