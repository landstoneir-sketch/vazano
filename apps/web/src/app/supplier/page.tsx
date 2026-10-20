import Link from 'next/link';
import { MatchedRfqs } from './matched-rfqs';
import { SupplierPerformance } from './supplier-performance';

export const metadata = { title: 'فرصت‌های فروش' };

export default function SupplierDashboardPage() {
  return <section className="container dashboard">
    <header className="dashboard-page-heading"><div><div className="eyebrow">فضای فروشنده</div><h1>مرکز فروش وازانو</h1><p className="muted">فرصت‌های جدید را پاسخ دهید و عملکرد فروش خود را در یک صفحه دنبال کنید.</p></div><Link className="button button-secondary" href="/supplier/subscription">اشتراک و پرداخت</Link></header>
    <MatchedRfqs />
    <section className="dashboard-section supplier-performance-section" aria-labelledby="supplier-performance-title">
      <header className="dashboard-section-heading"><div><div className="eyebrow">گزارش عملکرد</div><h2 id="supplier-performance-title">نتیجه فعالیت فروش</h2></div></header>
      <SupplierPerformance />
    </section>
  </section>;
}
