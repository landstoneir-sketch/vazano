import { PrismaClient } from '@prisma/client';
import { normalizeIranianMobile } from '../modules/auth/domain/mobile';
import {
  assertApprovedLegalHash,
  hashLegalContent,
  LEGAL_PUBLICATION_CONFIRMATION,
} from './legal-publication';

const prisma = new PrismaClient();
const LEGAL_SLUGS = ['terms', 'privacy'] as const;

async function main(): Promise<void> {
  const mode = (process.argv[2] ?? process.env.LEGAL_PUBLICATION_MODE ?? 'inspect').trim().toLowerCase();
  if (!['inspect', 'publish'].includes(mode)) {
    throw new Error('LEGAL_PUBLICATION_MODE must be inspect or publish.');
  }

  const pages = await prisma.cmsPage.findMany({
    where: { slug: { in: [...LEGAL_SLUGS] } },
    select: { id: true, slug: true, titleFa: true, bodyFa: true, status: true, version: true, publishedAt: true },
  });
  const pagesBySlug = new Map(pages.map((page) => [page.slug, page]));
  const legalPages = LEGAL_SLUGS.map((slug) => {
    const page = pagesBySlug.get(slug);
    if (!page) throw new Error(`Required legal page is missing: ${slug}`);
    return { ...page, slug, contentSha256: hashLegalContent(page.titleFa, page.bodyFa) };
  });

  if (mode === 'inspect') {
    console.log(JSON.stringify({ mode, pages: legalPages.map(({ slug, status, version, publishedAt, contentSha256 }) => ({
      slug, status, version, publishedAt, contentSha256,
    })) }, null, 2));
    return;
  }

  if (process.env.LEGAL_PUBLICATION_CONFIRMATION !== LEGAL_PUBLICATION_CONFIRMATION) {
    throw new Error(`LEGAL_PUBLICATION_CONFIRMATION must equal ${LEGAL_PUBLICATION_CONFIRMATION}.`);
  }
  const adminMobile = normalizeIranianMobile(requiredEnvironmentValue('SEED_ADMIN_MOBILE'));
  const actor = await prisma.user.findFirst({
    where: {
      mobile: adminMobile,
      status: 'ACTIVE',
      userRoles: { some: { organizationId: null, role: { key: 'SUPER_ADMIN' } } },
    },
    select: { id: true },
  });
  if (!actor) throw new Error('SEED_ADMIN_MOBILE must belong to an active global SUPER_ADMIN.');

  const approvedHashes: Record<(typeof LEGAL_SLUGS)[number], string | undefined> = {
    terms: process.env.LEGAL_TERMS_APPROVED_SHA256,
    privacy: process.env.LEGAL_PRIVACY_APPROVED_SHA256,
  };
  for (const page of legalPages) {
    assertApprovedLegalHash(page.slug, page.contentSha256, approvedHashes[page.slug]);
    if (!['DRAFT', 'PUBLISHED'].includes(page.status)) {
      throw new Error(`Legal page ${page.slug} must be DRAFT or PUBLISHED, not ${page.status}.`);
    }
  }

  const changedPages = legalPages.filter((page) => page.status !== 'PUBLISHED');
  if (changedPages.length > 0) {
    await prisma.$transaction(async (tx) => {
      const publishedAt = new Date();
      for (const page of changedPages) {
        const result = await tx.cmsPage.updateMany({
          where: { id: page.id, version: page.version, status: 'DRAFT' },
          data: {
            status: 'PUBLISHED',
            publishedAt,
            updatedByUserId: actor.id,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new Error(`Legal page ${page.slug} changed concurrently; inspect and approve it again.`);
        }
        await tx.auditLog.create({
          data: {
            actorUserId: actor.id,
            action: 'cms.legal.bootstrap_publish',
            entityType: 'CmsPage',
            entityId: page.id,
            metadata: {
              slug: page.slug,
              approvedContentSha256: page.contentSha256,
              previousVersion: page.version,
              publicationMethod: 'HASH_GATED_BOOTSTRAP',
            },
          },
        });
      }
      await tx.securityEvent.create({
        data: {
          eventType: 'cms.legal.bootstrap_publish',
          severity: 'HIGH',
          outcome: 'SUCCESS',
          userId: actor.id,
          metadata: { slugs: changedPages.map((page) => page.slug) },
        },
      });
    });
  }

  console.log(JSON.stringify({
    mode,
    published: changedPages.map((page) => page.slug),
    alreadyPublished: legalPages.filter((page) => page.status === 'PUBLISHED').map((page) => page.slug),
  }, null, 2));
}

function requiredEnvironmentValue(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown legal publication failure.';
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
