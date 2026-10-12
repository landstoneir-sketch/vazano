import { DashboardOverview } from './dashboard-overview';

export const metadata = { title: 'داشبورد' };

export default function DashboardPage() {
  return <section className="container dashboard">
    <div className="eyebrow">نسخه MVP</div>
    <h1>داشبورد وازانو</h1>
    <p className="muted">ثبت استعلام، توزیع قاعده‌محور، پیشنهاد فروشنده و مقایسه قیمت به هسته عملیاتی متصل است.</p>
    <div className="dashboard-grid">
      <article className="card"><h2>استعلام‌های من</h2><strong>قابل پیگیری</strong></article>
      <article className="card"><h2>پوشش بازار</h2><strong>کل ایران</strong></article>
      <article className="card"><h2>نمایش قیمت</h2><strong>بدون مالیات</strong></article>
    </div>
    <DashboardOverview />
  </section>;
}
