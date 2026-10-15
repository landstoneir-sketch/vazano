'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { dashboardManagementLinks } from '@/lib/dashboard-access';
import type { RouteIdentity } from '@/lib/route-access';

type AuthenticatedAccount = RouteIdentity & { id: string; mobile: string; status: string };

const SUPPLIER_ROLES = new Set(['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES']);

function maskMobile(mobile: string): string {
  if (mobile.length < 7) return mobile;
  return `${mobile.slice(0, 4)}•••${mobile.slice(-3)}`;
}

export function AccountNavigation() {
  const router = useRouter();
  const [account, setAccount] = useState<AuthenticatedAccount | null | undefined>(undefined);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest<AuthenticatedAccount>('/auth/me')
      .then((result) => { if (active) setAccount(result); })
      .catch(() => { if (active) setAccount(null); });
    return () => { active = false; };
  }, []);

  async function logout() {
    setLoggingOut(true);
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
      setAccount(null);
      router.replace('/');
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  if (account === undefined) return <span className="nav-user-badge" aria-label="در حال بررسی حساب">حساب من</span>;
  if (account === null) return <Link href="/login">ورود</Link>;

  const hasSupplierArea = account.memberships.some((membership) => SUPPLIER_ROLES.has(membership.role))
    || account.permissions.some((permission) => ['rfq.manage', 'supplier.verify'].includes(permission));
  const managementLinks = dashboardManagementLinks(account);

  return (
    <span className="nav-account">
      <Link href="/dashboard">داشبورد</Link>
      {hasSupplierArea && <Link href="/supplier">فروشنده</Link>}
      <Link href={'/messages' as Route}>پیام‌ها</Link>
      <Link href="/notifications">اعلان‌ها</Link>
      {managementLinks.length > 0 && <details className="nav-management">
        <summary>مدیریت</summary>
        <span className="nav-management-panel" aria-label="بخش‌های مدیریتی">
          {account.globalRoles.some((role) => ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'FINANCE', 'CONTENT_MANAGER'].includes(role)) && <Link href={'/admin' as Route}>مرکز مدیریت</Link>}
          {managementLinks.map((item) => <Link aria-label={item.label} href={item.href} key={item.href}>{item.label}</Link>)}
        </span>
      </details>}
      <Link className="nav-user-badge" href="/dashboard/profile" title="پروفایل من">{maskMobile(account.mobile)}</Link>
      <button className="nav-logout" type="button" disabled={loggingOut} onClick={() => void logout()}>
        {loggingOut ? 'در حال خروج…' : 'خروج'}
      </button>
    </span>
  );
}
