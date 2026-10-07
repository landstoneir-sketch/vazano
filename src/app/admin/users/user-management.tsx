'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type Organization = { id: string; displayName: string; kind: string };
type ManagedUser = {
  id: string;
  mobileMasked: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  userRoles: Array<{ role: { key: string; nameFa: string } }>;
  memberships: Array<{ organization: Organization; role: string }>;
  _count: { sessions: number };
};

const statusLabels = { ACTIVE: 'فعال', SUSPENDED: 'تعلیق‌شده' } as const;

export function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (search = '') => {
    setError('');
    try {
      setUsers(await apiRequest<ManagedUser[]>(`/admin/operations/users${search ? `?query=${encodeURIComponent(search)}` : ''}`));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'دریافت کاربران انجام نشد.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void apiRequest<ManagedUser[]>('/admin/operations/users').then((items) => { if (active) setUsers(items); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت کاربران انجام نشد.');
    });
    return () => { active = false; };
  }, []);

  function search(event: FormEvent) {
    event.preventDefault();
    void load(query.trim());
  }

  async function runAction(user: ManagedUser, action: 'status' | 'sessions') {
    const reason = window.prompt(action === 'sessions' ? 'دلیل بستن نشست‌ها را وارد کنید:' : `دلیل ${user.status === 'ACTIVE' ? 'تعلیق' : 'فعال‌سازی'} کاربر را وارد کنید:`)?.trim();
    if (!reason) return;
    if (reason.length < 5) { setError('دلیل اقدام باید حداقل ۵ نویسه باشد.'); return; }
    setBusyId(user.id); setError(''); setMessage('');
    try {
      if (action === 'sessions') {
        const result = await apiRequest<{ revokedSessions: number }>(`/admin/operations/users/${user.id}/revoke-sessions`, { method: 'POST', body: JSON.stringify({ reason }) });
        setMessage(`${result.revokedSessions.toLocaleString('fa-IR')} نشست کاربر بسته شد.`);
      } else {
        const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        await apiRequest(`/admin/operations/users/${user.id}/status`, { method: 'PUT', body: JSON.stringify({ status: nextStatus, reason }) });
        setMessage(`وضعیت کاربر با موفقیت به «${statusLabels[nextStatus]}» تغییر کرد.`);
      }
      await load(query.trim());
    } catch (reasonValue: unknown) {
      setError(reasonValue instanceof Error ? reasonValue.message : 'عملیات انجام نشد.');
    } finally { setBusyId(null); }
  }

  return <div className="stack">
    <form className="admin-toolbar" onSubmit={search}>
      <label className="form-field admin-search"><span>جست‌وجو با نام، ایمیل یا موبایل</span><input value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <button className="button button-secondary" type="submit">جست‌وجو</button>
    </form>
    {error && <div className="message message-error">{error}</div>}
    {message && <div className="message message-success">{message}</div>}
    <div className="admin-summary"><strong>{users.length.toLocaleString('fa-IR')}</strong><span>کاربر نمایش داده شده</span></div>
    {users.length === 0 && !error && <div className="card">کاربری مطابق جست‌وجو پیدا نشد.</div>}
    {users.map((user) => {
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'کاربر بدون نام';
      const roles = user.userRoles.map((item) => item.role.nameFa || item.role.key);
      return <article className="card admin-user-card" key={user.id}>
        <div>
          <div className="admin-card-title"><h2>{name}</h2><span className={`status-badge status-${user.status.toLowerCase()}`}>{statusLabels[user.status]}</span></div>
          <p>{user.mobileMasked}{user.email ? ` · ${user.email}` : ''}</p>
          <div className="tag-list">{roles.map((role) => <span key={role}>{role}</span>)}{user.memberships.map((membership) => <span key={`${membership.organization.id}-${membership.role}`}>{membership.organization.displayName} · {membership.role}</span>)}</div>
          <small className="muted">عضویت از {new Date(user.createdAt).toLocaleDateString('fa-IR')} · {user._count.sessions.toLocaleString('fa-IR')} نشست فعال</small>
        </div>
        <div className="list-card-actions">
          <button className="button button-secondary" type="button" disabled={busyId === user.id || user._count.sessions === 0} onClick={() => void runAction(user, 'sessions')}>بستن نشست‌ها</button>
          <button className={`button ${user.status === 'ACTIVE' ? 'button-danger' : 'button-primary'}`} type="button" disabled={busyId === user.id} onClick={() => void runAction(user, 'status')}>{user.status === 'ACTIVE' ? 'تعلیق کاربر' : 'فعال‌سازی'}</button>
        </div>
      </article>;
    })}
  </div>;
}
