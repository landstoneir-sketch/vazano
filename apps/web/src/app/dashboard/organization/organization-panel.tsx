'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type Organization = { id: string; displayName: string; legalName: string; kind: 'BUYER' | 'SUPPLIER'; status: string };

export function OrganizationPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [kind, setKind] = useState<'BUYER' | 'SUPPLIER'>('BUYER');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
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
        body: JSON.stringify({ kind, type: nationalId ? 'COMPANY' : 'INDIVIDUAL', legalName: displayName, displayName, nationalId: nationalId || undefined, province: province || undefined, city: city || undefined }),
      });
      setDisplayName(''); setNationalId(''); setProvince(''); setCity(''); setMessage(kind === 'BUYER' ? 'حساب خریدار با موفقیت ایجاد شد.' : 'حساب فروشنده ایجاد شد؛ اکنون توانمندی‌های آن را تکمیل کنید.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'ایجاد حساب انجام نشد.'); }
    finally { setBusy(false); }
  }

  return <div className="stack">
    {message && <div className="message message-success">{message}</div>}
    {organizations.map((organization) => <article className="card list-card" key={organization.id}><div><h2>{organization.displayName}</h2><p>{organization.kind === 'BUYER' ? 'خریدار' : 'فروشنده'} · {organization.status}</p></div>{organization.kind === 'SUPPLIER' && <Link className="button button-secondary" href={`/supplier/profile/${organization.id}`}>تکمیل توانمندی‌ها</Link>}</article>)}
    <form className="card form-grid" onSubmit={submit}>
      <h2>ایجاد حساب خریدار یا فروشنده</h2>
      <label className="form-field"><span>نوع حساب</span><select value={kind} onChange={(event) => setKind(event.target.value as 'BUYER' | 'SUPPLIER')}><option value="BUYER">خریدار</option><option value="SUPPLIER">فروشنده / تولیدکننده</option></select></label>
      <label className="form-field"><span>نام شخص یا مجموعه</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} /></label>
      <label className="form-field"><span>شناسه ملی شرکت (اختیاری)</span><input value={nationalId} onChange={(event) => setNationalId(event.target.value)} inputMode="numeric" /></label>
      <label className="form-field"><span>استان</span><input value={province} onChange={(event) => setProvince(event.target.value)} /></label>
      <label className="form-field"><span>شهر</span><input value={city} onChange={(event) => setCity(event.target.value)} /></label>
      <button className="button button-primary" disabled={busy}>{busy ? 'در حال ثبت…' : `ایجاد حساب ${kind === 'BUYER' ? 'خریدار' : 'فروشنده'}`}</button>
    </form>
  </div>;
}
