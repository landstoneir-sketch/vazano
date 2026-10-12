'use client';

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

  return <>
    <div className="dashboard-grid">
      {buyerWorkspace && <article className="card"><h2>استعلام‌های فعال</h2><strong>{summary.activeBuyerRfqs.toLocaleString('fa-IR')}</strong></article>}
      {buyerWorkspace && <article className="card"><h2>دارای پیشنهاد قیمت</h2><strong>{summary.buyerRfqsWithQuotes.toLocaleString('fa-IR')}</strong></article>}
      {supplierWorkspace && <article className="card"><h2>فرصت‌های پاسخ‌نداده</h2><strong>{summary.supplierOpenInvitations.toLocaleString('fa-IR')}</strong></article>}
      {supplierWorkspace && <article className="card"><h2>فرصت‌های پاسخ‌داده</h2><strong>{summary.supplierRespondedInvitations.toLocaleString('fa-IR')}</strong></article>}
      <article className="card"><h2>اعلان‌های خوانده‌نشده</h2><strong>{summary.unreadNotifications.toLocaleString('fa-IR')}</strong></article>
    </div>

    {!buyerWorkspace && !supplierWorkspace && managementLinks.length === 0 && <section className="card stack">
      <div className="eyebrow">شروع کار</div>
      <h2>حساب کاری خود را ایجاد کنید</h2>
      <p className="muted">برای ثبت استعلام یا دریافت فرصت فروش، ابتدا یک حساب خریدار یا فروشنده بسازید.</p>
      <div className="actions"><Link className="button button-primary" href="/dashboard/organization">ایجاد حساب کاری</Link></div>
    </section>}

    <div className="actions">
      {buyerWorkspace && <Link className="button button-primary" href="/dashboard/rfqs/new">ثبت استعلام جدید</Link>}
      {buyerWorkspace && <Link className="button button-secondary" href="/dashboard/rfqs">استعلام‌های من</Link>}
      {supplierWorkspace && <Link className="button button-secondary" href="/supplier">فرصت‌های فروش</Link>}
      <Link className="button button-secondary" href="/messages">مرکز پیام</Link>
      <Link className="button button-secondary" href="/support">پشتیبانی و تخلفات</Link>
      <Link className="button button-secondary" href="/dashboard/profile">پروفایل من</Link>
      <Link className="button button-secondary" href="/dashboard/organization">حساب‌های سازمانی</Link>
    </div>

    {managementLinks.length > 0 && <section className="card stack">
      <div><div className="eyebrow">براساس سطح دسترسی شما</div><h2>مدیریت وازانو</h2></div>
      <div className="actions">
        {managementLinks.map((item) => <Link className="button button-secondary" href={item.href} key={item.href}>{item.label}</Link>)}
      </div>
    </section>}
  </>;
}
