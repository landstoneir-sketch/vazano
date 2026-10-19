import { assertApprovedLegalHash, hashLegalContent } from './legal-publication';

describe('legal publication safeguards', () => {
  it('creates the same deterministic content hash used by legal consent', () => {
    expect(hashLegalContent('قوانین', 'متن تأییدشده')).toBe('508437b02b29dfb9d346b39e062df52295aa446ee3819eabe2288ed9dfdb9a26');
  });

  it('accepts only the exact approved content hash', () => {
    const hash = hashLegalContent('حریم خصوصی', 'نسخه نهایی');
    expect(() => assertApprovedLegalHash('privacy', hash, hash.toUpperCase())).not.toThrow();
    expect(() => assertApprovedLegalHash('privacy', hash, '0'.repeat(64))).toThrow(/does not match/);
  });

  it('rejects a missing or malformed approval hash', () => {
    expect(() => assertApprovedLegalHash('terms', '0'.repeat(64), undefined)).toThrow(/missing or invalid/);
    expect(() => assertApprovedLegalHash('terms', '0'.repeat(64), 'approved')).toThrow(/missing or invalid/);
  });
});
