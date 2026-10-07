import { canTransitionSupportTicket, initialSupportPriority } from './support-ticket-policy';

describe('support ticket policy', () => {
  it('prioritizes security reports as P1', () => {
    expect(initialSupportPriority('ISSUE', 'PRIVACY_SECURITY')).toBe('P1');
  });

  it('prioritizes complaints and violations as P2', () => {
    expect(initialSupportPriority('VIOLATION_REPORT', 'SUPPLIER_BUYER_CONDUCT')).toBe('P2');
    expect(initialSupportPriority('COMPLAINT', 'OTHER')).toBe('P2');
  });

  it('prevents reopening a closed ticket without an explicit future policy', () => {
    expect(canTransitionSupportTicket('CLOSED', 'IN_REVIEW')).toBe(false);
  });

  it('allows a resolved ticket to be reopened before closure', () => {
    expect(canTransitionSupportTicket('RESOLVED', 'IN_REVIEW')).toBe(true);
  });
});
