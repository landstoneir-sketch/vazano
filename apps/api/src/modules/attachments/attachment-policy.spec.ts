import { matchesAttachmentSignature, normalizedAttachmentExtension, safeOriginalFileName } from './attachment-policy';

describe('attachment policy', () => {
  it('accepts only a matching allow-listed MIME and extension pair', () => {
    expect(normalizedAttachmentExtension('plan.PDF', 'application/pdf')).toBe('.pdf');
    expect(normalizedAttachmentExtension('payload.html', 'application/pdf')).toBeNull();
    expect(normalizedAttachmentExtension('vector.svg', 'image/svg+xml')).toBeNull();
  });

  it('removes paths and control characters from the display name', () => {
    expect(safeOriginalFileName('../folder/plan\u0000.pdf')).toBe('plan.pdf');
  });

  it('validates common attachment signatures instead of trusting declared MIME metadata', () => {
    expect(matchesAttachmentSignature('application/pdf', Buffer.from('%PDF-1.7'))).toBe(true);
    expect(matchesAttachmentSignature('application/pdf', Buffer.from('<html>'))).toBe(false);
    expect(matchesAttachmentSignature('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(matchesAttachmentSignature('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(matchesAttachmentSignature('image/webp', Buffer.from('RIFF1234WEBP'))).toBe(true);
    expect(matchesAttachmentSignature('application/vnd.openxmlformats-officedocument.wordprocessingml.document', Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
    expect(matchesAttachmentSignature('text/html', Buffer.from('<html>'))).toBe(false);
  });
});
