export function buildBillingInvoiceNumber(subscriptionId: string, issuedAt: Date): string {
  const normalizedId = subscriptionId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `VZI-${issuedAt.getUTCFullYear()}-${normalizedId}`;
}
