import { createHash } from 'node:crypto';

export const LEGAL_PUBLICATION_CONFIRMATION = 'PUBLISH_APPROVED_LEGAL_PAGES';

export function hashLegalContent(title: string, body: string): string {
  return createHash('sha256').update(`${title}\n${body}`, 'utf8').digest('hex');
}

export function assertApprovedLegalHash(slug: string, actualHash: string, approvedHash: string | undefined): void {
  const normalizedApprovedHash = approvedHash?.trim().toLowerCase();
  if (!normalizedApprovedHash || !/^[0-9a-f]{64}$/.test(normalizedApprovedHash)) {
    throw new Error(`Approved SHA-256 for ${slug} is missing or invalid.`);
  }
  if (normalizedApprovedHash !== actualHash) {
    throw new Error(`Approved SHA-256 for ${slug} does not match the current database content.`);
  }
}
