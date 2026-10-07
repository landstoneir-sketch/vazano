export type MessageThreadParties = {
  buyerOrganizationId: string;
  supplierOrganizationId: string;
};

export function canAccessMessageThread(
  memberOrganizationIds: readonly string[],
  thread: MessageThreadParties,
): boolean {
  return memberOrganizationIds.includes(thread.buyerOrganizationId)
    || memberOrganizationIds.includes(thread.supplierOrganizationId);
}

export function canSendAsOrganization(
  memberOrganizationIds: readonly string[],
  thread: MessageThreadParties,
  senderOrganizationId: string,
): boolean {
  return memberOrganizationIds.includes(senderOrganizationId)
    && (senderOrganizationId === thread.buyerOrganizationId
      || senderOrganizationId === thread.supplierOrganizationId);
}
