'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { formatProductSpecifications, type ProductAttributeBinding, type ProductSpecifications } from '../../lib/product-specifications';

type Invitation = {
  id: string;
  status: string;
  supplierOrganization: { id: string; displayName: string };
  rfq: { id: string; code: string; title: string; responseDeadline: string | null; deliveryProvince: string | null; deliveryCity: string | null; items: Array<{ id: string; title: string; quantity: string; specifications: ProductSpecifications; category: { nameFa: string; attributeBindings: ProductAttributeBinding[] }; unit: { symbolFa: string } }>; quotations: Array<{ id: string; status: string }> };
};

export function MatchedRfqs() {
  const [items, setItems] = useState<Invitation[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyInvitationId, setBusyInvitationId] = useState('');
  useEffect(() => {
    let active = true;
    void apiRequest<Invitation[]>('/rfqs/matched').then((data) => { if (active) setItems(data); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت استعلام‌ها انجام نشد.');
    });
    return () => { active = false; };
  }, []);

  async function decline(invitation: Invitation) {
    if (!window.confirm('این فرصت از فهرست شما حذف شود؟ سابقه رد دعوت برای گزارش‌های عملیاتی حفظ می‌شود.')) return;
    setBusyInvitationId(invitation.id); setError(''); setMessage('');
    try {
      await apiRequest(`/rfqs/invitations/${invitation.id}/decline`, { method: 'POST' });
      setItems((current) => current.filter((item) => item.id !== invitation.id));
      setMessage('دعوت استعلام رد شد و از فهرست فرصت‌های فعال حذف شد.');
    }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'رد دعوت استعلام انجام نشد.'); }
    finally { setBusyInvitationId(''); }
  }

  return <div className="stack">
    {error && <div className="message message-error">{error}</div>}
    {message && <div className="message message-success">{message}</div>}
    {items.length === 0 && !error && <div className="card">فعلاً استعلام متناسبی برای حساب‌های فروشنده شما وجود ندارد.</div>}
    {items.map((invitation) => <article className="card opportunity-card" key={invitation.id}>
      <div className="eyebrow">{invitation.rfq.code} · برای {invitation.supplierOrganization.displayName}</div><h2>{invitation.rfq.title}</h2>
      <p>{invitation.rfq.deliveryProvince ?? '—'}، {invitation.rfq.deliveryCity ?? '—'} · مهلت: {invitation.rfq.responseDeadline ? new Date(invitation.rfq.responseDeadline).toLocaleDateString('fa-IR') : 'تعیین نشده'}</p>
      <ul>{invitation.rfq.items.map((item) => {
        const details = formatProductSpecifications(item.specifications, item.category.attributeBindings);
        return <li key={item.id}>{item.category.nameFa} — {item.quantity} {item.unit.symbolFa}{details.length > 0 && <div className="specification-summary">{details.map((detail) => <span key={detail.code}>{detail.label}: {detail.value}</span>)}</div>}</li>;
      })}</ul>
      <div className="list-card-actions"><Link className="button button-primary" href={`/supplier/rfqs/${invitation.rfq.id}/quote?organizationId=${invitation.supplierOrganization.id}`}>{invitation.rfq.quotations.length ? 'ثبت نسخه جدید پیشنهاد' : 'ثبت پیشنهاد قیمت'}</Link><Link className="button button-secondary" href={`/messages?rfq=${invitation.rfq.id}&supplier=${invitation.supplierOrganization.id}` as Route}>پیام درباره استعلام</Link>{invitation.rfq.quotations.length === 0 && <button className="button button-ghost" type="button" disabled={busyInvitationId === invitation.id} onClick={() => void decline(invitation)}>{busyInvitationId === invitation.id ? 'در حال ثبت…' : 'رد این فرصت'}</button>}</div>
    </article>)}
  </div>;
}
