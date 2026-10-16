export type DeliveryPhaseStatus = 'COMPLETE' | 'ON_TRACK' | 'AT_RISK';

export type DeliveryPhase = {
  key: string;
  title: string;
  weight: number;
  previousPercent: number;
  plannedPercent: number;
  actualPercent: number;
  changeFromPrevious: number;
  variance: number;
  status: DeliveryPhaseStatus;
};

const phases: Omit<DeliveryPhase, 'changeFromPrevious' | 'variance' | 'status'>[] = [
  { key: 'audit-architecture', title: 'ممیزی، نیازمندی و معماری', weight: 8, previousPercent: 100, plannedPercent: 100, actualPercent: 100 },
  { key: 'platform-foundation', title: 'زیرساخت و پایه فنی', weight: 12, previousPercent: 100, plannedPercent: 100, actualPercent: 100 },
  { key: 'identity-access', title: 'ورود، کاربران، سازمان و دسترسی', weight: 15, previousPercent: 100, plannedPercent: 100, actualPercent: 100 },
  { key: 'marketplace-core', title: 'کاتالوگ و چرخه استعلام', weight: 25, previousPercent: 93, plannedPercent: 92, actualPercent: 93 },
  { key: 'quotations-collaboration', title: 'پیشنهاد، مقایسه، پیام و اعلان', weight: 15, previousPercent: 90, plannedPercent: 90, actualPercent: 90 },
  { key: 'commercial-foundation', title: 'فروشنده، اشتراک و پرداخت', weight: 10, previousPercent: 74, plannedPercent: 70, actualPercent: 76 },
  { key: 'admin-operations', title: 'مدیریت، محتوا و گزارش', weight: 5, previousPercent: 84, plannedPercent: 82, actualPercent: 85 },
  { key: 'quality-release', title: 'امنیت، آزمون و آماده‌سازی انتشار', weight: 10, previousPercent: 90, plannedPercent: 85, actualPercent: 90 },
];

export function getMvpDeliveryPlan() {
  const deliveryPhases: DeliveryPhase[] = phases.map((phase) => {
    const variance = phase.actualPercent - phase.plannedPercent;
    return {
      ...phase,
      changeFromPrevious: phase.actualPercent - phase.previousPercent,
      variance,
      status: phase.actualPercent === 100 ? 'COMPLETE' : variance >= -2 ? 'ON_TRACK' : 'AT_RISK',
    };
  });
  const actualPercent = weightedPercent(deliveryPhases, 'actualPercent');
  const plannedPercent = weightedPercent(deliveryPhases, 'plannedPercent');

  return {
    snapshotDate: '2026-10-16',
    previousPercent: 92,
    actualPercent,
    plannedPercent,
    changeFromPrevious: actualPercent - 92,
    varianceFromPlan: actualPercent - plannedPercent,
    scheduleStatus: actualPercent >= plannedPercent ? 'ON_TRACK' as const : 'AT_RISK' as const,
    estimates: {
      pilot: { minWorkingDays: 0, maxWorkingDays: 1 },
      release: { minWorkingDays: 4, maxWorkingDays: 8 },
    },
    phases: deliveryPhases,
  };
}

function weightedPercent(items: DeliveryPhase[], field: 'plannedPercent' | 'actualPercent'): number {
  const weight = items.reduce((total, item) => total + item.weight, 0);
  if (weight === 0) return 0;
  return Math.round(items.reduce((total, item) => total + item[field] * item.weight, 0) / weight);
}
