import { PlansList } from './plans-list';

export const metadata = { title: 'پلن‌های فروشندگان' };

export default function PlansPage() {
  return <section className="container dashboard plans-page">
    <header className="dashboard-page-heading"><div><div className="eyebrow">اشتراک فروشندگان</div><h1>پلنی متناسب با حجم فروش انتخاب کنید</h1><p className="muted">پلن‌ها، قیمت‌ها و محدودیت‌ها از پنل مدیریت وازانو قابل تغییرند. قیمت پلن‌های پولی بدون مالیات نمایش داده می‌شود.</p></div><aside><strong>شروع بدون ریسک</strong><span>دوره آزمایشی در صورت فعال‌بودن، بدون اتصال به درگاه آغاز می‌شود و فقط یک‌بار برای هر سازمان قابل استفاده است.</span></aside></header>
    <PlansList />
  </section>;
}
