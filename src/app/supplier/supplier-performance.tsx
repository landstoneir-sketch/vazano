'use client';

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

const verificationLabels: Record<string, string> = {
  INCOMPLETE: 'ناقص', PENDING: 'در انتظار بررسی', VERIFIED: 'تأییدشده', NEEDS_CORRECTION: 'نیازمند اصلاح', REJECTED: 'ردشده', SUSPENDED: 'تعلیق‌شده',
};

export function SupplierPerformance() {
  const [items, setItems] = useState<Performance[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<Performance[]>('/suppliers/performance')
      .then((data) => { if (active) setItems(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت آمار عملکرد انجام نشد.'); });
    return () => { active = false; };
  }, []);

  if (error) return <div className="message message-error">{error}</div>;
  if (items.length === 0) return null;

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
  </article>)}</div>;
}
