import type { Metadata } from 'next';
import { safeReturnTo } from '@/lib/route-access';
import { LoginForm } from './login-form';
export const metadata: Metadata = { title: 'ورود' };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const params = await searchParams;
  return <section className="auth-shell">
    <div className="auth-layout">
      <aside className="auth-intro" aria-label="مزایای حساب وازانو">
        <span className="eyebrow">فضای امن پروژه شما</span>
        <h1>همه استعلام‌ها و پیشنهادها در یک مسیر روشن</h1>
        <p>با ورود به وازانو می‌توانید درخواست خرید ثبت کنید، پاسخ تأمین‌کنندگان را مقایسه کنید و سابقه تصمیم‌ها را نگه دارید.</p>
        <ul>
          <li><span aria-hidden="true">✓</span> ورود سریع با کد یک‌بارمصرف</li>
          <li><span aria-hidden="true">✓</span> جداسازی اطلاعات هر سازمان</li>
          <li><span aria-hidden="true">✓</span> ثبت سوابق عملیات حساس</li>
        </ul>
      </aside>
      <LoginForm returnTo={safeReturnTo(params.returnTo)} />
    </div>
  </section>;
}
