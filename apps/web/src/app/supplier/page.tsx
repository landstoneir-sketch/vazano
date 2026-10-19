import Link from 'next/link';
import { MatchedRfqs } from './matched-rfqs';
import { SupplierPerformance } from './supplier-performance';

export const metadata = { title: 'فرصت‌های فروش' };

export default function SupplierDashboardPage() {
  return <section className="container dashboard">
    <header className="dashboard-page-heading"><div><div className="eyebrow">فضای فروشنده</div><h1>فرصت‌های متناسب با توانمندی شما</h1><p className="muted">این فهرست با قواعد شفاف دسته‌بندی، پوشش جغرافیایی و وضعیت تأیید حساب ساخته می‌شود.</p></div><Link className="button button-secondary" href="/supplier/subscription">مدیریت اشتراک و پرداخت</Link></header>
    <SupplierPerformance /><MatchedRfqs />
  </section>;
}
