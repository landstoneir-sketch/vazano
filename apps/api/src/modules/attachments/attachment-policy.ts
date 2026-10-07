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
