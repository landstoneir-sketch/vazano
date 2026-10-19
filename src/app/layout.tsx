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
          <Link className="brand" href="/" aria-label="وازانو، صفحه اصلی">
            <span className="brand-mark" aria-hidden="true">V</span>
            <span className="brand-copy"><strong>وازانو</strong><small>بازار حرفه‌ای استعلام</small></span>
          </Link>
          <nav className="primary-navigation" aria-label="منوی اصلی">
            <Link href="/how-it-works">نحوه کار</Link>
            <Link href="/plans">پلن‌ها</Link>
            <Link href={'/suppliers' as Route}>فروشندگان</Link>
            <Link href={'/faq' as Route}>پرسش‌ها</Link>
            <AccountNavigation />
          </nav>
        </header>
        <main id="main-content">{children}</main>
        <footer className="site-footer">
          <div className="container site-footer-content">
            <div className="footer-brand"><strong>وازانو</strong><p>استعلام هوشمند، انتخاب مطمئن</p></div>
            <nav aria-label="پیوندهای اطلاعاتی">
              <Link href="/about">درباره ما</Link>
              <Link href="/terms">قوانین</Link>
              <Link href="/privacy">حریم خصوصی</Link>
              <Link href="/support">گزارش تخلف و پشتیبانی</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
