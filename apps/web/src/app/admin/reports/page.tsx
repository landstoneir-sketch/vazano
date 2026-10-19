import { ReportsOverview } from './reports-overview';

export const metadata = { title: 'گزارش مدیریتی' };

export default function AdminReportsPage() {
  return <section className="container dashboard">
    <div className="eyebrow">نمای اجرایی مالک وازانو</div>
    <h1>گزارش مدیریتی MVP</h1>
    <p className="muted">وضعیت عرضه، تقاضا، تبدیل استعلام، درآمد اشتراک و خدمات تکمیلی بر مبنای داده واقعی سامانه.</p>
    <ReportsOverview />
  </section>;
}
