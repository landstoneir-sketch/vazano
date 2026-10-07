import { ContentManager } from './content-manager';

export const metadata = { title: 'مدیریت محتوا' };

export default function AdminContentPage() {
  return <section className="container dashboard"><div className="eyebrow">CMS وازانو</div><h1>صفحات و پرسش‌های متداول</h1><p className="muted">متن‌های عمومی را بدون نیاز به تغییر کد ویرایش و منتشر کنید.</p><ContentManager /></section>;
}
