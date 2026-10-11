import { parseClamAvResponse } from './file-safety.service';

describe('ClamAV response policy', () => {
  it('accepts a clean stream response', () => {
    expect(parseClamAvResponse('stream: OK\0')).toEqual({ verdict: 'CLEAN', provider: 'clamav' });
  });

  it('quarantines a response that names a malware signature', () => {
    expect(parseClamAvResponse('stream: Eicar-Signature FOUND\0')).toEqual({
      verdict: 'INFECTED', provider: 'clamav', reason: 'Eicar-Signature',
    });
  });

  it('rejects an ambiguous scanner response', () => {
    expect(() => parseClamAvResponse('stream: scanner failure ERROR\0')).toThrow();
  });
});
