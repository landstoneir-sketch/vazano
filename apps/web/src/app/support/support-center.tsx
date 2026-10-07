'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { ticketCategoryLabels, ticketStatusLabels, ticketTypeLabels } from './support-labels';

type Organization = { id: string; displayName: string };
type Ticket = {
  id: string;
  code: string;
  type: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  createdAt: string;
  organization: Organization | null;
  _count: { comments: number };
};

export function SupportCenter() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [type, setType] = useState('QUESTION');
  const [category, setCategory] = useState('OTHER');
  const [organizationId, setOrganizationId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [ticketData, organizationData] = await Promise.all([
      apiRequest<Ticket[]>('/support/tickets/mine'),
      apiRequest<Organization[]>('/organizations/mine'),
    ]);
    setTickets(ticketData);
    setOrganizations(organizationData);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<Ticket[]>('/support/tickets/mine'),
      apiRequest<Organization[]>('/organizations/mine'),
    ]).then(([ticketData, organizationData]) => {
      if (active) { setTickets(ticketData); setOrganizations(organizationData); }
    }).catch((reason: unknown) => {
      if (active) setMessage(reason instanceof Error ? reason.message : 'دریافت اطلاعات پشتیبانی انجام نشد.');
    });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const created = await apiRequest<Ticket>('/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ type, category, subject, description, organizationId: organizationId || undefined }),
      });
      setSubject(''); setDescription('');
      setMessage(`درخواست شما با کد ${created.code} ثبت شد.`);
      await load();
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'ثبت درخواست انجام نشد.');
    } finally { setBusy(false); }
  }

  return <div className="stack">
    {message && <div className="message">{message}</div>}
    <form className="card form-grid" onSubmit={submit}>
      <h2>ثبت درخواست جدید</h2>
      <label className="form-field"><span>نوع درخواست</span><select value={type} onChange={(event) => setType(event.target.value)}>{Object.entries(ticketTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="form-field"><span>موضوع مرتبط</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{Object.entries(ticketCategoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="form-field"><span>حساب سازمانی مرتبط (اختیاری)</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">حساب شخصی</option>{organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.displayName}</option>)}</select></label>
      <label className="form-field"><span>عنوان کوتاه</span><input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={160} required /></label>
      <label className="form-field full"><span>شرح کامل</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={5000} rows={5} required /></label>
      <button className="button button-primary" disabled={busy}>{busy ? 'در حال ثبت…' : type === 'VIOLATION_REPORT' ? 'ثبت گزارش تخلف' : 'ثبت درخواست'}</button>
    </form>

    <section><h2>درخواست‌های من</h2><div className="stack">
      {tickets.length === 0 && <div className="card">هنوز درخواستی ثبت نکرده‌اید.</div>}
      {tickets.map((ticket) => <article className="card list-card" key={ticket.id}>
        <div><div className="eyebrow">{ticket.code} · {ticketTypeLabels[ticket.type] ?? ticket.type}</div><h3>{ticket.subject}</h3><p>{ticketStatusLabels[ticket.status] ?? ticket.status} · اولویت {ticket.priority} · {ticket._count.comments.toLocaleString('fa-IR')} پاسخ</p></div>
        <Link className="button button-secondary" href={`/support/${ticket.id}` as Route}>مشاهده و پاسخ</Link>
      </article>)}
    </div></section>
  </div>;
}
