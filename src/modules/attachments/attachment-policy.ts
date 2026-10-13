import { extname } from 'node:path';

export const DEFAULT_MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;

const MIME_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

export function normalizedAttachmentExtension(fileName: string, mimeType: string): string | null {
  const extension = extname(fileName).toLowerCase();
  return MIME_EXTENSIONS[mimeType]?.includes(extension) ? extension : null;
}

export function safeOriginalFileName(fileName: string): string {
  const baseName = fileName.replaceAll('\\', '/').split('/').at(-1) ?? '';
  return [...baseName].filter((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 32 && codePoint !== 127;
  }).join('').slice(0, 180) || 'file';
}

export function matchesAttachmentSignature(mimeType: string, content: Buffer): boolean {
  const startsWith = (signature: readonly number[]) => content.length >= signature.length
    && signature.every((value, index) => content[index] === value);
  if (mimeType === 'application/pdf') return startsWith([0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (mimeType === 'image/jpeg') return startsWith([0xff, 0xd8, 0xff]);
  if (mimeType === 'image/png') return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === 'image/webp') {
    return content.length >= 12
      && content.subarray(0, 4).toString('ascii') === 'RIFF'
      && content.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (mimeType === 'application/vnd.ms-excel') return startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(mimeType)) {
    return startsWith([0x50, 0x4b, 0x03, 0x04]);
  }
  return false;
}
