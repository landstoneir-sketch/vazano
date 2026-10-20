import Link from 'next/link';

const sampleRfqs = [
  {
    code: 'نمونه ۰۱', status: 'در حال دریافت پیشنهاد', tone: 'receiving', progress: 2,
    title: 'تراورتن عباس‌آباد برای نمای مجتمع مسکونی',
    product: '۴۰ طولی · ضخامت ۲ سانتی‌متر · سابیده · کرم روشن کم‌موج',
    quantity: '۱٬۸۵۰ مترمربع', destination: 'تهران، منطقه ۴', delivery: 'تحویل طی ۲۵ روز',
    invited: '۱۲ تأمین‌کننده مرتبط', responses: '۴ پیشنهاد ثبت‌شده',
    responseLines: ['۳ پیشنهاد مطابق مشخصات اصلی', '۱ پیشنهاد جایگزین با تراورتن آتشکوه', 'اختلاف قیمت هم‌شرط‌ها: حدود ۹٪'],
    buyerAction: '۲ روز تا پایان مهلت؛ سپس مقایسه پیشنهادها',
  },
  {
    code: 'نمونه ۰۲', status: 'نیازمند پاسخ فروشنده', tone: 'waiting', progress: 2,
    title: 'گرانیت نهبندان فلیم برای محوطه مجتمع تجاری',
    product: '۴۰×۴۰ · ضخامت ۳ سانتی‌متر · فلیم · طوسی روشن',
    quantity: '۳٬۲۰۰ مترمربع', destination: 'مشهد', delivery: 'تحویل مرحله‌ای در ۳ محموله',
    invited: '۸ کارخانه واجد شرایط', responses: '۲ پاسخ و ۱ پیش‌نویس',
    responseLines: ['یک پیشنهاد تحویل درب پروژه', 'یک پیشنهاد تحویل درب کارخانه', 'هزینه بارگیری و حمل باید جدا مقایسه شود'],
    buyerAction: 'فروشندگان تا فردا برای تکمیل پیشنهاد فرصت دارند',
  },
  {
    code: 'نمونه ۰۳', status: 'در حال مقایسه', tone: 'comparing', progress: 3,
    title: 'اسلب چینی ازنا برای لابی هتل',
    product: 'اسلب · ضخامت ۲ سانتی‌متر · صیقلی · زمینه سفید با رگه کنترل‌شده',
    quantity: '۴۲۰ مترمربع', destination: 'جزیره کیش', delivery: 'نمونه و چیدمان اولیه الزامی',
    invited: '۶ تأمین‌کننده تخصصی اسلب', responses: '۳ پیشنهاد قابل مقایسه',
    responseLines: ['پیشنهاد اول: آماده‌سازی ۱۲ روزه', 'پیشنهاد دوم: ۶٪ بالاتر با مهلت پرداخت بیشتر', 'پیشنهاد سوم: کنترل کیفیت و بسته‌بندی ویژه'],
    buyerAction: 'انتخاب پیشنهاد و درخواست کنترل کیفیت ۳٪',
  },
  {
    code: 'نمونه ۰۴', status: 'در انتظار رفع ابهام', tone: 'clarification', progress: 1,
    title: 'مرمریت لاشتر برای پله و پاگرد ساختمان اداری',
    product: 'پله ۳ سانتی‌متر · پرداخت هوند · پیشانی و قرنیز هماهنگ',
    quantity: '۶۸۰ عدد پله', destination: 'شیراز', delivery: 'همراه با نصب',
    invited: '۵ سنگبری و مجری نصب', responses: '۲ پرسش فنی دریافت‌شده',
    responseLines: ['ابعاد دقیق شمشیری راه‌پله هنوز پیوست نشده', 'نوع لبه و ابزار پله باید تأیید شود', 'مهلت پاسخ پس از رفع ابهام تمدید می‌شود'],
    buyerAction: 'خریدار باید نقشه پله و نوع ابزار را تکمیل کند',
  },
  {
    code: 'نمونه ۰۵', status: 'فروشنده منتخب', tone: 'selected', progress: 4,
    title: 'سنگ مرمر سبز برای دیوار شاخص ویلای مسکونی',
    product: 'اسلب بوک‌مچ · ضخامت ۲ سانتی‌متر · صیقلی',
    quantity: '۱۲۰ مترمربع', destination: 'رامسر', delivery: 'بازدید و تأیید چیدمان پیش از برش',
    invited: '۷ تأمین‌کننده سنگ لوکس', responses: '۵ پیشنهاد دریافت‌شده',
    responseLines: ['فروشنده بر اساس کیفیت نمونه و زمان تحویل انتخاب شد', 'کمترین قیمت، پیشنهاد منتخب نبود', 'درخواست قرارداد و کنترل کیفیت ثبت شده است'],
    buyerAction: 'در انتظار هماهنگی بازدید و تأیید نمونه',
  },
  {
    code: 'نمونه ۰۶', status: 'تکمیل‌شده', tone: 'completed', progress: 4,
    title: 'بازالت کوبیک برای محوطه‌سازی مجموعه گردشگری',
    product: 'کوبیک ۱۰×۱۰×۵ · سطح گیوتین · رنگ خاکستری تیره',
    quantity: '۹۵۰ مترمربع', destination: 'تبریز', delivery: 'تحویل درب پروژه؛ نصب نیاز نیست',
    invited: '۹ تأمین‌کننده منطقه‌ای', responses: '۴ پیشنهاد و یک انتخاب نهایی',
    responseLines: ['پیشنهاد منتخب ۱۱٪ پایین‌تر از گران‌ترین پیشنهاد هم‌شرط بود', 'تحویل در دو مرحله انجام شد', 'خریدار ارزیابی تعامل را ثبت کرده است'],
    buyerAction: 'سوابق، پیام‌ها و پیشنهادها در حساب محفوظ است',
  },
] as const;

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

      <section className="sample-market-section" aria-labelledby="sample-market-title">
        <div className="container">
          <div className="section-heading sample-market-heading">
            <div><span className="eyebrow">نمای عملی فرایند وازانو</span><h2 id="sample-market-title">استعلام‌های نمونه؛ از ثبت نیاز تا انتخاب فروشنده</h2></div>
            <p>این اطلاعات ساختگی اما نزدیک به سناریوهای واقعی بازار سنگ هستند. قیمت روز یا پیشنهاد تجاری محسوب نمی‌شوند.</p>
          </div>

          <ol className="sample-process" aria-label="مراحل پاسخ به استعلام">
            <li><b>۱</b><span><strong>ثبت نیاز</strong><small>مشخصات، مقدار و مقصد</small></span></li>
            <li><b>۲</b><span><strong>دریافت پاسخ</strong><small>تأمین‌کنندگان مرتبط</small></span></li>
            <li><b>۳</b><span><strong>مقایسه</strong><small>قیمت و شرایط هم‌سطح</small></span></li>
            <li><b>۴</b><span><strong>انتخاب</strong><small>ثبت نتیجه و خدمات تکمیلی</small></span></li>
          </ol>

          <div className="sample-rfq-grid">
            {sampleRfqs.map((rfq) => <article className="sample-rfq-card" key={rfq.code}>
              <header><span className="sample-code">{rfq.code}</span><span className={`sample-status sample-status-${rfq.tone}`}>{rfq.status}</span></header>
              <h3>{rfq.title}</h3>
              <p className="sample-product">{rfq.product}</p>
              <dl className="sample-rfq-facts">
                <div><dt>مقدار</dt><dd>{rfq.quantity}</dd></div>
                <div><dt>مقصد</dt><dd>{rfq.destination}</dd></div>
                <div><dt>شرایط تحویل</dt><dd>{rfq.delivery}</dd></div>
              </dl>
              <div className={`sample-progress sample-progress-${rfq.progress}`} aria-label={`مرحله ${rfq.progress.toLocaleString('fa-IR')} از ۴`}><span /></div>
              <div className="sample-response-summary"><div><span>توزیع</span><strong>{rfq.invited}</strong></div><div><span>پاسخ‌ها</span><strong>{rfq.responses}</strong></div></div>
              <details className="sample-response-details">
                <summary>جزئیات وضعیت پاسخ‌ها</summary>
                <ul>{rfq.responseLines.map((line) => <li key={line}>{line}</li>)}</ul>
              </details>
              <p className="sample-next-action"><b>اقدام بعدی:</b> {rfq.buyerAction}</p>
            </article>)}
          </div>

          <div className="sample-role-guide">
            <div><span className="eyebrow">تجربه خریدار</span><h3>پیشنهادهای هم‌شرط را کنار هم ببینید</h3><p>مبلغ نهایی، زمان آماده‌سازی، حمل، مالیات، شرایط پرداخت و پیشنهاد جایگزین جدا نمایش داده می‌شوند.</p><Link className="button button-primary" href="/login">ثبت استعلام رایگان</Link></div>
            <div><span className="eyebrow">تجربه فروشنده</span><h3>فقط به فرصت‌های مرتبط پاسخ دهید</h3><p>مشخصات فنی و مهلت را بررسی کنید، قیمت را به تفکیک بنویسید و در صورت نیاز محصول جایگزین پیشنهاد دهید.</p><Link className="button button-secondary" href="/plans">آشنایی با حساب فروشنده</Link></div>
          </div>
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
