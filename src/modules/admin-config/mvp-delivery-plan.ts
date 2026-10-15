export type DeliveryPhaseStatus = 'COMPLETE' | 'ON_TRACK' | 'AT_RISK';

export type DeliveryPhase = {
  key: string;
  title: string;
  weight: number;
  plannedPercent: number;
  actualPercent: number;
  variance: number;
  status: DeliveryPhaseStatus;
};

const phases: Omit<DeliveryPhase, 'variance' | 'status'>[] = [
  { key: 'audit-architecture', title: 'ممیزی، نیازمندی و معماری', weight: 8, plannedPercent: 100, actualPercent: 100 },
  { key: 'platform-foundation', title: 'زیرساخت و پایه فنی', weight: 12, plannedPercent: 100, actualPercent: 100 },
  { key: 'identity-access', title: 'ورود، کاربران، سازمان و دسترسی', weight: 15, plannedPercent: 100, actualPercent: 100 },
  { key: 'marketplace-core', title: 'کاتالوگ و چرخه استعلام', weight: 25, plannedPercent: 90, actualPercent: 92 },
  { key: 'quotations-collaboration', title: 'پیشنهاد، مقایسه، پیام و اعلان', weight: 15, plannedPercent: 85, actualPercent: 84 },
  { key: 'commercial-foundation', title: 'فروشنده، اشتراک و پرداخت', weight: 10, plannedPercent: 70, actualPercent: 68 },
  { key: 'admin-operations', title: 'مدیریت، محتوا و گزارش', weight: 5, plannedPercent: 80, actualPercent: 82 },
  { key: 'quality-release', title: 'امنیت، آزمون و آماده‌سازی انتشار', weight: 10, plannedPercent: 40, actualPercent: 45 },
];

export function getMvpDeliveryPlan() {
  const deliveryPhases: DeliveryPhase[] = phases.map((phase) => {
    const variance = phase.actualPercent - phase.plannedPercent;
    return {
      ...phase,
      variance,
      status: phase.actualPercent === 100 ? 'COMPLETE' : variance >= -2 ? 'ON_TRACK' : 'AT_RISK',
    };
  });
  const actualPercent = weightedPercent(deliveryPhases, 'actualPercent');
  const plannedPercent = weightedPercent(deliveryPhases, 'plannedPercent');

  return {
    snapshotDate: '2026-10-15',
    previousPercent: 85,
    actualPercent,
    plannedPercent,
    changeFromPrevious: actualPercent - 85,
    varianceFromPlan: actualPercent - plannedPercent,
    scheduleStatus: actualPercent >= plannedPercent ? 'ON_TRACK' as const : 'AT_RISK' as const,
    estimates: {
      pilot: { minWorkingDays: 4, maxWorkingDays: 7 },
      release: { minWorkingDays: 9, maxWorkingDays: 14 },
    },
    phases: deliveryPhases,
  };
}

function weightedPercent(items: DeliveryPhase[], field: 'plannedPercent' | 'actualPercent'): number {
  const weight = items.reduce((total, item) => total + item.weight, 0);
  if (weight === 0) return 0;
  return Math.round(items.reduce((total, item) => total + item[field] * item.weight, 0) / weight);
}
