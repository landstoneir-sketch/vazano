import type { SupportTicketCategory, SupportTicketPriority, SupportTicketStatus, SupportTicketType } from '@prisma/client';

const allowedTransitions: Record<SupportTicketStatus, readonly SupportTicketStatus[]> = {
  SUBMITTED: ['ACKNOWLEDGED', 'IN_REVIEW', 'REJECTED'],
  ACKNOWLEDGED: ['IN_REVIEW', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'REJECTED'],
  IN_REVIEW: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'REJECTED'],
  WAITING_FOR_REQUESTER: ['IN_REVIEW', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_REVIEW'],
  CLOSED: [],
  REJECTED: ['IN_REVIEW'],
};

export function canTransitionSupportTicket(from: SupportTicketStatus, to: SupportTicketStatus): boolean {
  return from === to || allowedTransitions[from].includes(to);
}

export function initialSupportPriority(
  type: SupportTicketType,
  category: SupportTicketCategory,
): SupportTicketPriority {
  if (category === 'PRIVACY_SECURITY') return 'P1';
  if (type === 'COMPLAINT' || type === 'VIOLATION_REPORT' || type === 'APPEAL') return 'P2';
  if (type === 'ISSUE' || category === 'BILLING') return 'P3';
  return 'P4';
}
