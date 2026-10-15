'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { dashboardManagementLinks } from '@/lib/dashboard-access';
import type { RouteIdentity } from '@/lib/route-access';

type AuthenticatedAccount = RouteIdentity & { id: string; mobile: string; status: string };
type ReadinessSummary = { total: number; ready: number; warning: number; blocked: number; percent: number };
type ReadinessResponse = { generatedAt: string; ready: boolean; summary: ReadinessSummary };

export function AdminOverview() {
  const [account, setAccount] = useState<AuthenticatedAccount | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<AuthenticatedAccount>('/auth/me')
      .then(async (identity) => {
        if (!active) return;
        setAccount(identity);
        const canReadReadiness = identity.globalRoles.includes('SUPER_ADMIN')
          || identity.permissions.some((permission) => ['settings.read', 'settings.manage'].includes(permission));
        if (!canReadReadiness) return;
        const result = await apiRequest<ReadinessResponse>('/admin/config/release-readiness');
        if (active) setReadiness(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'دریافت اطلاعات مرکز مدیریت انجام نشد.');
      });
    return () => { active = false; };
  }, []);

  if (error) return <div className="message message-error" role="alert">{error}</div>;
  if (!account) return <div className="card" role="status">در حال آماده‌سازی مرکز مدیریت…</div>;

  const links = dashboardManagementLinks(account);

  return <div className="stack">
    {readiness && <section className="card readiness-score" aria-label="خلاصه آمادگی انتشار">
      <div className="readiness-score-heading"><div><span className="eyebrow">وضعیت امروز</span><h2>آمادگی انتشار MVP</h2></div><strong>{readiness.summary.percent.toLocaleString('fa-IR')}٪</strong></div>
      <div className="readiness-progress-track" role="progressbar" aria-label="آمادگی انتشار" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness.summary.percent}><span style={{ width: `${readiness.summary.percent}%` }} /></div>
      <p className={readiness.ready ? 'message message-success' : 'message message-error'}>{readiness.ready ? 'همه کنترل‌های الزامی انتشار آماده‌اند.' : `${readiness.summary.blocked.toLocaleString('fa-IR')} مانع انتشار باقی مانده است.`}</p>
      <div className="actions"><Link className="button button-primary" href="/admin/readiness">مشاهده جزئیات و رفع موانع</Link></div>
    </section>}

    <section className="admin-module-grid" aria-label="بخش‌های مدیریت">
      {links.map((item) => <Link className="card admin-module-card" href={item.href} key={item.href}>
        <span className="eyebrow">مدیریت</span>
        <h2>{item.label}</h2>
        <span className="admin-module-action">ورود به بخش ←</span>
      </Link>)}
    </section>
  </div>;
}
