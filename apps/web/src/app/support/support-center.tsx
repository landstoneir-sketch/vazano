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
type UploadIntent = { attachment: { id: string }; upload: { url: string; method: string; headers: Record<string, string> } };

export function SupportCenter({ initialRequest, initialOrganizationId }: { initialRequest?: 'MANUAL_RENEWAL'; initialOrganizationId?: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [type, setType] = useState(initialRequest === 'MANUAL_RENEWAL' ? 'SERVICE_REQUEST' : 'QUESTION');
  const [category, setCategory] = useState(initialRequest === 'MANUAL_RENEWAL' ? 'BILLING' : 'OTHER');
  const [organizationId, setOrganizationId] = useState('');
  const [subject, setSubject] = useState(initialRequest === 'MANUAL_RENEWAL' ? 'درخواست تمدید دستی اشتراک' : '');
  const [description, setDescription] = useState(initialRequest === 'MANUAL_RENEWAL' ? 'لطفاً راهنمای پرداخت و تمدید دستی اشتراک این حساب را اعلام کنید.' : '');
  const [message, setMessage] = useState('');
  const [paymentReceipt, setPaymentReceipt] = useState<File | null>(null);
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
      if (active) {
        setTickets(ticketData);
        setOrganizations(organizationData);
        if (initialOrganizationId && organizationData.some((item) => item.id === initialOrganizationId)) setOrganizationId(initialOrganizationId);
      }
    }).catch((reason: unknown) => {
      if (active) setMessage(reason instanceof Error ? reason.message : 'دریافت اطلاعات پشتیبانی انجام نشد.');
    });
    return () => { active = false; };
  }, [initialOrganizationId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const created = await apiRequest<Ticket>('/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ type, category, subject, description, organizationId: organizationId || undefined }),
      });
      if (initialRequest === 'MANUAL_RENEWAL' && paymentReceipt) {
        const intent = await apiRequest<UploadIntent>(`/attachments/support-tickets/${created.id}/upload-intent`, {
          method: 'POST',
          body: JSON.stringify({ fileName: paymentReceipt.name, mimeType: paymentReceipt.type, sizeBytes: paymentReceipt.size, purpose: 'PAYMENT_RECEIPT' }),
        });
        const uploaded = await fetch(intent.upload.url, { method: intent.upload.method, headers: intent.upload.headers, body: paymentReceipt });
        if (!uploaded.ok) throw new Error(`درخواست ${created.code} ثبت شد، اما بارگذاری رسید انجام نشد؛ در پاسخ همان درخواست موضوع را به پشتیبانی اطلاع دهید.`);
        await apiRequest(`/attachments/${intent.attachment.id}/complete`, { method: 'POST' });
      }
      setSubject(''); setDescription('');
      setPaymentReceipt(null);
      setMessage(initialRequest === 'MANUAL_RENEWAL' ? `درخواست شما با کد ${created.code} همراه رسید امن ثبت شد.` : `درخواست شما با کد ${created.code} ثبت شد.`);
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
      <label className="form-field"><span>حساب سازمانی مرتبط {initialRequest === 'MANUAL_RENEWAL' ? '' : '(اختیاری)'}</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} required={initialRequest === 'MANUAL_RENEWAL'}><option value="">{initialRequest === 'MANUAL_RENEWAL' ? 'سازمان فروشنده را انتخاب کنید' : 'حساب شخصی'}</option>{organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.displayName}</option>)}</select></label>
      <label className="form-field"><span>عنوان کوتاه</span><input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={160} required /></label>
      <label className="form-field full"><span>شرح کامل</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={5000} rows={5} required /></label>
      {initialRequest === 'MANUAL_RENEWAL' && <label className="form-field full"><span>رسید پرداخت</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setPaymentReceipt(event.target.files?.[0] ?? null)} required /><small>PDF یا تصویر تا سقف مجاز؛ فایل پیش از نمایش به واحد مالی با ClamAV بررسی می‌شود.</small></label>}
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
