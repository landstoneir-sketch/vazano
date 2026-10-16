'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type CheckStatus = 'READY' | 'WARNING' | 'BLOCKED';
type CheckResponsibility = 'OWNER' | 'TECHNICAL' | 'OPERATIONS';
type ReadinessCheck = { key: string; title: string; status: CheckStatus; responsibility: CheckResponsibility; detail: string; actionPath?: string };
type ReadinessSummary = { total: number; ready: number; warning: number; blocked: number; ownerDecisionRequired: number; percent: number };
type ReadinessResponse = { generatedAt: string; ready: boolean; summary: ReadinessSummary; checks: ReadinessCheck[] };

const statusLabels: Record<CheckStatus, string> = { READY: 'آماده', WARNING: 'هشدار', BLOCKED: 'مسدود' };
const statusClasses: Record<CheckStatus, string> = { READY: 'severity-low', WARNING: 'severity-medium', BLOCKED: 'severity-critical' };
const responsibilityLabels: Record<CheckResponsibility, string> = { OWNER: 'تصمیم مالک', TECHNICAL: 'اقدام فنی', OPERATIONS: 'اقدام عملیاتی' };

export function ReleaseReadinessPanel() {
  const [result, setResult] = useState<ReadinessResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<ReadinessResponse>('/admin/config/release-readiness')
      .then((data) => { if (active) setResult(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'کنترل آمادگی انتشار انجام نشد.'); });
    return () => { active = false; };
  }, []);

  if (error) return <div className="message message-error">{error}</div>;
  if (!result) return <div className="card">در حال کنترل پیش‌نیازهای انتشار…</div>;

  const orderedChecks = [...result.checks].sort((left, right) => statusPriority(left.status) - statusPriority(right.status));

  return <div className="stack">
    <section className="card readiness-score" aria-label="درصد آمادگی انتشار">
      <div className="readiness-score-heading"><div><span className="eyebrow">شاخص اجرایی</span><h2>آمادگی انتشار MVP</h2></div><strong>{result.summary.percent.toLocaleString('fa-IR')}٪</strong></div>
      <div className="readiness-progress-track" role="progressbar" aria-label="درصد آمادگی انتشار" aria-valuemin={0} aria-valuemax={100} aria-valuenow={result.summary.percent}><span style={{ width: `${result.summary.percent}%` }} /></div>
      <p className="muted">این درصد فقط پیش‌نیازهای قابل‌کنترل انتشار را نشان می‌دهد و با درصد تکمیل کل محصول یکسان نیست.</p>
    </section>
    <div className={result.ready ? 'message message-success' : 'message message-error'}>{result.ready ? 'همه پیش‌نیازهای الزامی انتشار آماده‌اند.' : `${result.summary.blocked.toLocaleString('fa-IR')} مانع انتشار باید برطرف شود.`}</div>
    <div className="dashboard-grid">
      <article className="card billing-summary-card"><span>آماده</span><strong>{result.summary.ready.toLocaleString('fa-IR')}</strong></article>
      <article className="card billing-summary-card"><span>هشدار</span><strong>{result.summary.warning.toLocaleString('fa-IR')}</strong></article>
      <article className="card billing-summary-card"><span>مسدود</span><strong>{result.summary.blocked.toLocaleString('fa-IR')}</strong></article>
      <article className="card billing-summary-card"><span>نیازمند تصمیم مالک</span><strong>{result.summary.ownerDecisionRequired.toLocaleString('fa-IR')}</strong></article>
    </div>
    <div className="stack">{orderedChecks.map((item) => <article className="card admin-card-title" key={item.key}><div><h2>{item.title}</h2><p>{item.detail}</p><code>{item.key}</code></div><div><span className={`status-badge ${statusClasses[item.status]}`}>{statusLabels[item.status]}</span><p className="muted">{responsibilityLabels[item.responsibility]}</p>{item.actionPath && item.status !== 'READY' && <div><Link className="button button-ghost" href={item.actionPath as Route}>رفع مانع</Link></div>}</div></article>)}</div>
    <p className="muted">آخرین کنترل: {new Date(result.generatedAt).toLocaleString('fa-IR')}</p>
  </div>;
}

function statusPriority(status: CheckStatus): number {
  return status === 'BLOCKED' ? 0 : status === 'WARNING' ? 1 : 2;
}
