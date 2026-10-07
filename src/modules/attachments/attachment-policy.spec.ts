import { normalizedAttachmentExtension, safeOriginalFileName } from './attachment-policy';

describe('attachment policy', () => {
  it('accepts only a matching allow-listed MIME and extension pair', () => {
    expect(normalizedAttachmentExtension('plan.PDF', 'application/pdf')).toBe('.pdf');
    expect(normalizedAttachmentExtension('payload.html', 'application/pdf')).toBeNull();
    expect(normalizedAttachmentExtension('vector.svg', 'image/svg+xml')).toBeNull();
  });

  it('removes paths and control characters from the display name', () => {
    expect(safeOriginalFileName('../folder/plan\u0000.pdf')).toBe('plan.pdf');
  });
});
