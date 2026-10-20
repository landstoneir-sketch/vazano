import { DashboardOverview } from './dashboard-overview';

export const metadata = { title: 'داشبورد' };

export default function DashboardPage() {
  return <section className="container dashboard">
    <div className="eyebrow">مرکز کار شما</div>
    <h1>امروز چه کاری دارید؟</h1>
    <p className="muted">وضعیت خرید و فروش را یک‌جا ببینید و کار بعدی را سریع انجام دهید.</p>
    <DashboardOverview />
  </section>;
}
