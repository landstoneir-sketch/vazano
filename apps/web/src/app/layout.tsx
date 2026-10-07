import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { AccountNavigation } from '@/components/account-navigation';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'وازانو', template: '%s | وازانو' },
  description: 'استعلام هوشمند و مقایسه شفاف قیمت مصالح ساختمانی',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">وازانو</Link>
          <nav aria-label="منوی اصلی">
            <Link href="/how-it-works">نحوه کار</Link>
            <Link href="/plans">پلن‌ها</Link>
            <Link href={'/faq' as Route}>پرسش‌ها</Link>
            <AccountNavigation />
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
