export type RouteIdentity = {
  permissions: string[];
  globalRoles: string[];
  memberships: Array<{ organizationId: string; role: string }>;
};

const SUPPLIER_ROLES = new Set(['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES']);

const ADMIN_PERMISSION_RULES: Array<{ prefix: string; permissions: string[] }> = [
  { prefix: '/admin/rfqs/new', permissions: ['rfq.create_on_behalf'] },
  { prefix: '/admin/audit-logs', permissions: ['audit.read'] },
  { prefix: '/admin/billing', permissions: ['billing.read', 'billing.manage'] },
  { prefix: '/admin/catalog', permissions: ['category.manage'] },
  { prefix: '/admin/content', permissions: ['content.manage'] },
  { prefix: '/admin/locations', permissions: ['location.manage'] },
  { prefix: '/admin/quality-control', permissions: ['quality_control.manage'] },
  { prefix: '/admin/contracts', permissions: ['contract.manage'] },
  { prefix: '/admin/reports', permissions: ['report.read'] },
  { prefix: '/admin/readiness', permissions: ['settings.read', 'settings.manage'] },
  { prefix: '/admin/reviews', permissions: ['support.manage'] },
  { prefix: '/admin/rfqs', permissions: ['rfq.review', 'rfq.manage'] },
  { prefix: '/admin/settings', permissions: ['settings.read', 'settings.manage'] },
  { prefix: '/admin/suppliers', permissions: ['supplier.verify'] },
  { prefix: '/admin/support', permissions: ['support.manage'] },
  { prefix: '/admin/users', permissions: ['user.read', 'user.manage'] },
];

function startsWithRoute(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function canAccessRoute(pathname: string, identity: RouteIdentity): boolean {
  if (pathname === '/dashboard' || startsWithRoute(pathname, '/dashboard') || startsWithRoute(pathname, '/messages') || startsWithRoute(pathname, '/notifications') || startsWithRoute(pathname, '/support')) {
    return true;
  }

  if (pathname === '/supplier' || startsWithRoute(pathname, '/supplier')) {
    return identity.memberships.some((membership) => SUPPLIER_ROLES.has(membership.role))
      || identity.permissions.some((permission) => ['rfq.manage', 'supplier.verify'].includes(permission));
  }

  if (pathname === '/admin' || startsWithRoute(pathname, '/admin')) {
    if (identity.globalRoles.includes('SUPER_ADMIN')) return true;
    const rule = ADMIN_PERMISSION_RULES.find((candidate) => startsWithRoute(pathname, candidate.prefix));
    if (rule) return rule.permissions.some((permission) => identity.permissions.includes(permission));
    return identity.globalRoles.some((role) => ['ADMIN', 'SUPPORT', 'FINANCE', 'CONTENT_MANAGER'].includes(role));
  }

  return true;
}

export function safeReturnTo(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/login')) return '/dashboard';

  try {
    const parsed = new URL(candidate, 'http://vazano.local');
    if (parsed.origin !== 'http://vazano.local') return '/dashboard';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/dashboard';
  }
}
