'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { apiRequest } from '@/lib/api';

type RequestOtpResult = { expiresInSeconds: number; debugCode?: string };

export function LoginForm({ returnTo = '/dashboard' }: { returnTo?: string }) {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'mobile' | 'code'>('mobile');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await apiRequest<RequestOtpResult>('/auth/otp/request', { method: 'POST', body: JSON.stringify({ mobile, purpose: 'LOGIN' }) });
      setStep('code');
      setMessage(result.debugCode ? `کد آزمایشی: ${result.debugCode}` : 'کد تأیید برای شما ارسال شد.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'ارسال کد ناموفق بود.'); }
    finally { setBusy(false); }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await apiRequest('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ mobile, code, purpose: 'LOGIN' }) });
      router.push(returnTo as Route); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'کد واردشده معتبر نیست.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth-card">
      <h1>ورود به وازانو</h1>
      <p className="muted">ورود امن با شماره موبایل و کد یک‌بارمصرف</p>
      {message && <div className="message message-success" role="status">{message}</div>}
      {error && <div className="message message-error" role="alert">{error}</div>}
      {step === 'mobile' ? (
        <form onSubmit={requestCode}><label className="form-field"><span>شماره موبایل</span><input inputMode="tel" autoComplete="tel" placeholder="09123456789" value={mobile} onChange={(event) => setMobile(event.target.value)} required /></label><button className="button button-primary" disabled={busy} type="submit">{busy ? 'در حال ارسال…' : 'ارسال کد تأیید'}</button></form>
      ) : (
        <form onSubmit={verifyCode}><label className="form-field"><span>کد تأیید</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required /></label><div className="actions"><button className="button button-primary" disabled={busy} type="submit">{busy ? 'در حال بررسی…' : 'ورود'}</button><button className="button button-secondary" type="button" onClick={() => { setStep('mobile'); setMessage(''); }}>اصلاح شماره</button></div></form>
      )}
    </div>
  );
}
