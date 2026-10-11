import { isTrustedSessionMutation } from './request-security';

describe('session origin policy', () => {
  it('allows safe methods and bearer-style requests without a session cookie', () => {
    expect(isTrustedSessionMutation('GET', undefined, true, 'https://vazano.ir')).toBe(true);
    expect(isTrustedSessionMutation('POST', undefined, false, 'https://vazano.ir')).toBe(true);
  });

  it('allows a cookie-authenticated mutation only from the configured web origin', () => {
    expect(isTrustedSessionMutation('POST', 'https://vazano.ir', true, 'https://vazano.ir')).toBe(true);
    expect(isTrustedSessionMutation('POST', 'https://attacker.example', true, 'https://vazano.ir')).toBe(false);
    expect(isTrustedSessionMutation('DELETE', undefined, true, 'https://vazano.ir')).toBe(false);
  });
});
