'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type Rfq = {
  id: string;
  code: string;
  title: string;
  lifecycleState: string;
  operationalStatus: string;
  approvalStatus: string;
  createdAt: string;
  _count: { quotations: number };
};

export function RfqList() {
  const [items, setItems] = useState<Rfq[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void apiRequest<Rfq[]>('/rfqs/mine').then((data) => { if (active) setItems(data); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت استعلام‌ها انجام نشد.');
    });
    return () => { active = false; };
  }, []);

  return <div className="stack">
    {error && <div className="message message-error">{error}</div>}
    <div className="actions"><Link className="button button-primary" href="/dashboard/rfqs/new">ثبت استعلام جدید</Link></div>
    {items.length === 0 && !error && <div className="card">هنوز استعلامی ثبت نشده است.</div>}
    {items.map((rfq) => <article className="card list-card" key={rfq.id}>
      <div><div className="eyebrow">{rfq.code}</div><h2>{rfq.title}</h2><p>وضعیت: {rfq.operationalStatus} · تأیید: {rfq.approvalStatus}</p></div>
      <div className="list-card-actions"><span className="count-badge">{rfq._count.quotations} پیشنهاد</span>{rfq.lifecycleState === 'DRAFT' && ['DRAFT_INCOMPLETE', 'NEEDS_CHANGES'].includes(rfq.operationalStatus) && <Link className="button button-primary" href={`/dashboard/rfqs/new?edit=${rfq.id}`}>ادامه و ویرایش</Link>}<Link className="button button-secondary" href={`/dashboard/rfqs/${rfq.id}`}>مشاهده و مقایسه</Link></div>
    </article>)}
  </div>;
}
