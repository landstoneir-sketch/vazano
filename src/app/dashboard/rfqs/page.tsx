import Link from 'next/link';
import { RfqList } from './rfq-list';

export const metadata = { title: 'استعلام‌های من' };

export default function BuyerRfqsPage() {
  return <section className="container dashboard">
    <header className="dashboard-page-heading"><div><div className="eyebrow">فضای خریدار</div><h1>استعلام‌های من</h1><p className="muted">وضعیت درخواست‌ها را ببینید و موارد نیازمند اقدام را سریع‌تر پیگیری کنید.</p></div><Link className="button button-primary" href="/dashboard/rfqs/new">ثبت استعلام جدید</Link></header>
    <RfqList />
  </section>;
}
