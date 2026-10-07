'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type Organization = { id: string; displayName: string; legalName: string; kind: 'BUYER' | 'SUPPLIER'; status: string };

export function OrganizationPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    try { setOrganizations(await apiRequest<Organization[]>('/organizations/mine')); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'خطا در دریافت سازمان‌ها'); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      await apiRequest('/organizations', {
        method: 'POST',
        body: JSON.stringify({ kind: 'BUYER', type: nationalId ? 'COMPANY' : 'INDIVIDUAL', legalName: displayName, displayName, nationalId: nationalId || undefined }),
      });
      setDisplayName(''); setNationalId(''); setMessage('حساب خریدار با موفقیت ایجاد شد.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'ایجاد حساب انجام نشد.'); }
    finally { setBusy(false); }
  }

  return <div className="stack">
    {message && <div className="message message-success">{message}</div>}
    {organizations.map((organization) => <article className="card" key={organization.id}><h2>{organization.displayName}</h2><p>{organization.kind === 'BUYER' ? 'خریدار' : 'فروشنده'} · {organization.status}</p></article>)}
    <form className="card form-grid" onSubmit={submit}>
      <h2>ایجاد حساب خریدار</h2>
      <label className="form-field"><span>نام شخص یا مجموعه</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} /></label>
      <label className="form-field"><span>شناسه ملی شرکت (اختیاری)</span><input value={nationalId} onChange={(event) => setNationalId(event.target.value)} inputMode="numeric" /></label>
      <button className="button button-primary" disabled={busy}>{busy ? 'در حال ثبت…' : 'ایجاد حساب خریدار'}</button>
    </form>
  </div>;
}
