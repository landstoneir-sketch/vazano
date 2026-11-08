import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { AccountNavigation } from '@/components/account-navigation';
import '@fontsource-variable/vazirmatn';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'وازانو', template: '%s | وازانو' },
  description: 'استعلام هوشمند و مقایسه شفاف قیمت مصالح ساختمانی',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">پرش به محتوای اصلی</a>
        <header className="site-header">
          <Link className="header-primary-action" href="/dashboard/rfqs/new">ثبت درخواست خرید</Link>
          <nav className="primary-navigation" aria-label="منوی اصلی">
            <Link className="nav-public-link" href={'/#how' as Route}>نحوه کار</Link>
            <Link className="nav-public-link" href={'/#categories' as Route}>دسته‌های مصالح</Link>
            <Link className="nav-public-link" href={'/suppliers' as Route}>تأمین‌کنندگان</Link>
            <Link className="nav-public-link" href="/plans">پلن‌های فروشندگان</Link>
            <Link className="nav-public-link" href={'/faq' as Route}>پرسش‌ها</Link>
            <AccountNavigation />
          </nav>
          <Link className="brand" href="/" aria-label="وازانو، صفحه اصلی">
            <span className="brand-mark" aria-hidden="true">V</span>
            <span className="brand-copy"><strong>وازانو</strong><small>بازار حرفه‌ای استعلام</small></span>
          </Link>
        </header>
        <main id="main-content">{children}</main>
        <footer className="site-footer">
          <div className="container">
            <div className="footer-grid">
              <div className="footer-brand"><strong>وازانو</strong><p>زیرساخت ثبت، توزیع و مقایسه درخواست‌های خرید مصالح ساختمانی</p></div>
              <nav className="footer-col" aria-label="پیوندهای خریداران"><strong>خریداران</strong><Link href="/dashboard/rfqs/new">ثبت درخواست خرید</Link><Link href={'/#how' as Route}>نحوه کار</Link><Link href={'/#categories' as Route}>دسته‌های مصالح</Link></nav>
              <nav className="footer-col" aria-label="پیوندهای تأمین‌کنندگان"><strong>تأمین‌کنندگان</strong><Link href={'/suppliers' as Route}>فهرست تأمین‌کنندگان</Link><Link href="/plans">پلن‌ها</Link><Link href={'/supplier' as Route}>ورود به مرکز فروش</Link></nav>
              <nav className="footer-col" aria-label="پیوندهای وازانو"><strong>وازانو</strong><Link href="/about">درباره ما</Link><Link href="/faq">پرسش‌های متداول</Link><Link href="/terms">قوانین</Link><Link href="/privacy">حریم خصوصی</Link><Link href="/support">پشتیبانی</Link></nav>
            </div>
            <div className="footer-bottom"><span>© وازانو</span><span>طراحی راست‌به‌چپ · دسترس‌پذیری AA · سازگار با کاهش حرکت</span></div>
          </div>
        </footer>
      </body>
    </html>
  );
}
