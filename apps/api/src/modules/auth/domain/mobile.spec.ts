import { normalizeIranianMobile } from './mobile';

describe('normalizeIranianMobile', () => {
  it.each([['09121234567', '09121234567'], ['+989121234567', '09121234567'], ['۰۹۱۲۱۲۳۴۵۶۷', '09121234567']])('normalizes %s', (input, expected) => {
    expect(normalizeIranianMobile(input)).toBe(expected);
  });
  it('rejects invalid numbers', () => expect(() => normalizeIranianMobile('123')).toThrow());
});
