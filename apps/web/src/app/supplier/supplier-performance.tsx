'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Performance = {
  organizationId: string;
  organizationName: string;
  verificationStatus: string;
  invitations: number;
  respondedOpportunities: number;
  wins: number;
  recentInvitations: number;
  responseRatePercent: number;
  winRatePercent: number;
  averageResponseHours: number | null;
  reviewCount: number;
  averageRating: number | null;
  availableCredits: string;
  subscription: null | { status: string; expiresAt: string | null; graceEndsAt: string | null; plan: { nameFa: string } };
};

type Quotation = {
  id: string;
  code: string;
  status: string;
  version: number;
  finalAmountRial: string;
  validUntil: string | null;
  createdAt: string;
  rfq: { id: string; code: string; title: string; responseDeadline: string | null };
};

const verificationLabels: Record<string, string> = {
  INCOMPLETE: 'ناقص', PENDING: 'در انتظار بررسی', VERIFIED: 'تأییدشده', NEEDS_CORRECTION: 'نیازمند اصلاح', REJECTED: 'ردشده', SUSPENDED: 'تعلیق‌شده',
};

const quotationStatusLabels: Record<string, string> = {
  DRAFT: 'پیش‌نویس', SUBMITTED: 'ارسال‌شده', REVISED: 'نسخه قبلی', WITHDRAWN: 'پس‌گرفته‌شده', ACCEPTED: 'منتخب خریدار', REJECTED: 'انتخاب‌نشده', EXPIRED: 'منقضی',
};

export function SupplierPerformance() {
  const [items, setItems] = useState<Performance[]>([]);
  const [quotations, setQuotations] = useState<Record<string, Quotation[]>>({});
  const [error, setError] = useState('');
  const [busyQuotationId, setBusyQuotationId] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<Performance[]>('/suppliers/performance')
      .then(async (data) => {
        const proposalLists = await Promise.all(data.map(async (item) => [item.organizationId, await apiRequest<Quotation[]>(`/quotations/mine?organizationId=${encodeURIComponent(item.organizationId)}`)] as const));
        if (active) { setItems(data); setQuotations(Object.fromEntries(proposalLists)); }
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت آمار عملکرد انجام نشد.'); });
    return () => { active = false; };
  }, []);

  if (error) return <div className="message message-error">{error}</div>;
  if (items.length === 0) return null;

  async function submitDraft(quotationId: string, organizationId: string) {
    setBusyQuotationId(quotationId); setError('');
    try {
      const updated = await apiRequest<Quotation>(`/quotations/${quotationId}/submit`, { method: 'POST' });
      setQuotations((current) => ({
        ...current,
        [organizationId]: (current[organizationId] ?? []).map((quotation) => quotation.id === quotationId ? { ...quotation, ...updated } : quotation),
      }));
    }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'ارسال پیشنهاد انجام نشد.'); }
    finally { setBusyQuotationId(''); }
  }

  return <div className="stack">{items.map((item) => <article className="card" key={item.organizationId}>
    <div className="admin-card-title"><div><div className="eyebrow">عملکرد فروشنده</div><h2>{item.organizationName}</h2></div><div><strong>{verificationLabels[item.verificationStatus] ?? item.verificationStatus}</strong><p className="muted">{item.subscription ? `${item.subscription.plan.nameFa} · ${item.subscription.status}` : 'بدون اشتراک فعال'}</p></div></div>
    <div className="dashboard-grid">
      <div><span className="muted">فرصت‌های دریافت‌شده</span><h3>{item.invitations.toLocaleString('fa-IR')}</h3><small>{item.recentInvitations.toLocaleString('fa-IR')} مورد در ۳۰ روز اخیر</small></div>
      <div><span className="muted">نرخ پاسخ‌گویی</span><h3>{item.responseRatePercent.toLocaleString('fa-IR')}٪</h3><small>{item.respondedOpportunities.toLocaleString('fa-IR')} فرصت پاسخ‌داده‌شده</small></div>
      <div><span className="muted">نرخ انتخاب</span><h3>{item.winRatePercent.toLocaleString('fa-IR')}٪</h3><small>{item.wins.toLocaleString('fa-IR')} پیشنهاد منتخب</small></div>
      <div><span className="muted">میانگین زمان پاسخ</span><h3>{item.averageResponseHours === null ? '—' : `${item.averageResponseHours.toLocaleString('fa-IR')} ساعت`}</h3></div>
      <div><span className="muted">رضایت خریداران</span><h3>{item.averageRating === null ? '—' : `${item.averageRating.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} از ۵`}</h3><small>{item.reviewCount.toLocaleString('fa-IR')} ارزیابی خرید معتبر</small></div>
      <div><span className="muted">اعتبار قابل مصرف</span><h3>{BigInt(item.availableCredits).toLocaleString('fa-IR')}</h3></div>
      <div><span className="muted">اعتبار اشتراک</span><h3>{item.subscription?.expiresAt ? new Date(item.subscription.expiresAt).toLocaleDateString('fa-IR') : '—'}</h3></div>
    </div>
    <div className="stack">
      <div className="admin-card-title"><div><h3>پیشنهادهای ثبت‌شده</h3><p className="muted">آخرین ۱۰۰ نسخه برای پیگیری و ادامه پیش‌نویس‌ها</p></div></div>
      {(quotations[item.organizationId] ?? []).length === 0 && <div className="empty-state">هنوز پیشنهادی با این حساب فروشنده ثبت نشده است.</div>}
      {(quotations[item.organizationId] ?? []).map((quotation) => <div className="list-card" key={quotation.id}>
        <div><div className="eyebrow">{quotation.rfq.code} · نسخه {quotation.version.toLocaleString('fa-IR')}</div><strong>{quotation.rfq.title}</strong><p className="muted">{quotation.code} · {quotationStatusLabels[quotation.status] ?? quotation.status} · {(BigInt(quotation.finalAmountRial) / BigInt(10)).toLocaleString('fa-IR')} تومان</p></div>
        <div className="list-card-actions">
          {quotation.status === 'DRAFT' && <button className="button button-primary" type="button" disabled={busyQuotationId === quotation.id} onClick={() => void submitDraft(quotation.id, item.organizationId)}>{busyQuotationId === quotation.id ? 'در حال ارسال…' : 'ارسال پیش‌نویس'}</button>}
          {quotation.status === 'SUBMITTED' && <Link className="button button-secondary" href={`/supplier/rfqs/${quotation.rfq.id}/quote?organizationId=${item.organizationId}`}>ثبت نسخه جدید</Link>}
          <Link className="button button-secondary" href={`/messages?rfq=${quotation.rfq.id}&supplier=${item.organizationId}` as Route}>پیام درباره استعلام</Link>
        </div>
      </div>)}
    </div>
  </article>)}</div>;
}
