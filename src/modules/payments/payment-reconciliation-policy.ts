import type { PaymentReconciliationStatus, PaymentStatus } from '@prisma/client';

export function resolvePaymentReconciliationStatus(localStatus: PaymentStatus, providerSuccess: boolean): PaymentReconciliationStatus {
  if (providerSuccess && localStatus === 'SUCCEEDED') return 'MATCHED';
  if (providerSuccess || localStatus === 'SUCCEEDED') return 'ACTION_REQUIRED';
  return 'PROVIDER_UNCONFIRMED';
}
