'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Invitation = {
  id: string;
  status: string;
  supplierOrganization: { id: string; displayName: string };
  rfq: { id: string; code: string; title: string; responseDeadline: string | null; deliveryProvince: string | null; deliveryCity: string | null; items: Array<{ id: string; title: string; quantity: string; category: { nameFa: string }; unit: { symbolFa: string } }>; quotations: Array<{ id: string; status: string }> };
};

export function MatchedRfqs() {
  const [items, setItems] = useState<Invitation[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void apiRequest<Invitation[]>('/rfqs/matched').then((data) => { if (active) setItems(data); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت استعلام‌ها انجام نشد.');
    });
    return () => { active = false; };
  }, []);
  return <div className="stack">
    {error && <div className="message message-error">{error}</div>}
    {items.length === 0 && !error && <div className="card">فعلاً استعلام متناسبی برای حساب‌های فروشنده شما وجود ندارد.</div>}
    {items.map((invitation) => <article className="card" key={invitation.id}>
      <div className="eyebrow">{invitation.rfq.code} · برای {invitation.supplierOrganization.displayName}</div><h2>{invitation.rfq.title}</h2>
      <p>{invitation.rfq.deliveryProvince ?? '—'}، {invitation.rfq.deliveryCity ?? '—'} · مهلت: {invitation.rfq.responseDeadline ? new Date(invitation.rfq.responseDeadline).toLocaleDateString('fa-IR') : 'تعیین نشده'}</p>
      <ul>{invitation.rfq.items.map((item) => <li key={item.id}>{item.category.nameFa} — {item.quantity} {item.unit.symbolFa}</li>)}</ul>
      <Link className="button button-primary" href={`/supplier/rfqs/${invitation.rfq.id}/quote?organizationId=${invitation.supplierOrganization.id}`}>{invitation.rfq.quotations.length ? 'ثبت نسخه جدید پیشنهاد' : 'ثبت پیشنهاد قیمت'}</Link>
    </article>)}
  </div>;
}
