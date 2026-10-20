'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import {
  dashboardManagementLinks,
  hasBuyerWorkspace,
  hasSupplierWorkspace,
} from '@/lib/dashboard-access';
import type { RouteIdentity } from '@/lib/route-access';

type AuthenticatedAccount = RouteIdentity & { id: string; mobile: string; status: string };
type DashboardSummary = {
  activeBuyerRfqs: number;
  buyerRfqsWithQuotes: number;
  supplierOpenInvitations: number;
  supplierRespondedInvitations: number;
  unreadNotifications: number;
};

export function DashboardOverview() {
  const [account, setAccount] = useState<AuthenticatedAccount | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<AuthenticatedAccount>('/auth/me'),
      apiRequest<DashboardSummary>('/users/me/dashboard-summary'),
    ])
      .then(([identity, dashboardSummary]) => { if (active) { setAccount(identity); setSummary(dashboardSummary); } })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'دریافت دسترسی‌های حساب انجام نشد.');
      });
    return () => { active = false; };
  }, []);

  if (error) return <div className="message message-error" role="alert">{error}</div>;
  if (!account || !summary) return <div className="card" role="status">در حال آماده‌سازی داشبورد شما…</div>;

  const buyerWorkspace = hasBuyerWorkspace(account);
  const supplierWorkspace = hasSupplierWorkspace(account);
  const managementLinks = dashboardManagementLinks(account);
  const recommendedAction: { eyebrow: string; title: string; description: string; href: Route; label: string } | null = summary.buyerRfqsWithQuotes > 0
    ? { eyebrow: 'نیازمند بررسی', title: 'پیشنهادهای دریافتی را مقایسه کنید', description: 'قیمت، زمان تحویل و شرایط فروشندگان را کنار هم ببینید.', href: '/dashboard/rfqs', label: 'مشاهده پیشنهادها' }
    : summary.supplierOpenInvitations > 0
      ? { eyebrow: 'فرصت فروش', title: `${summary.supplierOpenInvitations.toLocaleString('fa-IR')} استعلام منتظر پاسخ شماست`, description: 'مهلت پاسخ‌گویی را بررسی کنید و پیشنهاد قیمت ثبت کنید.', href: '/supplier', label: 'مشاهده فرصت‌ها' }
      : buyerWorkspace && summary.activeBuyerRfqs === 0
        ? { eyebrow: 'شروع سریع', title: 'اولین استعلام خود را ثبت کنید', description: 'نیاز خرید را مرحله‌به‌مرحله وارد کنید؛ تا تأیید نهایی چیزی برای فروشندگان ارسال نمی‌شود.', href: '/dashboard/rfqs/new', label: 'ثبت استعلام' }
        : null;

  return <>
    {recommendedAction && <section className="dashboard-next-action" aria-labelledby="dashboard-next-action-title">
      <div><div className="eyebrow">{recommendedAction.eyebrow}</div><h2 id="dashboard-next-action-title">{recommendedAction.title}</h2><p>{recommendedAction.description}</p></div>
      <Link className="button button-primary" href={recommendedAction.href}>{recommendedAction.label}</Link>
    </section>}

    <section className="dashboard-section" aria-labelledby="dashboard-status-title">
      <header className="dashboard-section-heading"><div><div className="eyebrow">نمای کلی</div><h2 id="dashboard-status-title">وضعیت حساب</h2></div><Link className="text-link" href="/notifications">مشاهده اعلان‌ها</Link></header>
    <div className="dashboard-grid">
      {buyerWorkspace && <Link className="card dashboard-metric-card" href="/dashboard/rfqs"><span>استعلام‌های فعال</span><strong>{summary.activeBuyerRfqs.toLocaleString('fa-IR')}</strong><small>مشاهده و پیگیری خریدها</small></Link>}
      {buyerWorkspace && <Link className="card dashboard-metric-card" href="/dashboard/rfqs"><span>دارای پیشنهاد قیمت</span><strong>{summary.buyerRfqsWithQuotes.toLocaleString('fa-IR')}</strong><small>آماده مقایسه و انتخاب</small></Link>}
      {supplierWorkspace && <Link className="card dashboard-metric-card" href="/supplier"><span>فرصت‌های پاسخ‌نداده</span><strong>{summary.supplierOpenInvitations.toLocaleString('fa-IR')}</strong><small>نیازمند اقدام فروشنده</small></Link>}
      {supplierWorkspace && <Link className="card dashboard-metric-card" href="/supplier"><span>فرصت‌های پاسخ‌داده</span><strong>{summary.supplierRespondedInvitations.toLocaleString('fa-IR')}</strong><small>پیشنهادهای ارسال‌شده</small></Link>}
      <Link className="card dashboard-metric-card" href="/notifications"><span>اعلان‌های خوانده‌نشده</span><strong>{summary.unreadNotifications.toLocaleString('fa-IR')}</strong><small>پیام‌های نیازمند توجه</small></Link>
    </div>
    </section>

    {!buyerWorkspace && !supplierWorkspace && managementLinks.length === 0 && <section className="card stack">
      <div className="eyebrow">شروع کار</div>
      <h2>حساب کاری خود را ایجاد کنید</h2>
      <p className="muted">برای ثبت استعلام یا دریافت فرصت فروش، ابتدا یک حساب خریدار یا فروشنده بسازید.</p>
      <div className="actions"><Link className="button button-primary" href="/dashboard/organization">ایجاد حساب کاری</Link></div>
    </section>}

    <section className="dashboard-section" aria-labelledby="dashboard-shortcuts-title">
      <header className="dashboard-section-heading"><div><div className="eyebrow">دسترسی سریع</div><h2 id="dashboard-shortcuts-title">کارهای پرکاربرد</h2></div></header>
      <div className="dashboard-action-grid">
        {buyerWorkspace && <Link className="dashboard-action-card dashboard-action-primary" href="/dashboard/rfqs/new"><span>خرید</span><strong>ثبت استعلام جدید</strong><small>درخواست قیمت را مرحله‌به‌مرحله ثبت کنید</small></Link>}
        {buyerWorkspace && <Link className="dashboard-action-card" href="/dashboard/rfqs"><span>پیگیری</span><strong>استعلام‌های من</strong><small>وضعیت درخواست‌ها و پیشنهادها را ببینید</small></Link>}
        {supplierWorkspace && <Link className="dashboard-action-card" href="/supplier"><span>فروش</span><strong>فرصت‌های فروش</strong><small>استعلام‌های مرتبط را بررسی کنید</small></Link>}
        <Link className="dashboard-action-card" href="/messages"><span>گفت‌وگو</span><strong>مرکز پیام</strong><small>پیام‌های مرتبط با استعلام‌ها</small></Link>
        <Link className="dashboard-action-card" href="/support"><span>راهنما</span><strong>پشتیبانی</strong><small>ثبت و پیگیری درخواست پشتیبانی</small></Link>
        <Link className="dashboard-action-card" href="/dashboard/organization"><span>حساب کاری</span><strong>سازمان و اعضا</strong><small>اعضا و سطح دسترسی را مدیریت کنید</small></Link>
      </div>
    </section>

    {managementLinks.length > 0 && <details className="card dashboard-management">
      <summary><span><small>براساس سطح دسترسی شما</small><strong>ابزارهای مدیریت وازانو</strong></span><b>نمایش بخش‌ها</b></summary>
      <div className="dashboard-management-grid">
        {managementLinks.map((item) => <Link href={item.href} key={item.href}>{item.label}<span aria-hidden="true">←</span></Link>)}
      </div>
    </details>}
  </>;
}
