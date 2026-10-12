'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type ActiveSession = {
  id: string;
  expiresAt: string;
  lastSeenAt: string;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
};

export function ActiveSessions() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest<ActiveSession[]>('/auth/sessions')
      .then((items) => { if (active) setSessions(items); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت نشست‌ها انجام نشد.'); });
    return () => { active = false; };
  }, []);

  async function revoke(session: ActiveSession) {
    const confirmation = session.isCurrent
      ? 'با بستن این نشست، از حساب خارج می‌شوید. ادامه می‌دهید؟'
      : 'دسترسی این دستگاه به حساب بسته شود؟';
    if (!window.confirm(confirmation)) return;
    setBusyId(session.id); setError(''); setMessage('');
    try {
      const result = await apiRequest<{ isCurrent: boolean }>(`/auth/sessions/${session.id}`, { method: 'DELETE' });
      if (result.isCurrent) {
        router.replace('/login'); router.refresh(); return;
      }
      setSessions((items) => items.filter((item) => item.id !== session.id));
      setMessage('نشست انتخاب‌شده بسته شد.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'بستن نشست انجام نشد.');
    } finally {
      setBusyId('');
    }
  }

  return <section className="card stack">
    <div><div className="eyebrow">امنیت حساب</div><h2>دستگاه‌های واردشده</h2><p className="muted">اگر دستگاهی را نمی‌شناسید، نشست آن را فوراً ببندید.</p></div>
    {error && <div className="message message-error" role="alert">{error}</div>}
    {message && <div className="message message-success" role="status">{message}</div>}
    {sessions.length === 0 && !error && <p className="muted">نشست فعالی پیدا نشد.</p>}
    {sessions.map((session) => <div className="organization-member-row" key={session.id}>
      <div>
        <strong>{deviceLabel(session.userAgent)}{session.isCurrent ? ' · همین دستگاه' : ''}</strong>
        <p>آخرین فعالیت: {new Date(session.lastSeenAt).toLocaleString('fa-IR')}{session.ipAddress ? ` · IP: ${session.ipAddress}` : ''}</p>
        <small className="muted">انقضا: {new Date(session.expiresAt).toLocaleString('fa-IR')}</small>
      </div>
      <button className={session.isCurrent ? 'button button-secondary' : 'button button-danger'} type="button" disabled={Boolean(busyId)} onClick={() => void revoke(session)}>
        {busyId === session.id ? 'در حال بستن…' : session.isCurrent ? 'خروج از این دستگاه' : 'بستن دسترسی'}
      </button>
    </div>)}
  </section>;
}

function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return 'دستگاه ناشناس';
  const platform = /Android/i.test(userAgent) ? 'اندروید' : /iPhone|iPad/i.test(userAgent) ? 'iPhone / iPad' : /Windows/i.test(userAgent) ? 'ویندوز' : /Macintosh/i.test(userAgent) ? 'مک' : 'دستگاه دیگر';
  const browser = /Edg\//i.test(userAgent) ? 'Edge' : /Chrome\//i.test(userAgent) ? 'Chrome' : /Firefox\//i.test(userAgent) ? 'Firefox' : /Safari\//i.test(userAgent) ? 'Safari' : 'مرورگر';
  return `${browser} روی ${platform}`;
}
