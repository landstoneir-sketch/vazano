import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { HomeRfqSlider } from './home-rfq-slider';
import styles from './home.module.css';

export const metadata: Metadata = {
  title: 'بازار هوشمند استعلام مصالح ساختمانی',
  description: 'درخواست خرید مصالح را دقیق ثبت کنید و پیشنهاد تأمین‌کنندگان مرتبط را در یک مسیر روشن مقایسه کنید.',
};

const categories = [
  { name: 'سنگ طبیعی', description: 'تراورتن، مرمریت، گرانیت، چینی، مرمر و خانواده‌های تخصصی سنگ', position: '0% 0%', active: true },
  { name: 'سیمان و بتن', description: 'سیمان، بتن آماده، قطعات پیش‌ساخته و افزودنی‌های مرتبط', position: '33.333% 0%', active: false },
  { name: 'آجر و بلوک', description: 'آجر نما، سفال، بلوک سیمانی و مصالح بنایی پروژه', position: '66.666% 0%', active: false },
  { name: 'کاشی و سرامیک', description: 'محصولات کف و دیوار، پرسلان و ملزومات نصب', position: '100% 0%', active: false },
  { name: 'آهن و فولاد', description: 'میلگرد، تیرآهن، ورق، پروفیل و مقاطع سازه‌ای', position: '0% 100%', active: false },
  { name: 'چوب و صفحات', description: 'چوب ساختمانی، صفحات مهندسی‌شده و فرآورده‌های چوبی', position: '33.333% 100%', active: false },
  { name: 'عایق و شیمی ساختمان', description: 'عایق حرارتی و رطوبتی، چسب، ملات و مواد تکمیلی', position: '66.666% 100%', active: false },
  { name: 'لوله و تأسیسات', description: 'لوله، اتصالات، کانال و تجهیزات پایه تأسیساتی', position: '100% 100%', active: false },
] as const;

const faqs = [
  'آیا ثبت درخواست خرید هزینه دارد؟',
  'در حال حاضر کدام دسته مصالح فعال است؟',
  'درخواست من برای چه تأمین‌کنندگانی ارسال می‌شود؟',
  'اطلاعات پیش‌نویس هنگام ورود حفظ می‌شود؟',
  'فروشنده چگونه به فرصت‌ها دسترسی پیدا می‌کند؟',
] as const;

