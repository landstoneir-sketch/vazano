import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'عدم دسترسی' };

export default function ForbiddenPage() {
  return (
    <section className="auth-shell">
      <div className="auth-card">
        <p className="eyebrow">دسترسی محدود</p>
        <h1>مجوز مشاهده این بخش را ندارید</h1>
        <p className="muted">این صفحه برای نقش یا سازمان دیگری در نظر گرفته شده است. اگر فکر می‌کنید دسترسی شما باید فعال باشد، با مدیر سازمان یا پشتیبانی وازانو تماس بگیرید.</p>
        <div className="actions">
          <Link className="button button-primary" href="/dashboard">بازگشت به داشبورد</Link>
          <Link className="button button-secondary" href="/support">درخواست پشتیبانی</Link>
        </div>
      </div>
    </section>
  );
}
