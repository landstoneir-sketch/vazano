import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CmsService } from './cms.service';

const contentManager: AuthenticatedUser = {
  id: 'content-manager',
  mobile: '09120000000',
  status: 'ACTIVE',
  permissions: ['content.manage'],
  globalRoles: ['CONTENT_MANAGER'],
  memberships: [],
};

const pageInput = {
  slug: 'how-it-works',
  titleFa: 'نحوه کار وازانو',
  bodyFa: 'متن صفحه نحوه کار',
  status: 'DRAFT' as const,
};

describe('CmsService', () => {
  it('exposes only published pages through the public query', async () => {
    const findFirst = jest.fn().mockResolvedValue({ slug: 'about', titleFa: 'درباره وازانو' });
    const prisma = { cmsPage: { findFirst } } as unknown as PrismaService;
    const service = new CmsService(prisma);

    await expect(service.getPublishedPage('about')).resolves.toEqual({ slug: 'about', titleFa: 'درباره وازانو' });
    expect(findFirst).toHaveBeenCalledWith({
      where: { slug: 'about', status: 'PUBLISHED' },
      select: {
        slug: true, titleFa: true, excerptFa: true, bodyFa: true, seoTitleFa: true,
        seoDescriptionFa: true, publishedAt: true, updatedAt: true,
      },
    });
  });

  it('does not disclose an unpublished or missing page', async () => {
    const prisma = { cmsPage: { findFirst: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    const service = new CmsService(prisma);

    await expect(service.getPublishedPage('draft-page')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks content management without the backend permission', () => {
    const findMany = jest.fn();
    const prisma = { cmsPage: { findMany } } as unknown as PrismaService;
    const service = new CmsService(prisma);

    expect(() => service.listPages({ ...contentManager, permissions: [] })).toThrow(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('allows editing a draft legal page but blocks direct publication', async () => {
    const terms = { id: 'terms-page', slug: 'terms', status: 'DRAFT', version: 2 };
    const transaction = jest.fn();
    const prisma = {
      cmsPage: { findUnique: jest.fn().mockResolvedValue(terms) },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new CmsService(prisma);

    await expect(service.updatePage(contentManager, terms.id, {
      slug: 'terms', titleFa: 'قوانین', bodyFa: 'متن تأییدنشده جدید', status: 'PUBLISHED', expectedVersion: 2,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('blocks changing a published legal page outside the controlled legal workflow', async () => {
    const privacy = { id: 'privacy-page', slug: 'privacy', status: 'PUBLISHED', version: 1 };
    const transaction = jest.fn();
    const prisma = {
      cmsPage: { findUnique: jest.fn().mockResolvedValue(privacy) },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new CmsService(prisma);

    await expect(service.updatePage(contentManager, privacy.id, {
      slug: 'privacy', titleFa: 'حریم خصوصی', bodyFa: 'متن ویرایش‌شده', status: 'DRAFT', expectedVersion: 1,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('creates ordinary draft content with an audit record', async () => {
    const page = { id: 'page-1', ...pageInput, code: undefined };
    const tx = {
      cmsPage: { create: jest.fn().mockResolvedValue(page) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CmsService(prisma);

    await expect(service.createPage(contentManager, pageInput)).resolves.toEqual(page);
    expect(tx.cmsPage.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('detects concurrent ordinary-page updates before writing an audit record', async () => {
    const existing = {
      id: 'page-1', slug: 'how-it-works', status: 'DRAFT', version: 3,
      publishedAt: null, updatedAt: new Date('2026-10-18T00:00:00.000Z'),
    };
    const tx = {
      cmsPage: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      cmsPage: { findUnique: jest.fn().mockResolvedValue(existing) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    const service = new CmsService(prisma);

    await expect(service.updatePage(contentManager, existing.id, {
      ...pageInput,
      expectedVersion: 2,
    })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
