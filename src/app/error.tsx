'use client';

import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Vazano route error', { digest: error.digest ?? 'unavailable' });
  }, [error]);

  return <main className="container dashboard">
    <section className="card stack">
      <div className="eyebrow">بازیابی وازانو</div>
      <h1>نمایش این بخش با خطا روبه‌رو شد</h1>
      <p className="muted">اطلاعات شما حذف نشده است. دوباره تلاش کنید و اگر مشکل ادامه داشت، شناسه خطا را برای پشتیبانی ارسال کنید.</p>
      {error.digest && <p><code>{error.digest}</code></p>}
      <div className="actions"><button className="button button-primary" type="button" onClick={reset}>تلاش دوباره</button><a className="button button-secondary" href="/dashboard">بازگشت به داشبورد</a></div>
    </section>
  </main>;
}