export default function HomePage() {
  return (
    <div className={styles.homePage}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={`${styles.glass} ${styles.videoShell}`} aria-label="پیش‌نمایش ویدئوی معرفی وازانو">
              <div className={styles.videoFrame}>
                <Image src="/home/video-poster-materials.png" alt="مجموعه‌ای از مصالح ساختمانی شامل سنگ، آجر، فولاد، چوب، عایق و لوله" fill priority sizes="(max-width: 980px) 100vw, 45vw" />
                <div className={styles.videoTop}><span>ویدئوی معرفی وازانو</span><span>CC فارسی</span></div>
                <Link className={styles.play} href="/how-it-works" aria-label="مشاهده نحوه کار وازانو" />
                <div className={styles.videoCaption}><strong>از نیاز پروژه تا پیشنهاد قابل مقایسه</strong><span>معرفی کوتاه مسیر وازانو</span></div>
              </div>
            </div>

            <div className={styles.heroCopy}>
              <div className={styles.eyebrow}>بازار هوشمند استعلام مصالح ساختمانی</div>
              <h1>نیاز پروژه را دقیق ثبت کنید.<span>پیشنهادها را روشن مقایسه کنید.</span></h1>
              <p>وازانو درخواست خرید مصالح را ساختاریافته می‌کند، آن را به تأمین‌کنندگان مرتبط می‌رساند و شرایط قیمت، حمل، زمان تحویل و پرداخت را در یک مسیر قابل پیگیری کنار هم قرار می‌دهد.</p>
              <div className={styles.heroActions}>
                <Link className={`${styles.button} ${styles.buttonPrimary}`} href="/dashboard/rfqs/new">شروع درخواست خرید</Link>
                <Link className={`${styles.button} ${styles.buttonGhost}`} href="/plans">برای تأمین‌کنندگان</Link>
              </div>
              <div className={styles.microNote}><span>رایگان برای خریدار</span><span>ورود امن با پیامک</span><span>نگهداری سوابق در حساب</span></div>
            </div>
          </div>

          <HomeRfqSlider />
        </div>
      </section>

      <section className={styles.taxonomySection} id="categories">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div className={styles.eyebrow}>طبقه‌بندی بازار وازانو</div>
            <h2>یک بازار برای همه مصالح؛<br />فعالیت از سنگ طبیعی آغاز شده است</h2>
            <p>معماری محصول برای توسعه به خانواده‌های مختلف مصالح آماده است. در نسخه فعلی، فقط سنگ طبیعی قابل استعلام است و سایر دسته‌ها به‌صورت شفاف در وضعیت «به‌زودی» نمایش داده می‌شوند.</p>
          </div>
          <div className={styles.taxonomyNote}><b>راهنمای وضعیت:</b><span>کارت طلایی «فعال» قابل انتخاب است. کارت‌های کم‌رنگ مسیر توسعه محصول را نشان می‌دهند و فعلاً اقدام ندارند.</span></div>
          <div className={styles.taxonomyGrid}>
            {categories.map((category) => (
              <article className={`${styles.taxCard} ${category.active ? styles.activeTaxCard : ''}`} key={category.name}>
                <div className={styles.taxArt} style={{ backgroundPosition: category.position }}><span className={styles.taxStatus}>{category.active ? 'فعال' : 'به‌زودی'}</span></div>
                <div className={styles.taxBody}>
                  <h3>{category.name}</h3><p>{category.description}</p>
                  {category.active ? <Link className={styles.taxLink} href="/dashboard/rfqs/new">ثبت استعلام سنگ ←</Link> : <span className={styles.taxLink}>در برنامه توسعه</span>}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.process} id="how">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div className={styles.eyebrow}>مسیر واقعی محصول</div>
            <h2>ثبت نیاز تا انتخاب پیشنهاد،<br />در چهار گام روشن</h2>
            <p>منطق صفحه با جریان فعلی سامانه هماهنگ است: انتخاب حوزه و دسته، تکمیل مشخصات، بازبینی و انتشار، سپس دریافت پیشنهادهای مرتبط.</p>
          </div>
          <div className={styles.processGrid}>
            <article><b>۰۱</b><h3>نیاز را تعریف کنید</h3><p>حوزه خرید، عنوان پروژه، مقصد و زمان موردنیاز را مشخص کنید.</p></article>
            <article><b>۰۲</b><h3>مشخصات محصول را کامل کنید</h3><p>دسته فعال، مقدار، واحد، ویژگی‌های فنی و فایل‌های پروژه را وارد کنید.</p></article>
            <article><b>۰۳</b><h3>بازبینی و انتشار</h3><p>درخواست پس از تکمیل الزامات و کنترل‌های لازم برای شبکه تأمین منتشر می‌شود.</p></article>
            <article><b>۰۴</b><h3>پیشنهادها را مقایسه کنید</h3><p>قیمت نهایی، آماده‌سازی، حمل، مالیات و شرایط پرداخت را کنار هم ببینید.</p></article>
          </div>
          <div className={styles.comparison}>
            <div className={styles.comparisonCopy}><div className={styles.eyebrow}>مقایسه هم‌سطح</div><h3>جزئیات مالی و اجرایی، جدا و قابل بررسی</h3><p>عدد پایین‌تر همیشه پیشنهاد بهتر نیست. وازانو مؤلفه‌های اثرگذار را تفکیک می‌کند تا تصمیم براساس شرایط واقعی پروژه انجام شود.</p><Link className={`${styles.button} ${styles.buttonPrimary}`} href="/dashboard/rfqs/new">ساخت پیش‌نویس درخواست</Link></div>
            <div className={styles.quoteTable} aria-label="نمونه مقایسه پیشنهادها">
              <div className={`${styles.quoteRow} ${styles.quoteHeader}`}><span>تأمین‌کننده</span><span>مبلغ نهایی</span><span>تحویل</span><span>پرداخت</span></div>
              <div className={styles.quoteRow}><strong>تأمین‌کننده الف</strong><span>۴۸۶ میلیون</span><span className={styles.best}>۱۲ روز</span><span>۴۰ / ۶۰</span></div>
              <div className={styles.quoteRow}><strong>تأمین‌کننده ب</strong><span className={styles.best}>۴۷۲ میلیون</span><span>۱۸ روز</span><span>نقدی</span></div>
              <div className={styles.quoteRow}><strong>تأمین‌کننده ج</strong><span>۴۹۸ میلیون</span><span>۱۴ روز</span><span className={styles.best}>۳۰ / ۷۰</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.audienceSection} id="seller">
        <div className={styles.container}>
          <div className={styles.sectionHead}><div className={styles.eyebrow}>دو نقش، دو مسیر</div><h2>هر کاربر فقط آنچه برای تصمیمش لازم است می‌بیند</h2><p>صفحه نخست مشترک است، اما اقدام خریدار و تأمین‌کننده از همین بخش به دو جریان مستقل و سازگار با نقش‌های سامانه تقسیم می‌شود.</p></div>
          <div className={styles.audienceGrid}>
            <article className={`${styles.audienceCard} ${styles.buyerCard} ${styles.glass}`}><div><div className={styles.eyebrow}>برای خریداران</div><h3>درخواست خرید را دقیق آغاز کنید</h3><p>ابتدا اطلاعات پروژه را کامل کنید؛ ورود امن فقط در پایان و برای ذخیره و پیگیری درخواست انجام می‌شود.</p></div><div><div className={styles.checkList}><span>رایگان برای خریدار</span><span>سوابق قابل پیگیری</span><span>مقایسه روشن</span></div><Link className={`${styles.button} ${styles.buttonDark}`} href="/dashboard/rfqs/new">شروع ثبت درخواست</Link></div></article>
            <article className={`${styles.audienceCard} ${styles.sellerCard}`}><div><div className={styles.eyebrow}>برای تأمین‌کنندگان</div><h3>فقط به فرصت‌های متناسب با توان خود پاسخ دهید</h3><p>پروفایل تخصصی، دسته‌های قابل تأمین و محدوده خدمت‌رسانی را مشخص کنید؛ سپس فرصت‌های مرتبط و پلن دسترسی را مدیریت کنید.</p></div><div><div className={styles.checkList}><span>احراز سازمان</span><span>فرصت‌های مرتبط</span><span>پیشنهاد تفکیکی</span></div><Link className={`${styles.button} ${styles.buttonDark}`} href="/plans">مشاهده پلن‌های فروشندگان</Link></div></article>
          </div>
        </div>
      </section>

      <section className={styles.supplierBand} id="suppliers">
        <div className={styles.container}><div className={styles.supplierHead}><div><div className={styles.eyebrow}>شبکه تأمین</div><h2>تأمین‌کنندگان حاضر در وازانو</h2></div><p>لوگوها فقط پس از احراز حضور و دریافت مجوز انتشار نمایش داده می‌شوند.</p></div><div className={styles.logos} aria-label="جایگاه لوگوی تأمین‌کنندگان تأییدشده"><div><strong>لوگوی تأییدشده</strong></div><div>نام تأمین‌کننده</div><div>نام تأمین‌کننده</div><div>نام تأمین‌کننده</div><div>نام تأمین‌کننده</div><div>نام تأمین‌کننده</div></div></div>
      </section>

      <section className={styles.faqSection} id="faq">
        <div className={`${styles.container} ${styles.faqWrap}`}><div className={styles.faqIntro}><div className={styles.eyebrow}>پیش از شروع</div><h2>پاسخ‌های روشن به پرسش‌های مهم</h2><p>هزینه، احراز، حریم اطلاعات و حدود مسئولیت وازانو باید پیش از اقدام قابل مشاهده باشند.</p><Link className={styles.taxLink} href="/faq">مشاهده همه پرسش‌ها ←</Link></div><div className={styles.faqList}>{faqs.map((question) => <Link className={styles.faqItem} href="/faq" key={question}><span>{question}</span><b aria-hidden="true">＋</b></Link>)}</div></div>
      </section>

      <section className={styles.finalCta} id="start"><div className={styles.container}><div className={`${styles.ctaBox} ${styles.glass}`}><div><div className={styles.eyebrow}>شروع مسیر خرید</div><h2>نیاز پروژه بعدی را همین حالا ساختاریافته کنید</h2><p>اطلاعات خرید را در فرم مرحله‌ای کامل کنید؛ برای ذخیره نهایی در پایان وارد می‌شوید.</p></div><Link className={`${styles.button} ${styles.buttonPrimary}`} href="/dashboard/rfqs/new">شروع درخواست خرید</Link></div></div></section>
    </div>
  );
}
