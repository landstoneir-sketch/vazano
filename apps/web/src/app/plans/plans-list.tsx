'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Plan = { id: string; nameFa: string; durationIso: string; priceRial: string; grantCredits: string; dailyProposalLimit: number; maxProposalLimit: number; isTrial: boolean };

function formatToman(rial: string): string {
  return (BigInt(rial) / BigInt(10)).toLocaleString('fa-IR');
}

export function PlansList() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { void apiRequest<Plan[]>('/subscriptions/plans').then(setPlans).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'دریافت پلن‌ها انجام نشد.')); }, []);
  if (error) return <div className="message message-error">{error}</div>;
  if (plans.length === 0) return <div className="card">در حال دریافت پلن‌ها…</div>;
  return <div className="plan-grid">{plans.map((plan) => <article className="card plan-card" key={plan.id}><h2>{plan.nameFa}</h2><strong>{plan.isTrial ? 'رایگان' : `${formatToman(plan.priceRial)} تومان`}</strong><p>{BigInt(plan.grantCredits).toLocaleString('fa-IR')} اعتبار</p><p>{plan.isTrial ? `مدت آزمایش: ${Number(plan.durationIso.match(/^P(\d+)D$/)?.[1] ?? 0).toLocaleString('fa-IR')} روز` : `سقف پایه: ${plan.dailyProposalLimit.toLocaleString('fa-IR')} پیشنهاد موفق روزانه`}</p><small>{plan.isTrial ? 'هر سازمان فروشنده فقط یک‌بار می‌تواند این دوره را فعال کند.' : `افزایش قاعده‌مند در کمبود عرضه تا ${plan.maxProposalLimit.toLocaleString('fa-IR')} پیشنهاد`}</small></article>)}</div>;
}
