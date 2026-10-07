import Link from 'next/link';
export default function NotFound() { return <section className="auth-shell"><div className="auth-card"><h1>صفحه پیدا نشد</h1><p className="muted">نشانی واردشده معتبر نیست.</p><Link className="button button-primary" href="/">بازگشت به خانه</Link></div></section>; }
