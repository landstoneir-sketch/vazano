'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Overview = {
  generatedAt: string;
  windowDays: number;
  totals: {
    users: number; buyerOrganizations: number; supplierOrganizations: number; verifiedSuppliers: number;
    rfqs: number; quotations: number; activeSubscriptions: number; subscriptionRevenueRial: string;
  };
  recent: { newUsers: number; rfqs: number; quotations: number; acceptedQuotations: number; subscriptions: number; subscriptionRevenueRial: string };
  rfqFunnel: { draftAndReview: number; openForQuotes: number; hasQuotes: number; sellerSelected: number; cancelledOrExpired: number; selectionConversionPercent: number };
  qualityControl: Record<string, number>;
  contracts: Record<string, number>;
  topCategories: Array<{ categoryId: string; nameFa: string; rfqItemCount: number }>;
};

function toman(value: string) {
  return `${(BigInt(value) / BigInt(10)).toLocaleString('fa-IR')} تومان`;
}

function count(items: Record<string, number>, ...statuses: string[]) {
  return statuses.reduce((total, status) => total + (items[status] ?? 0), 0);
}

export function ReportsOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<Overview>('/admin/reports/overview')
      .then((data) => { if (active) setOverview(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت گزارش مدیریتی انجام نشد.'); });
    return () => { active = false; };
  }, []);

  if (error) return <div className="message message-error">{error}</div>;
  if (!overview) return <div className="card">در حال محاسبه شاخص‌های اجرایی…</div>;

  const funnel = [
    ['پیش‌نویس و بررسی', overview.rfqFunnel.draftAndReview],
    ['باز برای پیشنهاد', overview.rfqFunnel.openForQuotes],
    ['دارای پیشنهاد', overview.rfqFunnel.hasQuotes],
    ['فروشنده منتخب', overview.rfqFunnel.sellerSelected],
    ['لغو یا منقضی', overview.rfqFunnel.cancelledOrExpired],
  ] as const;

  return <div className="stack">
    <div className="dashboard-grid">
      <article className="card billing-summary-card"><span>کل استعلام‌ها</span><strong>{overview.totals.rfqs.toLocaleString('fa-IR')}</strong></article>
      <article className="card billing-summary-card"><span>فروشندگان تأییدشده</span><strong>{overview.totals.verifiedSuppliers.toLocaleString('fa-IR')}</strong></article>
      <article className="card billing-summary-card"><span>اشتراک فعال</span><strong>{overview.totals.activeSubscriptions.toLocaleString('fa-IR')}</strong></article>
      <article className="card billing-summary-card"><span>کل پیشنهادها</span><strong>{overview.totals.quotations.toLocaleString('fa-IR')}</strong></article>
      <article className="card billing-summary-card"><span>نرخ انتخاب فروشنده</span><strong>{overview.rfqFunnel.selectionConversionPercent.toLocaleString('fa-IR')}٪</strong></article>
      <article className="card billing-summary-card"><span>درآمد موفق اشتراک</span><strong>{toman(overview.totals.subscriptionRevenueRial)}</strong></article>
    </div>

    <article className="card"><div className="admin-card-title"><div><h2>عملکرد ۳۰ روز اخیر</h2><p>داده‌های واقعی ثبت‌شده در سامانه</p></div><time>{new Date(overview.generatedAt).toLocaleString('fa-IR')}</time></div>
      <div className="dashboard-grid">
        <div><span className="muted">کاربر جدید</span><h3>{overview.recent.newUsers.toLocaleString('fa-IR')}</h3></div>
        <div><span className="muted">استعلام جدید</span><h3>{overview.recent.rfqs.toLocaleString('fa-IR')}</h3></div>
        <div><span className="muted">پیشنهاد قیمت</span><h3>{overview.recent.quotations.toLocaleString('fa-IR')}</h3></div>
        <div><span className="muted">انتخاب فروشنده</span><h3>{overview.recent.acceptedQuotations.toLocaleString('fa-IR')}</h3></div>
        <div><span className="muted">اشتراک جدید</span><h3>{overview.recent.subscriptions.toLocaleString('fa-IR')}</h3></div>
        <div><span className="muted">درآمد اشتراک</span><h3>{toman(overview.recent.subscriptionRevenueRial)}</h3></div>
      </div>
    </article>

    <div className="comparison-grid">
      <article className="card"><h2>قیف استعلام</h2><div className="stack">{funnel.map(([label, value]) => <div className="list-card" key={label}><span>{label}</span><strong>{value.toLocaleString('fa-IR')}</strong></div>)}</div></article>
      <article className="card"><h2>خدمات تکمیلی</h2><div className="stack">
        <div className="list-card"><span>کنترل کیفیت فعال</span><strong>{count(overview.qualityControl, 'ACCEPTED', 'IN_PROGRESS').toLocaleString('fa-IR')}</strong></div>
        <div className="list-card"><span>کنترل کیفیت تکمیل‌شده</span><strong>{count(overview.qualityControl, 'COMPLETED').toLocaleString('fa-IR')}</strong></div>
        <div className="list-card"><span>قرارداد در جریان</span><strong>{count(overview.contracts, 'REQUESTED', 'UNDER_REVIEW', 'TERMS_PREPARED', 'ACCEPTED').toLocaleString('fa-IR')}</strong></div>
        <div className="list-card"><span>هماهنگی قرارداد تکمیل‌شده</span><strong>{count(overview.contracts, 'COMPLETED').toLocaleString('fa-IR')}</strong></div>
      </div></article>
      <article className="card"><h2>دسته‌های پرتکرار ۳۰ روز اخیر</h2><div className="stack">
        {overview.topCategories.length === 0 && <p className="muted">هنوز داده کافی ثبت نشده است.</p>}
        {overview.topCategories.map((item) => <div className="list-card" key={item.categoryId}><span>{item.nameFa}</span><strong>{item.rfqItemCount.toLocaleString('fa-IR')}</strong></div>)}
      </div></article>
    </div>
    <p className="muted">سازمان‌ها: {overview.totals.buyerOrganizations.toLocaleString('fa-IR')} خریدار و {overview.totals.supplierOrganizations.toLocaleString('fa-IR')} فروشنده · کاربران: {overview.totals.users.toLocaleString('fa-IR')}</p>
  </div>;
}
