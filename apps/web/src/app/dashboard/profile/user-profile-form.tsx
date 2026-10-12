'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

type UserProfile = {
  id: string;
  mobile: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
};

export function UserProfileForm() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest<UserProfile>('/users/me')
      .then((result) => {
        if (!active) return;
        setProfile(result);
        setFirstName(result.firstName ?? '');
        setLastName(result.lastName ?? '');
        setEmail(result.email ?? '');
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'دریافت پروفایل انجام نشد.');
      });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(''); setError('');
    try {
      const payload = {
        ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
      };
      const result = await apiRequest<UserProfile>('/users/me', { method: 'PATCH', body: JSON.stringify(payload) });
      setProfile((current) => current ? { ...current, ...result } : result);
      setFirstName(result.firstName ?? ''); setLastName(result.lastName ?? ''); setEmail(result.email ?? '');
      setMessage('اطلاعات حساب شما ذخیره شد.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'ذخیره اطلاعات انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  if (!profile && !error) return <div className="card" role="status">در حال دریافت اطلاعات حساب…</div>;

  return <form className="card form-grid" onSubmit={submit}>
    {error && <div className="message message-error full" role="alert">{error}</div>}
    {message && <div className="message message-success full" role="status">{message}</div>}
    <label className="form-field"><span>شماره موبایل تأییدشده</span><input dir="ltr" value={profile?.mobile ?? ''} disabled /></label>
    <label className="form-field"><span>نام</span><input autoComplete="given-name" minLength={2} maxLength={80} value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
    <label className="form-field"><span>نام خانوادگی</span><input autoComplete="family-name" minLength={2} maxLength={80} value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
    <label className="form-field"><span>ایمیل</span><input dir="ltr" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
    <p className="muted full">تغییر شماره موبایل به احراز مجدد نیاز دارد و در نسخه بعدی از مسیر امن جداگانه ارائه می‌شود.</p>
    <div className="actions full">
      <button className="button button-primary" disabled={busy || !profile}>{busy ? 'در حال ذخیره…' : 'ذخیره اطلاعات'}</button>
      <Link className="button button-secondary" href="/dashboard/organization">مرحله بعد: ایجاد حساب کاری</Link>
    </div>
  </form>;
}
