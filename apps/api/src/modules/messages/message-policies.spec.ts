import { canAccessMessageThread, canSendAsOrganization } from './message-policies';

const thread = {
  buyerOrganizationId: 'buyer-a',
  supplierOrganizationId: 'supplier-a',
};

describe('message tenant isolation', () => {
  it('allows members of the buyer and invited supplier', () => {
    expect(canAccessMessageThread(['buyer-a'], thread)).toBe(true);
    expect(canAccessMessageThread(['supplier-a'], thread)).toBe(true);
  });

  it('does not reveal a thread to another supplier', () => {
    expect(canAccessMessageThread(['supplier-b'], thread)).toBe(false);
  });

  it('prevents sending as another organization', () => {
    expect(canSendAsOrganization(['supplier-a'], thread, 'buyer-a')).toBe(false);
    expect(canSendAsOrganization(['supplier-a'], thread, 'supplier-b')).toBe(false);
  });

  it('allows explicitly selecting a participating membership', () => {
    expect(canSendAsOrganization(['buyer-a', 'supplier-a'], thread, 'supplier-a')).toBe(true);
  });
});
