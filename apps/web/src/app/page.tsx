import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <section className="hero-shell">
        <div className="hero-glow" aria-hidden="true" />
        <div className="container hero">
          <div className="hero-content">
            <div className="eyebrow"><span aria-hidden="true">◆</span> بازار تخصصی استعلام مصالح ساختمانی</div>
            <h1>خرید سنگ را از یک <span>استعلام دقیق</span> شروع کنید</h1>
            <p className="hero-lead">نیاز پروژه را یک‌بار ثبت کنید؛ پیشنهاد تولیدکنندگان و فروشندگان واجد شرایط را در یک ساختار شفاف مقایسه کنید و مطمئن‌تر تصمیم بگیرید.</p>
            <div className="actions">
              <Link className="button button-primary" href="/login">ثبت استعلام رایگان <span aria-hidden="true">←</span></Link>
              <Link className="button button-secondary" href="/how-it-works">ببینید چگونه کار می‌کند</Link>
            </div>
            <ul className="trust-points" aria-label="ویژگی‌های اصلی وازانو">
              <li><span aria-hidden="true">✓</span> پوشش سراسر ایران</li>
              <li><span aria-hidden="true">✓</span> رایگان برای خریدار</li>
              <li><span aria-hidden="true">✓</span> مقایسه استاندارد پیشنهادها</li>
            </ul>
          </div>
          <aside className="trust-card" aria-label="مسیر استعلام در وازانو">
            <div className="trust-card-heading">
              <span className="stone-symbol" aria-hidden="true"><i /><i /><i /></span>
              <div><span className="muted">مسیر یک خرید مطمئن</span><strong>از نیاز تا انتخاب</strong></div>
            </div>
            <ol className="journey-list">
              <li><b>۱</b><div><strong>مشخصات پروژه</strong><span>نوع سنگ، مقدار، ابعاد و زمان تحویل</span></div></li>
              <li><b>۲</b><div><strong>پیشنهادهای مرتبط</strong><span>دریافت قیمت از تأمین‌کنندگان واجد شرایط</span></div></li>
              <li><b>۳</b><div><strong>مقایسه و انتخاب</strong><span>قیمت، تحویل و شرایط پرداخت در یک نگاه</span></div></li>
            </ol>
            <div className="trust-note"><span aria-hidden="true">●</span> اطلاعات تماس و پروژه تحت کنترل شماست.</div>
          </aside>
        </div>
      </section>

      <section className="stone-coverage" aria-label="گروه‌های سنگ تحت پوشش">
        <div className="container coverage-content">
          <strong>پوشش تخصصی سنگ طبیعی</strong>
          <ul><li>تراورتن</li><li>مرمریت</li><li>گرانیت</li><li>چینی و کریستال</li><li>مرمر</li><li>بازالت و آندزیت</li></ul>
        </div>
      </section>

      <section className="container benefits-section" aria-labelledby="benefits-title">
        <div className="section-heading">
          <div><span className="eyebrow">شفافیت در فرایند خرید</span><h2 id="benefits-title">کمتر پیگیری کنید، دقیق‌تر انتخاب کنید</h2></div>
          <p>وازانو گفت‌وگوهای پراکنده و قیمت‌های غیرقابل‌مقایسه را به یک فرایند روشن و قابل پیگیری تبدیل می‌کند.</p>
        </div>
        <div className="feature-grid" aria-label="مزایای وازانو">
          <article className="card feature-card"><span className="feature-number">۰۱</span><h3>درخواست ساختاریافته</h3><p>مشخصات فنی، مقدار، ابعاد، فایل‌ها و شرایط خرید را دقیق و یکجا ثبت کنید.</p></article>
          <article className="card feature-card"><span className="feature-number">۰۲</span><h3>توزیع هدفمند</h3><p>استعلام برای تأمین‌کنندگانی ارسال می‌شود که با محصول و محدوده پروژه تناسب دارند.</p></article>
          <article className="card feature-card"><span className="feature-number">۰۳</span><h3>مقایسه قابل اتکا</h3><p>قیمت، زمان تحویل، مالیات، شرایط پرداخت و جزئیات پیشنهادها را کنار هم ببینید.</p></article>
        </div>
      </section>

      <section className="container buyer-supplier-callout">
        <div><span className="eyebrow">برای خریداران</span><h2>استعلام بعدی پروژه را حرفه‌ای مدیریت کنید</h2><p>ثبت درخواست برای خریدار رایگان است و سوابق پروژه و پیشنهادها همیشه در حساب شما باقی می‌ماند.</p><Link className="text-link" href="/login">شروع ثبت استعلام <span aria-hidden="true">←</span></Link></div>
        <div><span className="eyebrow">برای تأمین‌کنندگان</span><h2>به درخواست‌های متناسب با توان خود پاسخ دهید</h2><p>پروفایل تخصصی بسازید، دسته‌های قابل تأمین را مشخص کنید و پیشنهادهای فروش را منظم پیگیری کنید.</p><Link className="text-link" href="/plans">مشاهده پلن‌های فروشندگان <span aria-hidden="true">←</span></Link></div>
      </section>
    </>
  );
}
