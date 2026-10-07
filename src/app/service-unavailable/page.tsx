import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'سرویس موقتاً در دسترس نیست' };

export default function ServiceUnavailablePage() {
  return (
    <section className="auth-shell">
      <div className="auth-card">
        <p className="eyebrow">اختلال موقت</p>
        <h1>ارتباط با سرویس وازانو برقرار نشد</h1>
        <p className="muted">اطلاعات شما محفوظ است. چند لحظه دیگر دوباره تلاش کنید و اگر مشکل ادامه داشت، وضعیت سرویس API را بررسی کنید.</p>
        <div className="actions">
          <Link className="button button-primary" href="/dashboard">تلاش دوباره</Link>
          <Link className="button button-secondary" href="/">صفحه اصلی</Link>
        </div>
      </div>
    </section>
  );
}
