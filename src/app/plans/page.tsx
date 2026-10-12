import { PlansList } from './plans-list';

export const metadata = { title: 'پلن‌های فروشندگان' };

export default function PlansPage() {
  return <section className="container dashboard"><div className="eyebrow">اشتراک فروشندگان</div><h1>پلن‌های وازانو</h1><p className="muted">قیمت پلن‌های پولی بدون مالیات نمایش داده شده است. دوره آزمایشی در صورت فعال‌بودن، بدون اتصال به درگاه آغاز می‌شود.</p><PlansList /></section>;
}
