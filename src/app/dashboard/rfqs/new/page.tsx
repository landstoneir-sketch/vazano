import { NewRfqForm } from './rfq-form';

export const metadata = { title: 'ثبت استعلام جدید' };

export default async function NewRfqPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  return <section className="container dashboard rfq-page">
    <header className="dashboard-page-heading">
      <div><div className="eyebrow">استعلام قیمت</div><h1>{edit ? 'ویرایش پیش‌نویس استعلام' : 'ثبت استعلام جدید'}</h1><p className="muted">نیاز پروژه را مرحله‌به‌مرحله وارد کنید. ذخیره این فرم فقط یک پیش‌نویس می‌سازد و تا تأیید شما برای فروشندگان ارسال نمی‌شود.</p></div>
      <aside><strong>نمایش قیمت بدون مالیات</strong><span>تمام استعلام‌های پایلوت پیش از انتشار توسط وازانو بازبینی می‌شوند.</span></aside>
    </header>
    <ol className="rfq-completion-guide" aria-label="مراحل تکمیل استعلام">
      <li><b>۱</b><span>پروژه</span></li><li><b>۲</b><span>محصولات</span></li><li><b>۳</b><span>مشخصات فنی</span></li><li><b>۴</b><span>تحویل</span></li><li><b>۵</b><span>خدمات</span></li>
    </ol>
    <NewRfqForm draftId={edit} />
  </section>;
}
