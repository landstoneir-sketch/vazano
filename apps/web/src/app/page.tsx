import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <section className="container hero">
        <div>
          <div className="eyebrow">بازار تخصصی استعلام قیمت مصالح</div>
          <h1>استعلام هوشمند، انتخاب مطمئن</h1>
          <p>درخواست خرید خود را یک‌بار ثبت کنید، پیشنهاد تأمین‌کنندگان واجد شرایط را شفاف مقایسه کنید و با اطمینان تصمیم بگیرید.</p>
          <div className="actions">
            <Link className="button button-primary" href="/login">ثبت استعلام</Link>
            <Link className="button button-secondary" href="/how-it-works">نحوه کار وازانو</Link>
          </div>
        </div>
        <aside className="trust-card" aria-label="مزیت وازانو">
          <span className="muted">شروع تخصصی با</span>
          <strong>سنگ ساختمانی</strong>
          <p>پوشش سراسر ایران، فرم‌های فنی پویا، فروشندگان ارزیابی‌شده و مقایسه استاندارد پیشنهادها.</p>
        </aside>
      </section>
      <section className="container feature-grid" aria-label="مزایای وازانو">
        <article className="card"><h2>درخواست دقیق</h2><p>مشخصات، مقدار، ابعاد، فایل‌ها و شرایط خرید را ساختاریافته ثبت کنید.</p></article>
        <article className="card"><h2>توزیع هدفمند</h2><p>استعلام فقط برای تأمین‌کنندگان متناسب با محصول و محدوده فعالیت ارسال می‌شود.</p></article>
        <article className="card"><h2>مقایسه شفاف</h2><p>قیمت، زمان تحویل، شرایط پرداخت و جزئیات پیشنهادها را کنار هم ببینید.</p></article>
      </section>
    </>
  );
}
