'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import type { RouteIdentity } from '@/lib/route-access';

type AuthenticatedAccount = RouteIdentity & { id: string; mobile: string; status: string };

const SUPPLIER_ROLES = new Set(['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES']);

function adminLanding(account: AuthenticatedAccount): Route | null {
  if (account.globalRoles.includes('SUPER_ADMIN') || account.permissions.includes('rfq.review')) return '/admin/rfqs';
  if (account.permissions.includes('support.manage')) return '/admin/support' as Route;
  if (account.permissions.includes('content.manage')) return '/admin/content' as Route;
  if (account.permissions.includes('billing.read')) return '/admin/settings';
  return null;
}

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
  const managementPath = adminLanding(account);

  return (
    <span className="nav-account">
      <Link href="/dashboard">داشبورد</Link>
      {hasSupplierArea && <Link href="/supplier">فروشنده</Link>}
      <Link href={'/messages' as Route}>پیام‌ها</Link>
      <Link href="/notifications">اعلان‌ها</Link>
      {managementPath && <Link href={managementPath}>مدیریت</Link>}
      <span className="nav-user-badge" title={account.mobile}>{maskMobile(account.mobile)}</span>
      <button className="nav-logout" type="button" disabled={loggingOut} onClick={() => void logout()}>
        {loggingOut ? 'در حال خروج…' : 'خروج'}
      </button>
    </span>
  );
}
