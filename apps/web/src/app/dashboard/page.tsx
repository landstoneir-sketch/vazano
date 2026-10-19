import { DashboardOverview } from './dashboard-overview';

export const metadata = { title: 'داشبورد' };

export default function DashboardPage() {
  return <section className="container dashboard">
    <div className="eyebrow">نسخه MVP</div>
    <h1>داشبورد وازانو</h1>
    <p className="muted">ثبت استعلام، توزیع قاعده‌محور، پیشنهاد فروشنده و مقایسه قیمت به هسته عملیاتی متصل است.</p>
    <DashboardOverview />
  </section>;
}
