import { PlansList } from './plans-list';

export const metadata = { title: 'پلن‌های فروشندگان' };

export default function PlansPage() {
  return <section className="container dashboard"><div className="eyebrow">اشتراک فروشندگان</div><h1>پلن‌های وازانو</h1><p className="muted">قیمت‌های زیر بدون مالیات نمایش داده شده‌اند. هر یک تومان پرداخت موفق، یک اعتبار وازانو ایجاد می‌کند.</p><PlansList /></section>;
}
