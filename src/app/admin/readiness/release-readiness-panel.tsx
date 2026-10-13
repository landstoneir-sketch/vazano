'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type CheckStatus = 'READY' | 'WARNING' | 'BLOCKED';
type ReadinessCheck = { key: string; title: string; status: CheckStatus; detail: string; actionPath?: string };
type ReadinessResponse = { generatedAt: string; ready: boolean; checks: ReadinessCheck[] };

const statusLabels: Record<CheckStatus, string> = { READY: 'آماده', WARNING: 'هشدار', BLOCKED: 'مسدود' };
const statusClasses: Record<CheckStatus, string> = { READY: 'severity-low', WARNING: 'severity-medium', BLOCKED: 'severity-critical' };

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

  const readyCount = result.checks.filter((item) => item.status === 'READY').length;
  const warningCount = result.checks.filter((item) => item.status === 'WARNING').length;
  const blockedCount = result.checks.filter((item) => item.status === 'BLOCKED').length;

  return <div className="stack">
    <div className={result.ready ? 'message message-success' : 'message message-error'}>{result.ready ? 'همه پیش‌نیازهای الزامی انتشار آماده‌اند.' : `${blockedCount.toLocaleString('fa-IR')} مانع انتشار باید برطرف شود.`}</div>
    <div className="dashboard-grid">
      <article className="card billing-summary-card"><span>آماده</span><strong>{readyCount.toLocaleString('fa-IR')}</strong></article>
      <article className="card billing-summary-card"><span>هشدار</span><strong>{warningCount.toLocaleString('fa-IR')}</strong></article>
      <article className="card billing-summary-card"><span>مسدود</span><strong>{blockedCount.toLocaleString('fa-IR')}</strong></article>
    </div>
    <div className="stack">{result.checks.map((item) => <article className="card admin-card-title" key={item.key}><div><h2>{item.title}</h2><p>{item.detail}</p><code>{item.key}</code></div><div><span className={`status-badge ${statusClasses[item.status]}`}>{statusLabels[item.status]}</span>{item.actionPath && <div><Link className="button button-ghost" href={item.actionPath as Route}>رفع مانع</Link></div>}</div></article>)}</div>
    <p className="muted">آخرین کنترل: {new Date(result.generatedAt).toLocaleString('fa-IR')}</p>
  </div>;
}
