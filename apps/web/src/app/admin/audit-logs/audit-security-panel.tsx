'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type AuditLog = {
  id: string; action: string; entityType: string; entityId: string | null; metadata: unknown; ipAddress: string | null; createdAt: string;
  actor: { id: string; firstName: string | null; lastName: string | null; mobileMasked: string } | null;
};
type SecurityEvent = {
  id: string; eventType: string; severity: string; outcome: string; ipAddress: string | null; userAgent: string | null;
  metadata: unknown; createdAt: string; resolvedAt: string | null;
  user: { id: string; firstName: string | null; lastName: string | null; mobileMasked: string } | null;
  resolvedBy: { id: string; firstName: string | null; lastName: string | null } | null;
};

const severityLabels: Record<string, string> = { INFO: 'اطلاعاتی', LOW: 'کم', MEDIUM: 'متوسط', HIGH: 'زیاد', CRITICAL: 'بحرانی' };

export function AuditSecurityPanel() {
  const [tab, setTab] = useState<'security' | 'audit'>('security');
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [severity, setSeverity] = useState('');
  const [resolved, setResolved] = useState('false');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSecurity = useCallback(async () => {
    setError('');
    const params = new URLSearchParams();
    if (severity) params.set('severity', severity);
    if (resolved) params.set('resolved', resolved);
    try { setEvents(await apiRequest<SecurityEvent[]>(`/admin/operations/security-events?${params}`)); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'دریافت رخدادهای امنیتی انجام نشد.'); }
  }, [resolved, severity]);

  const loadAudit = useCallback(async () => {
    setError('');
    const params = new URLSearchParams({ limit: '100' });
    if (action.trim()) params.set('action', action.trim());
    if (entityType.trim()) params.set('entityType', entityType.trim());
    try { setLogs(await apiRequest<AuditLog[]>(`/admin/operations/audit-logs?${params}`)); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'دریافت لاگ ممیزی انجام نشد.'); }
  }, [action, entityType]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<SecurityEvent[]>('/admin/operations/security-events?resolved=false'),
      apiRequest<AuditLog[]>('/admin/operations/audit-logs?limit=100'),
    ]).then(([securityItems, auditItems]) => {
      if (active) { setEvents(securityItems); setLogs(auditItems); }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت اطلاعات نظارتی انجام نشد.');
    });
    return () => { active = false; };
  }, []);

  async function resolve(event: SecurityEvent) {
    const reason = window.prompt('نتیجه بررسی و دلیل بستن رخداد را وارد کنید:')?.trim();
    if (!reason) return;
    if (reason.length < 5) { setError('توضیح بررسی باید حداقل ۵ نویسه باشد.'); return; }
    setBusyId(event.id); setError(''); setMessage('');
    try {
      await apiRequest(`/admin/operations/security-events/${event.id}/resolve`, { method: 'PUT', body: JSON.stringify({ reason }) });
      setMessage('رخداد امنیتی بررسی و بسته شد.');
      await loadSecurity();
    } catch (reasonValue: unknown) { setError(reasonValue instanceof Error ? reasonValue.message : 'ثبت نتیجه بررسی انجام نشد.'); }
    finally { setBusyId(null); }
  }

  function submitAudit(event: FormEvent) { event.preventDefault(); void loadAudit(); }

  return <div className="stack">
    <div className="tab-list" role="tablist">
      <button className={tab === 'security' ? 'tab-active' : ''} onClick={() => setTab('security')} type="button">رخدادهای امنیتی</button>
      <button className={tab === 'audit' ? 'tab-active' : ''} onClick={() => setTab('audit')} type="button">لاگ ممیزی</button>
    </div>
    {error && <div className="message message-error">{error}</div>}
    {message && <div className="message message-success">{message}</div>}
    {tab === 'security' ? <>
      <div className="admin-toolbar">
        <label className="form-field"><span>شدت</span><select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="">همه</option>{Object.entries(severityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="form-field"><span>وضعیت بررسی</span><select value={resolved} onChange={(event) => setResolved(event.target.value)}><option value="false">باز</option><option value="true">بسته‌شده</option><option value="">همه</option></select></label>
        <button className="button button-secondary" type="button" onClick={() => void loadSecurity()}>به‌روزرسانی</button>
      </div>
      <div className="admin-summary"><strong>{events.length.toLocaleString('fa-IR')}</strong><span>رخداد نمایش داده شده</span></div>
      {events.length === 0 && <div className="card">رخداد امنیتی مطابق فیلتر وجود ندارد.</div>}
      {events.map((event) => <article className="card security-event-card" key={event.id}>
        <div className="admin-card-title"><div><span className={`severity-badge severity-${event.severity.toLowerCase()}`}>{severityLabels[event.severity] ?? event.severity}</span><h2>{event.eventType}</h2></div><time>{formatDate(event.createdAt)}</time></div>
        <p>نتیجه: {event.outcome} · کاربر: {displayUser(event.user)} · IP: {event.ipAddress ?? 'ثبت نشده'}</p>
        <MetadataDetails value={event.metadata} />
        {!event.resolvedAt ? <button className="button button-primary" type="button" disabled={busyId === event.id} onClick={() => void resolve(event)}>ثبت نتیجه بررسی</button> : <small className="muted">بسته‌شده در {formatDate(event.resolvedAt)} توسط {event.resolvedBy ? displayName(event.resolvedBy) : 'سامانه'}</small>}
      </article>)}
    </> : <>
      <form className="admin-toolbar" onSubmit={submitAudit}>
        <label className="form-field"><span>نوع عملیات</span><input value={action} onChange={(event) => setAction(event.target.value)} placeholder="برای نمونه user.status" /></label>
        <label className="form-field"><span>نوع موجودیت</span><input value={entityType} onChange={(event) => setEntityType(event.target.value)} placeholder="برای نمونه User" /></label>
        <button className="button button-secondary" type="submit">اعمال فیلتر</button>
      </form>
      <div className="admin-summary"><strong>{logs.length.toLocaleString('fa-IR')}</strong><span>عملیات اخیر</span></div>
      {logs.length === 0 && <div className="card">لاگ ممیزی مطابق فیلتر وجود ندارد.</div>}
      {logs.map((log) => <article className="card audit-log-card" key={log.id}>
        <div className="admin-card-title"><div><div className="eyebrow">{log.entityType}{log.entityId ? ` · ${log.entityId}` : ''}</div><h2>{log.action}</h2></div><time>{formatDate(log.createdAt)}</time></div>
        <p>انجام‌دهنده: {log.actor ? `${displayName(log.actor)} · ${log.actor.mobileMasked}` : 'سامانه'} · IP: {log.ipAddress ?? 'ثبت نشده'}</p>
        <MetadataDetails value={log.metadata} />
      </article>)}
    </>}
  </div>;
}

function MetadataDetails({ value }: { value: unknown }) {
  if (value === null || value === undefined) return null;
  return <details className="metadata-details"><summary>جزئیات فنی</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
}

function displayName(user: { firstName: string | null; lastName: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'بدون نام';
}

function displayUser(user: SecurityEvent['user']) {
  return user ? `${displayName(user)} · ${user.mobileMasked}` : 'ناشناس یا ثبت‌نام‌نشده';
}
