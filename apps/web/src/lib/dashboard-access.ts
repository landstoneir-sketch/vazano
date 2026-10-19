import type { Route } from 'next';
import type { RouteIdentity } from './route-access';

export type DashboardLink = { href: Route; label: string };

const BUYER_ROLES = new Set(['BUYER_OWNER', 'BUYER_MEMBER']);
const SUPPLIER_ROLES = new Set(['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES']);

const MANAGEMENT_LINKS: Array<DashboardLink & { permissions: string[] }> = [
  { href: '/admin/rfqs', label: 'صف استعلام‌ها', permissions: ['rfq.review', 'rfq.manage'] },
  { href: '/admin/suppliers', label: 'بررسی فروشندگان', permissions: ['supplier.verify'] },
  { href: '/admin/support', label: 'صف پشتیبانی', permissions: ['support.manage'] },
  { href: '/admin/catalog', label: 'دسته‌بندی و ویژگی‌ها', permissions: ['category.manage'] },
  { href: '/admin/locations', label: 'استان‌ها و شهرها', permissions: ['location.manage'] },
  { href: '/admin/quality-control', label: 'عملیات کنترل کیفیت', permissions: ['quality_control.manage'] },
  { href: '/admin/contracts', label: 'درخواست‌های قرارداد', permissions: ['contract.manage'] },
  { href: '/admin/reviews', label: 'نظرات فروشندگان', permissions: ['support.manage'] },
  { href: '/admin/reports', label: 'گزارش مدیریتی', permissions: ['report.read'] },
  { href: '/admin/billing', label: 'اشتراک‌ها و پرداخت‌ها', permissions: ['billing.read', 'billing.manage'] },
  { href: '/admin/readiness' as Route, label: 'آمادگی انتشار', permissions: ['settings.read', 'settings.manage'] },
  { href: '/admin/settings', label: 'تنظیمات کسب‌وکار', permissions: ['settings.read', 'settings.manage'] },
  { href: '/admin/content', label: 'مدیریت محتوا', permissions: ['content.manage'] },
  { href: '/admin/users', label: 'مدیریت کاربران', permissions: ['user.read', 'user.manage'] },
  { href: '/admin/audit-logs', label: 'ممیزی و امنیت', permissions: ['audit.read'] },
];

export function hasBuyerWorkspace(identity: RouteIdentity): boolean {
  return identity.memberships.some((membership) => BUYER_ROLES.has(membership.role))
    || identity.permissions.some((permission) => ['rfq.manage', 'rfq.create_on_behalf'].includes(permission));
}

export function hasSupplierWorkspace(identity: RouteIdentity): boolean {
  return identity.memberships.some((membership) => SUPPLIER_ROLES.has(membership.role))
    || identity.permissions.some((permission) => ['rfq.manage', 'supplier.verify'].includes(permission));
}

export function dashboardManagementLinks(identity: RouteIdentity): DashboardLink[] {
  if (identity.globalRoles.includes('SUPER_ADMIN')) {
    return MANAGEMENT_LINKS.map(({ href, label }) => ({ href, label }));
  }
  const granted = new Set(identity.permissions);
  return MANAGEMENT_LINKS
    .filter((link) => link.permissions.some((permission) => granted.has(permission)))
    .map(({ href, label }) => ({ href, label }));
}
