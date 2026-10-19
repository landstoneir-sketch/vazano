import { NewRfqForm } from './rfq-form';

export const metadata = { title: 'ثبت استعلام جدید' };

export default async function NewRfqPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  return <section className="container dashboard rfq-page">
    <header className="dashboard-page-heading">
      <div><div className="eyebrow">استعلام قیمت</div><h1>{edit ? 'ویرایش پیش‌نویس استعلام' : 'ثبت استعلام جدید'}</h1><p className="muted">در پنج مرحله کوتاه، نیاز خریدتان را ثبت کنید. اطلاعات شما تا تأیید نهایی برای هیچ فروشنده‌ای ارسال نمی‌شود.</p></div>
      <aside><strong>قیمت‌های قابل مقایسه</strong><span>قیمت‌ها بدون مالیات نمایش داده می‌شوند و استعلام‌های پایلوت پیش از انتشار بازبینی خواهند شد.</span></aside>
    </header>
    <NewRfqForm draftId={edit} />
  </section>;
}
