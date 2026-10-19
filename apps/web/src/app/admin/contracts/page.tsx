import { ContractRequestsQueue } from './contract-requests-queue';

export const metadata = { title: 'درخواست‌های قرارداد' };

export default function AdminContractsPage() {
  return <section className="container dashboard">
    <div className="eyebrow">خدمت اختیاری پس از انتخاب فروشنده</div>
    <h1>صف درخواست‌های قرارداد</h1>
    <p className="muted">درخواست را بررسی کنید، خلاصه شرایط را برای تأیید خریدار بفرستید و پس از هماهنگی نهایی آن را تکمیل کنید.</p>
    <ContractRequestsQueue />
  </section>;
}
