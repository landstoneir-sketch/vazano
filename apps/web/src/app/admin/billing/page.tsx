import { BillingManager } from './billing-manager';

export const metadata = { title: 'اشتراک‌ها و پرداخت‌ها' };

export default function AdminBillingPage() {
  return <section className="container dashboard"><div className="eyebrow">مدیریت مالی وازانو</div><h1>اشتراک‌ها، پلن‌ها و پرداخت‌ها</h1><p className="muted">قیمت و امکانات پلن‌ها را مدیریت کنید و وضعیت اشتراک و پرداخت تأمین‌کنندگان را ببینید.</p><BillingManager /></section>;
}
