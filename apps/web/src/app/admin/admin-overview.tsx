'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { dashboardManagementLinks } from '@/lib/dashboard-access';
import type { RouteIdentity } from '@/lib/route-access';

type AuthenticatedAccount = RouteIdentity & { id: string; mobile: string; status: string };
type ReadinessSummary = {
  total: number;
  ready: number;
  warning: number;
  blocked: number;
  ownerDecisionRequired: number;
  technicalActionsRequired: number;
  operationsActionsRequired: number;
  pilotBlockers: number;
  percent: number;
};
type ReadinessResponse = { generatedAt: string; ready: boolean; pilotReady: boolean; summary: ReadinessSummary };
type DeliveryPhase = { key: string; title: string; previousPercent: number; plannedPercent: number; actualPercent: number; changeFromPrevious: number; variance: number; status: 'COMPLETE' | 'ON_TRACK' | 'AT_RISK' };
type DeliveryProgress = {
  previousPercent: number;
  actualPercent: number;
  plannedPercent: number;
  changeFromPrevious: number;
  varianceFromPlan: number;
  scheduleStatus: 'ON_TRACK' | 'AT_RISK';
  estimates: { pilot: { minWorkingDays: number; maxWorkingDays: number }; release: { minWorkingDays: number; maxWorkingDays: number } };
  phases: DeliveryPhase[];
};

export function AdminOverview() {
  const [account, setAccount] = useState<AuthenticatedAccount | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [delivery, setDelivery] = useState<DeliveryProgress | null>(null);
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
        const [readinessResult, deliveryResult] = await Promise.all([
          apiRequest<ReadinessResponse>('/admin/config/release-readiness'),
          apiRequest<DeliveryProgress>('/admin/config/delivery-progress'),
        ]);
        if (active) {
          setReadiness(readinessResult);
          setDelivery(deliveryResult);
        }
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
    {delivery && <section className="card delivery-progress-card" aria-label="پیشرفت و برنامه زمان‌بندی MVP">
      <div className="readiness-score-heading"><div><span className="eyebrow">برنامه در برابر عملکرد</span><h2>تکمیل قابلیت‌های MVP</h2></div><strong>{delivery.actualPercent.toLocaleString('fa-IR')}٪</strong></div>
      <div className="readiness-progress-track" role="progressbar" aria-label="تکمیل قابلیت‌های MVP" aria-valuemin={0} aria-valuemax={100} aria-valuenow={delivery.actualPercent}><span style={{ width: `${delivery.actualPercent}%` }} /></div>
      <div className="delivery-metrics">
        <div><span>مرحله قبل</span><strong>{delivery.previousPercent.toLocaleString('fa-IR')}٪</strong></div>
        <div><span>تغییر این مرحله</span><strong>{formatVariance(delivery.changeFromPrevious)}٪</strong></div>
        <div><span>برنامه فعلی</span><strong>{delivery.plannedPercent.toLocaleString('fa-IR')}٪</strong></div>
        <div><span>انحراف از برنامه</span><strong>{formatVariance(delivery.varianceFromPlan)}٪</strong></div>
      </div>
      <div className="table-wrap"><table className="data-table delivery-table"><thead><tr><th>مرحله</th><th>مرحله قبل</th><th>واقعی فعلی</th><th>تغییر</th><th>برنامه فعلی</th><th>اختلاف با برنامه</th></tr></thead><tbody>{delivery.phases.map((phase) => <tr key={phase.key}><td>{phase.title}</td><td>{phase.previousPercent.toLocaleString('fa-IR')}٪</td><td>{phase.actualPercent.toLocaleString('fa-IR')}٪</td><td className={phase.changeFromPrevious < 0 ? 'delivery-behind' : 'delivery-ahead'}>{formatVariance(phase.changeFromPrevious)}٪</td><td>{phase.plannedPercent.toLocaleString('fa-IR')}٪</td><td className={phase.variance < 0 ? 'delivery-behind' : 'delivery-ahead'}>{formatVariance(phase.variance)}٪</td></tr>)}</tbody></table></div>
      <div className="delivery-estimates"><p><strong>نسخه پایلوت قابل استفاده:</strong> {formatRange(delivery.estimates.pilot)} روز کاری باقی‌مانده</p><p><strong>نسخه MVP آماده انتشار:</strong> {formatRange(delivery.estimates.release)} روز کاری باقی‌مانده</p></div>
      <p className={delivery.scheduleStatus === 'ON_TRACK' ? 'message message-success' : 'message message-error'}>{delivery.scheduleStatus === 'ON_TRACK' ? 'پیشرفت واقعی مطابق یا جلوتر از برنامه فعلی است.' : 'پیشرفت واقعی از برنامه عقب‌تر است و نیاز به بازتنظیم دارد.'}</p>
    </section>}

    {readiness && <section className="card readiness-score" aria-label="خلاصه آمادگی انتشار">
      <div className="readiness-score-heading"><div><span className="eyebrow">وضعیت امروز</span><h2>آمادگی انتشار MVP</h2></div><strong>{readiness.summary.percent.toLocaleString('fa-IR')}٪</strong></div>
      <div className="readiness-progress-track" role="progressbar" aria-label="آمادگی انتشار" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness.summary.percent}><span style={{ width: `${readiness.summary.percent}%` }} /></div>
      <p className={readiness.pilotReady ? 'message message-success' : 'message message-error'}>{readiness.pilotReady ? 'پایلوت داخلی آماده استفاده است.' : `${readiness.summary.pilotBlockers.toLocaleString('fa-IR')} مانع ضروری پایلوت داخلی باقی مانده است.`}</p>
      <p className={readiness.ready ? 'message message-success' : 'message message-error'}>{readiness.ready ? 'همه کنترل‌های الزامی انتشار آماده‌اند.' : `${readiness.summary.blocked.toLocaleString('fa-IR')} مانع انتشار باقی مانده است.`}</p>
      {!readiness.ready && <p className="muted">تقسیم پیگیری: {readiness.summary.ownerDecisionRequired.toLocaleString('fa-IR')} تصمیم مالک، {readiness.summary.technicalActionsRequired.toLocaleString('fa-IR')} اقدام فنی و {readiness.summary.operationsActionsRequired.toLocaleString('fa-IR')} اقدام عملیاتی.</p>}
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

function formatVariance(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toLocaleString('fa-IR')}`;
}

function formatRange(range: { minWorkingDays: number; maxWorkingDays: number }): string {
  return `${range.minWorkingDays.toLocaleString('fa-IR')} تا ${range.maxWorkingDays.toLocaleString('fa-IR')}`;
}
