'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import { formatProductSpecifications, type ProductAttributeBinding, type ProductSpecifications } from '../../../lib/product-specifications';

type RfqItem = { id: string; title: string; quantity: string; specifications: ProductSpecifications; category: { nameFa: string; attributeBindings: ProductAttributeBinding[] }; unit: { symbolFa: string } };
type ReviewRfq = { id: string; code: string; title: string; source: string; approvalStatus: string; operationalStatus: string; deliveryProvince: string | null; deliveryCity: string | null; qualityControlRequested: boolean; commitmentStatus: string; buyerOrganization: { displayName: string }; items: RfqItem[] };

export function ReviewQueue() {
  const [items, setItems] = useState<ReviewRfq[]>([]);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  async function load() {
    try { setItems(await apiRequest<ReviewRfq[]>('/rfqs/admin/review-queue')); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'دریافت صف بررسی انجام نشد.'); }
  }
  useEffect(() => {
    let active = true;
    void apiRequest<ReviewRfq[]>('/rfqs/admin/review-queue')
      .then((data) => { if (active) setItems(data); })
      .catch((reason: unknown) => { if (active) setMessage(reason instanceof Error ? reason.message : 'دریافت صف بررسی انجام نشد.'); });
    return () => { active = false; };
  }, []);

  async function decide(id: string, decision: 'APPROVE' | 'NEEDS_CHANGES') {
    setBusyId(id); setMessage('');
    try {
      await apiRequest(`/rfqs/${id}/review`, { method: 'POST', body: JSON.stringify({ decision, ...(decision === 'NEEDS_CHANGES' ? { reason: 'نیازمند تکمیل اطلاعات فنی است.' } : {}) }) });
      setMessage(decision === 'APPROVE' ? 'استعلام تأیید شد و وارد گیت تعهد مالی شد.' : 'استعلام برای اصلاح بازگردانده شد.');
      await load();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'ثبت تصمیم انجام نشد.'); }
    finally { setBusyId(''); }
  }

  async function publish(id: string) {
    setBusyId(id); setMessage('');
    try {
      const result = await apiRequest<{ invitedSupplierCount: number }>(`/rfqs/${id}/publish`, { method: 'POST' });
      setMessage(`استعلام منتشر شد و برای ${result.invitedSupplierCount.toLocaleString('fa-IR')} فروشنده واجد شرایط ارسال شد.`);
      await load();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'انتشار استعلام انجام نشد.'); }
    finally { setBusyId(''); }
  }

  return <div className="stack">
    {message && <div className="message">{message}</div>}
    {items.length === 0 && <div className="card">استعلامی در صف بررسی نیست.</div>}
    {items.map((rfq) => <article className="card" key={rfq.id}>
      <div className="eyebrow">{rfq.code} · {rfq.source === 'PLATFORM_OPERATOR' ? 'ثبت اپراتور' : 'ثبت خریدار'}</div>
      <h2>{rfq.title}</h2><p>{rfq.buyerOrganization.displayName} · {rfq.deliveryProvince ?? '—'}، {rfq.deliveryCity ?? '—'}</p>
      <ul>{rfq.items.map((item) => {
        const details = formatProductSpecifications(item.specifications, item.category.attributeBindings);
        return <li key={item.id}>{item.category.nameFa} — {item.title} — {item.quantity} {item.unit.symbolFa}{details.length > 0 && <div className="specification-summary">{details.map((detail) => <span key={detail.code}>{detail.label}: {detail.value}</span>)}</div>}</li>;
      })}</ul>
      <p>کنترل کیفیت: {rfq.qualityControlRequested ? 'درخواست شده با کارمزد ۳٪' : 'درخواست نشده'} · تعهد خریدار: {rfq.commitmentStatus}</p>
      <div className="actions">
        {rfq.approvalStatus === 'PENDING' && <><button className="button button-primary" disabled={busyId === rfq.id} onClick={() => void decide(rfq.id, 'APPROVE')}>تأیید</button><button className="button button-secondary" disabled={busyId === rfq.id} onClick={() => void decide(rfq.id, 'NEEDS_CHANGES')}>بازگشت برای اصلاح</button></>}
        {rfq.approvalStatus === 'APPROVED' && rfq.operationalStatus === 'READY_TO_PUBLISH' && <button className="button button-primary" disabled={busyId === rfq.id} onClick={() => void publish(rfq.id)}>انتشار و توزیع</button>}
        {rfq.operationalStatus === 'WAITING_COMMITMENT' && <span className="count-badge">منتظر تکمیل تعهد خریدار</span>}
      </div>
    </article>)}
  </div>;
}
