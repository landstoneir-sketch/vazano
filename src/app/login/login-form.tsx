'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiRequest, digitsOnly, normalizeIranianMobileInput } from '@/lib/api';

type RequestOtpResult = { expiresInSeconds: number; debugCode?: string };
type VerifyOtpResult = { isNewUser: boolean };
const OTP_CODE_LENGTH = 5;

export function LoginForm({ returnTo = '/dashboard' }: { returnTo?: string }) {
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'mobile' | 'code'>('mobile');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const verificationInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    apiRequest('/auth/me')
      .then(() => { if (active) window.location.replace(returnTo); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [returnTo]);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!/^09\d{9}$/.test(mobile)) {
      setError('شماره موبایل را به‌صورت ۱۱ رقم و با ۰۹ وارد کنید.');
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest<RequestOtpResult>('/auth/otp/request', { method: 'POST', body: JSON.stringify({ mobile, purpose: 'LOGIN' }) });
      setStep('code');
      setMessage(result.debugCode ? `کد آزمایشی: ${result.debugCode}` : 'کد تأیید برای شما ارسال شد.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'ارسال کد ناموفق بود.'); }
    finally { setBusy(false); }
  }

  async function verifyCode(codeToVerify: string) {
    if (verificationInFlight.current || codeToVerify.length !== OTP_CODE_LENGTH) return;
    verificationInFlight.current = true;
    setBusy(true); setError('');
    try {
      await apiRequest<VerifyOtpResult>('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ mobile, code: codeToVerify, purpose: 'LOGIN', legalAccepted }) });
      window.location.assign(returnTo);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError(message.includes('صحیح نیست') ? 'کد وارد شده صحیح نیست.' : message || 'کد وارد شده صحیح نیست.');
    } finally {
      verificationInFlight.current = false;
      setBusy(false);
    }
  }

  function changeCode(value: string) {
    const nextCode = digitsOnly(value, OTP_CODE_LENGTH);
    setCode(nextCode);
    setError('');
    if (nextCode.length === OTP_CODE_LENGTH) void verifyCode(nextCode);
  }

  return (
    <div className="auth-card">
      <h1>ورود یا ثبت‌نام در وازانو</h1>
      <p className="muted">با شماره موبایل و کد یک‌بارمصرف؛ اگر حساب ندارید، خودکار ساخته می‌شود.</p>
      {message && <div className="message message-success" role="status">{message}</div>}
      {error && <div className="message message-error" role="alert">{error}</div>}
      {step === 'mobile' ? (
        <form onSubmit={requestCode}><label className="form-field"><span>شماره موبایل</span><input type="tel" inputMode="numeric" autoComplete="tel" dir="ltr" pattern="09[0-9]{9}" minLength={11} maxLength={11} placeholder="مثال: 09123456789" value={mobile} onChange={(event) => setMobile(normalizeIranianMobileInput(event.target.value))} required /><small>شماره ۱۱ رقمی با ۰۹ آغاز می‌شود.</small></label><label className="check-field"><input aria-label="پذیرش قوانین و حریم خصوصی" type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} required /><span>با <Link href="/terms" target="_blank">قوانین استفاده</Link> و <Link href="/privacy" target="_blank">سیاست حریم خصوصی</Link> موافقم.</span></label><button className="button button-primary" disabled={busy || !legalAccepted || !/^09\d{9}$/.test(mobile)} type="submit">{busy ? 'در حال ارسال…' : 'ارسال کد تأیید'}</button></form>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void verifyCode(code); }}><label className="form-field"><span>کد تأیید</span><input className="otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern={`[0-9]{${OTP_CODE_LENGTH}}`} maxLength={OTP_CODE_LENGTH} placeholder="کد ۵ رقمی" value={code} onChange={(event) => changeCode(event.target.value)} autoFocus required /><small>{busy ? 'در حال بررسی کد…' : 'پس از ورود رقم پنجم، کد به‌صورت خودکار بررسی می‌شود.'}</small></label><div className="actions"><button className="button button-secondary" type="button" disabled={busy} onClick={() => { setStep('mobile'); setCode(''); setMessage(''); setError(''); }}>اصلاح شماره</button></div></form>
      )}
    </div>
  );
}
