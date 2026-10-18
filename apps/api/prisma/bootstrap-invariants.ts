export type BootstrapRoleSnapshot = {
  key: string;
  permissionKeys: string[];
};

export type BootstrapInvariantSnapshot = {
  permissionKeys: string[];
  roles: BootstrapRoleSnapshot[];
  provinceCodes: string[];
  cityCount: number;
  naturalStoneCategoryCodes: string[];
  unitCodes: string[];
  subscriptionPlanCodes: string[];
  systemSettingKeys: string[];
  notificationTemplateCodes: string[];
  activeSuperAdminCount: number;
  activeDemoDiscountCount: number;
};

export type BootstrapInvariantExpectation = {
  permissionKeys: readonly string[];
  roles: Readonly<Record<string, readonly string[]>>;
  provinceCodes: readonly string[];
  minimumCityCount: number;
  naturalStoneCategoryCodes: readonly string[];
  unitCodes: readonly string[];
  subscriptionPlanCodes: readonly string[];
  systemSettingKeys: readonly string[];
  notificationTemplateCodes: readonly string[];
  requireActiveSuperAdmin: boolean;
  forbidActiveDemoDiscount: boolean;
};

function missing(expected: readonly string[], actual: readonly string[]): string[] {
  const actualValues = new Set(actual);
  return expected.filter((value) => !actualValues.has(value));
}

function addMissingIssue(issues: string[], label: string, expected: readonly string[], actual: readonly string[]): void {
  const missingValues = missing(expected, actual);
  if (missingValues.length > 0) issues.push(`${label}: ${missingValues.join(', ')}`);
}

export function validateBootstrapInvariants(
  snapshot: BootstrapInvariantSnapshot,
  expectation: BootstrapInvariantExpectation,
): string[] {
  const issues: string[] = [];
  addMissingIssue(issues, 'missing permissions', expectation.permissionKeys, snapshot.permissionKeys);
  addMissingIssue(issues, 'missing provinces', expectation.provinceCodes, snapshot.provinceCodes);
  if (snapshot.cityCount < expectation.minimumCityCount) {
    issues.push(`insufficient cities: expected at least ${expectation.minimumCityCount}, found ${snapshot.cityCount}`);
  }
  addMissingIssue(issues, 'missing natural-stone categories', expectation.naturalStoneCategoryCodes, snapshot.naturalStoneCategoryCodes);
  addMissingIssue(issues, 'missing units', expectation.unitCodes, snapshot.unitCodes);
  addMissingIssue(issues, 'missing subscription plans', expectation.subscriptionPlanCodes, snapshot.subscriptionPlanCodes);
  addMissingIssue(issues, 'missing system settings', expectation.systemSettingKeys, snapshot.systemSettingKeys);
  addMissingIssue(issues, 'missing notification templates', expectation.notificationTemplateCodes, snapshot.notificationTemplateCodes);

  const rolesByKey = new Map(snapshot.roles.map((role) => [role.key, role.permissionKeys]));
  for (const [roleKey, expectedPermissionKeys] of Object.entries(expectation.roles)) {
    const actualPermissionKeys = rolesByKey.get(roleKey);
    if (!actualPermissionKeys) {
      issues.push(`missing role: ${roleKey}`);
      continue;
    }
    addMissingIssue(issues, `missing permissions for role ${roleKey}`, expectedPermissionKeys, actualPermissionKeys);
  }

  if (expectation.requireActiveSuperAdmin && snapshot.activeSuperAdminCount < 1) {
    issues.push('no active SUPER_ADMIN account exists');
  }
  if (expectation.forbidActiveDemoDiscount && snapshot.activeDemoDiscountCount > 0) {
    issues.push('development discount DEMO10 is active');
  }
  return issues;
}

export function assertBootstrapInvariants(
  snapshot: BootstrapInvariantSnapshot,
  expectation: BootstrapInvariantExpectation,
): void {
  const issues = validateBootstrapInvariants(snapshot, expectation);
  if (issues.length > 0) {
    throw new Error(`Bootstrap verification failed:\n- ${issues.join('\n- ')}`);
  }
}
