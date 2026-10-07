import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateCmsPageDto, UpdateCmsPageDto } from './cms-page.dto';
import { CreateFaqItemDto, UpdateFaqItemDto } from './faq-item.dto';

@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  getPublishedPage(slug: string) {
    return this.prisma.cmsPage.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: { slug: true, titleFa: true, excerptFa: true, bodyFa: true, seoTitleFa: true, seoDescriptionFa: true, publishedAt: true, updatedAt: true },
    }).then((page) => {
      if (!page) throw new NotFoundException('صفحه منتشرشده پیدا نشد.');
      return page;
    });
  }

  listPublishedFaqs() {
    return this.prisma.faqItem.findMany({
      where: { isPublished: true },
      select: { id: true, questionFa: true, answerFa: true, category: true, sortOrder: true, updatedAt: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  listPages(user: AuthenticatedUser) {
    this.requireContentManager(user);
    return this.prisma.cmsPage.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async createPage(user: AuthenticatedUser, input: CreateCmsPageDto) {
    this.requireContentManager(user);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const page = await tx.cmsPage.create({ data: {
          ...input,
          slug: input.slug.toLowerCase(),
          excerptFa: input.excerptFa || null,
          seoTitleFa: input.seoTitleFa || null,
          seoDescriptionFa: input.seoDescriptionFa || null,
          publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
          updatedByUserId: user.id,
        } });
        await tx.auditLog.create({ data: { actorUserId: user.id, action: 'cms.page.create', entityType: 'CmsPage', entityId: page.id, metadata: { slug: page.slug, status: page.status } } });
        return page;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('این نشانی صفحه قبلاً ثبت شده است.');
      throw error;
    }
  }

  async updatePage(user: AuthenticatedUser, pageId: string, input: UpdateCmsPageDto) {
    this.requireContentManager(user);
    const page = await this.prisma.cmsPage.findUnique({ where: { id: pageId } });
    if (!page) throw new NotFoundException('صفحه پیدا نشد.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const result = await tx.cmsPage.updateMany({
          where: { id: page.id, version: input.expectedVersion },
          data: {
            slug: input.slug.toLowerCase(), titleFa: input.titleFa, excerptFa: input.excerptFa || null, bodyFa: input.bodyFa,
            seoTitleFa: input.seoTitleFa || null, seoDescriptionFa: input.seoDescriptionFa || null, status: input.status,
            publishedAt: input.status === 'PUBLISHED' ? page.publishedAt ?? new Date() : page.publishedAt,
            updatedByUserId: user.id, version: { increment: 1 },
          },
        });
        if (result.count !== 1) throw new ConflictException('صفحه هم‌زمان تغییر کرده است؛ فهرست را تازه‌سازی کنید.');
        await tx.auditLog.create({ data: { actorUserId: user.id, action: 'cms.page.update', entityType: 'CmsPage', entityId: page.id, metadata: { slug: input.slug, fromStatus: page.status, toStatus: input.status, previousVersion: page.version } } });
        return tx.cmsPage.findUniqueOrThrow({ where: { id: page.id } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('این نشانی صفحه قبلاً ثبت شده است.');
      throw error;
    }
  }

  listFaqs(user: AuthenticatedUser) {
    this.requireContentManager(user);
    return this.prisma.faqItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }] });
  }

  async createFaq(user: AuthenticatedUser, input: CreateFaqItemDto) {
    this.requireContentManager(user);
    return this.prisma.$transaction(async (tx) => {
      const faq = await tx.faqItem.create({ data: { ...input, category: input.category || null, updatedByUserId: user.id } });
      await tx.auditLog.create({ data: { actorUserId: user.id, action: 'cms.faq.create', entityType: 'FaqItem', entityId: faq.id, metadata: { isPublished: faq.isPublished } } });
      return faq;
    });
  }

  async updateFaq(user: AuthenticatedUser, faqId: string, input: UpdateFaqItemDto) {
    this.requireContentManager(user);
    const faq = await this.prisma.faqItem.findUnique({ where: { id: faqId } });
    if (!faq) throw new NotFoundException('پرسش متداول پیدا نشد.');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.faqItem.updateMany({
        where: { id: faq.id, version: input.expectedVersion },
        data: { questionFa: input.questionFa, answerFa: input.answerFa, category: input.category || null, sortOrder: input.sortOrder, isPublished: input.isPublished, updatedByUserId: user.id, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new ConflictException('این پرسش هم‌زمان تغییر کرده است؛ فهرست را تازه‌سازی کنید.');
      await tx.auditLog.create({ data: { actorUserId: user.id, action: 'cms.faq.update', entityType: 'FaqItem', entityId: faq.id, metadata: { previousVersion: faq.version, isPublished: input.isPublished } } });
      return tx.faqItem.findUniqueOrThrow({ where: { id: faq.id } });
    });
  }

  async deleteFaq(user: AuthenticatedUser, faqId: string) {
    this.requireContentManager(user);
    const faq = await this.prisma.faqItem.findUnique({ where: { id: faqId } });
    if (!faq) throw new NotFoundException('پرسش متداول پیدا نشد.');
    return this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({ data: { actorUserId: user.id, action: 'cms.faq.delete', entityType: 'FaqItem', entityId: faq.id, metadata: { questionFa: faq.questionFa } } });
      await tx.faqItem.delete({ where: { id: faq.id } });
      return { id: faq.id, deleted: true };
    });
  }

  private requireContentManager(user: AuthenticatedUser): void {
    if (!user.permissions.includes('content.manage')) throw new ForbiddenException('شما مجوز مدیریت محتوا را ندارید.');
  }
}
