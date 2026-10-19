'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="fa" dir="rtl">
    <body>
      <main style={{ maxWidth: 720, margin: '72px auto', padding: 24, fontFamily: 'Tahoma, sans-serif', textAlign: 'right' }}>
        <h1>وازانو موقتاً در دسترس نیست</h1>
        <p>اطلاعات شما محفوظ است. چند لحظه بعد دوباره تلاش کنید.</p>
        <button type="button" onClick={reset} style={{ border: 0, borderRadius: 10, padding: '12px 22px', cursor: 'pointer' }}>تلاش دوباره</button>
      </main>
    </body>
  </html>;
}
