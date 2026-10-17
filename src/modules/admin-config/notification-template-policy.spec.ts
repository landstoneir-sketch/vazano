import { isSafeInternalActionPathTemplate } from './notification-template-policy';

describe('notification template action path policy', () => {
  it.each([
    '/dashboard/rfqs/{{rfqId}}',
    '/messages?thread={{threadId}}',
    '/supplier/subscription',
  ])('accepts a safe internal template: %s', (value) => {
    expect(isSafeInternalActionPathTemplate(value)).toBe(true);
  });

  it.each([
    'https://example.com',
    '//example.com/path',
    '/\\example.com/path',
    '/%2F%2Fexample.com/path',
    '/%5Cexample.com/path',
    '/dashboard\n/admin',
    '/broken%value',
  ])('rejects an unsafe or malformed template: %s', (value) => {
    expect(isSafeInternalActionPathTemplate(value)).toBe(false);
  });
});
