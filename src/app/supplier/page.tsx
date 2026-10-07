import { MatchedRfqs } from './matched-rfqs';

export const metadata = { title: 'فرصت‌های فروش' };

export default function SupplierDashboardPage() {
  return <section className="container dashboard"><div className="eyebrow">فروشنده</div><h1>استعلام‌های متناسب با توانمندی شما</h1><p className="muted">این فهرست با قواعد شفاف دسته‌بندی و پوشش جغرافیایی ساخته می‌شود.</p><MatchedRfqs /></section>;
}
