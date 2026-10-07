'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';

type RfqItem = { id: string; title: string; quantity: string; category: { nameFa: string }; unit: { symbolFa: string } };
type Rfq = { id: string; code: string; title: string; operationalStatus: string; deliveryProvince: string | null; deliveryCity: string | null; displayPricesTaxInclusive: boolean; items: RfqItem[] };
type QuotationItem = { id: string; quantity: string; unitPriceRial: string; lineNetRial: string; isAlternative: boolean; offeredDescription: string | null; rfqItem: RfqItem };
type Quotation = { id: string; code: string; status: string; finalAmountRial: string; taxRial: string; shippingRial: string; preparationDays: number | null; validUntil: string | null; supplierOrganization: { displayName: string; province: string | null; city: string | null }; items: QuotationItem[] };
type Attachment = { id: string; originalName: string; status: string; sizeBytes: number };

function toman(value: string) { return `${(Number(value) / 10).toLocaleString('fa-IR')} تومان`; }

export function RfqDetail({ rfqId }: { rfqId: string }) {
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{ rfq: Rfq; quotations: Quotation[] }>(`/quotations/rfqs/${rfqId}/comparison`);
      setRfq(data.rfq); setQuotations(data.quotations);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'دریافت اطلاعات انجام نشد.'); }
  }, [rfqId]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<{ rfq: Rfq; quotations: Quotation[] }>(`/quotations/rfqs/${rfqId}/comparison`),
      apiRequest<Attachment[]>(`/attachments/rfqs/${rfqId}`),
    ])
      .then(([data, attachmentData]) => { if (active) { setRfq(data.rfq); setQuotations(data.quotations); setAttachments(attachmentData); } })
      .catch((reason: unknown) => { if (active) setMessage(reason instanceof Error ? reason.message : 'دریافت اطلاعات انجام نشد.'); });
    return () => { active = false; };
  }, [rfqId]);

  async function accept(id: string) {
    if (!window.confirm('انتخاب این فروشنده را تأیید می‌کنید؟')) return;
    setBusyId(id); setMessage('');
    try { await apiRequest(`/quotations/${id}/accept`, { method: 'POST' }); setMessage('فروشنده منتخب ثبت شد.'); await load(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'ثبت انتخاب انجام نشد.'); }
    finally { setBusyId(''); }
  }

  async function downloadAttachment(id: string) {
    try {
      const data = await apiRequest<{ url: string }>(`/attachments/${id}/download-url`);
      window.location.assign(data.url);
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'دریافت فایل انجام نشد.');
    }
  }

  if (!rfq) return <div className="card">{message || 'در حال دریافت اطلاعات…'}</div>;
  return <div className="stack">
    <div><div className="eyebrow">{rfq.code}</div><h1>{rfq.title}</h1><p className="muted">{rfq.deliveryProvince ?? 'استان نامشخص'}، {rfq.deliveryCity ?? 'شهر نامشخص'} · {rfq.operationalStatus}</p></div>
    {message && <div className="message message-success">{message}</div>}
    <article className="card"><h2>اقلام درخواستی</h2><ul>{rfq.items.map((item) => <li key={item.id}>{item.category.nameFa} — {item.title} — {item.quantity} {item.unit.symbolFa}</li>)}</ul></article>
    <article className="card"><h2>پیوست‌ها</h2>
      {attachments.length === 0 && <p>فایلی به این استعلام پیوست نشده است.</p>}
      <div className="stack">{attachments.map((attachment) => <div className="list-card" key={attachment.id}>
        <span>{attachment.originalName} · {(attachment.sizeBytes / 1024 / 1024).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} مگابایت</span>
        {attachment.status === 'READY' ? <button type="button" className="button button-secondary" onClick={() => void downloadAttachment(attachment.id)}>دریافت امن</button> : <span className="muted">در انتظار بررسی امنیتی</span>}
      </div>)}</div>
    </article>
    <h2>مقایسه پیشنهادها</h2>
    {quotations.length === 0 && <div className="card">هنوز پیشنهاد قیمتی دریافت نشده است.</div>}
    <div className="comparison-grid">{quotations.map((quote) => <article className={`card quote-card ${quote.status === 'ACCEPTED' ? 'selected-card' : ''}`} key={quote.id}>
      <div className="eyebrow">{quote.code} · نسخه {quote.status}</div><h3>{quote.supplierOrganization.displayName}</h3>
      <strong className="price">{toman(quote.finalAmountRial)}</strong><p>مالیات: {toman(quote.taxRial)} · حمل: {toman(quote.shippingRial)}</p>
      <p>آماده‌سازی: {quote.preparationDays ?? '—'} روز · اعتبار تا: {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('fa-IR') : '—'}</p>
      <ul>{quote.items.map((item) => <li key={item.id}>{item.rfqItem.title}: {toman(item.unitPriceRial)} / واحد{item.isAlternative ? ' · جایگزین' : ''}</li>)}</ul>
      {quote.status === 'SUBMITTED' && <button className="button button-primary" disabled={busyId === quote.id} onClick={() => void accept(quote.id)}>انتخاب فروشنده</button>}
      {quote.status === 'ACCEPTED' && <div className="message message-success">فروشنده منتخب</div>}
    </article>)}</div>
    <p className="muted">قیمت اصلی بدون مالیات نمایش داده می‌شود؛ مالیات و هزینه‌های جانبی به‌صورت شفاف و جداگانه آمده‌اند.</p>
  </div>;
}
