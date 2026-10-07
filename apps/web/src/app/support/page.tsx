import { SupportCenter } from './support-center';

export const metadata = { title: 'پشتیبانی' };

export default function SupportPage() {
  return (
    <section className="container dashboard">
      <div className="eyebrow">پشتیبانی و اعتماد</div>
      <h1>مرکز پشتیبانی و گزارش تخلف</h1>
      <p className="muted">درخواست پشتیبانی، شکایت یا گزارش تخلف خود را ثبت و وضعیت رسیدگی را پیگیری کنید.</p>
      <SupportCenter />
    </section>
  );
}
