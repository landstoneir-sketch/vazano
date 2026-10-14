'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Plan = { id: string; nameFa: string; descriptionFa?: string | null; billingCycle?: string; durationIso: string; priceRial: string; grantCredits: string; dailyProposalLimit: number; maxProposalLimit: number; isTrial: boolean };

function formatToman(rial: string): string {
  return (BigInt(rial) / BigInt(10)).toLocaleString('fa-IR');
}

export function PlansList() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { void apiRequest<Plan[]>('/subscriptions/plans').then(setPlans).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'دریافت پلن‌ها انجام نشد.')); }, []);
  if (error) return <div className="message message-error">{error}</div>;
  if (plans.length === 0) return <div className="card">در حال دریافت پلن‌ها…</div>;
  return <><div className="plan-grid public-plan-grid">{plans.map((plan) => <article className={`card plan-card public-plan-card ${plan.isTrial ? 'plan-card-trial' : ''}`} key={plan.id}>
    <div className="plan-card-heading"><h2>{plan.nameFa}</h2>{plan.isTrial && <span className="status-badge">آزمایشی</span>}</div>
    <strong>{plan.isTrial ? 'رایگان' : `${formatToman(plan.priceRial)} تومان`}</strong>
    <span className="plan-cycle">مدت اعتبار: {durationLabel(plan.durationIso)}</span>
    <p>{plan.descriptionFa || 'دسترسی به فرصت‌های فروش و مدیریت پیشنهادهای قیمت'}</p>
    <ul className="plan-features"><li>{BigInt(plan.grantCredits).toLocaleString('fa-IR')} اعتبار قابل مصرف</li><li>{plan.isTrial ? 'فعال‌سازی بدون پرداخت' : `${plan.dailyProposalLimit.toLocaleString('fa-IR')} پیشنهاد موفق روزانه`}</li><li>{plan.isTrial ? 'یک‌بار برای هر سازمان' : `سقف افزایش‌یافته تا ${plan.maxProposalLimit.toLocaleString('fa-IR')} پیشنهاد`}</li></ul>
    <Link className={`button ${plan.isTrial ? 'button-secondary' : 'button-primary'}`} href="/supplier/subscription">{plan.isTrial ? 'شروع دوره آزمایشی' : 'انتخاب این پلن'}</Link>
  </article>)}</div><p className="plans-footnote">پرداخت پلن‌های پولی پس از نمایش مبلغ نهایی و تأیید شما از طریق زرین‌پال انجام می‌شود. خرید اشتراک هیچ اولویتی در انتخاب برنده ایجاد نمی‌کند.</p></>;
}

function durationLabel(durationIso: string): string {
  const days = durationIso.match(/^P(\d+)D$/)?.[1];
  if (days) return `${Number(days).toLocaleString('fa-IR')} روز`;
  const months = durationIso.match(/^P(\d+)M$/)?.[1];
  if (months) return `${Number(months).toLocaleString('fa-IR')} ماه`;
  const years = durationIso.match(/^P(\d+)Y$/)?.[1];
  if (years) return `${Number(years).toLocaleString('fa-IR')} سال`;
  return durationIso;
}
