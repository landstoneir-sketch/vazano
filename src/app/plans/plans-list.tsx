'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Plan = { id: string; nameFa: string; durationIso: string; priceRial: string; grantCredits: string; dailyProposalLimit: number; maxProposalLimit: number };

function formatToman(rial: string): string {
  return (BigInt(rial) / BigInt(10)).toLocaleString('fa-IR');
}

export function PlansList() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { void apiRequest<Plan[]>('/subscriptions/plans').then(setPlans).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'دریافت پلن‌ها انجام نشد.')); }, []);
  if (error) return <div className="message message-error">{error}</div>;
  if (plans.length === 0) return <div className="card">در حال دریافت پلن‌ها…</div>;
  return <div className="plan-grid">{plans.map((plan) => <article className="card plan-card" key={plan.id}><h2>{plan.nameFa}</h2><strong>{formatToman(plan.priceRial)} تومان</strong><p>{BigInt(plan.grantCredits).toLocaleString('fa-IR')} اعتبار</p><p>سقف پایه: {plan.dailyProposalLimit.toLocaleString('fa-IR')} پیشنهاد موفق روزانه</p><small>افزایش قاعده‌مند در کمبود عرضه تا {plan.maxProposalLimit.toLocaleString('fa-IR')} پیشنهاد</small></article>)}</div>;
}
