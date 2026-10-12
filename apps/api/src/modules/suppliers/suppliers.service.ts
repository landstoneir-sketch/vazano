import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupplierVerificationStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpsertSupplierProfileDto } from './upsert-supplier-profile.dto';
import { VerifySupplierDto } from './verify-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublicProfiles() {
    const organizations = await this.prisma.organization.findMany({
      where: { kind: 'SUPPLIER', status: 'ACTIVE', supplierProfile: { verificationStatus: 'VERIFIED' } },
      select: {
        id: true, displayName: true, province: true, city: true,
        supplierProfile: { select: { description: true, nationwideCoverage: true, categories: { select: { category: { select: { id: true, nameFa: true, slug: true } } } } } },
      },
      orderBy: { displayName: 'asc' },
      take: 100,
    });
    const organizationIds = organizations.map((organization) => organization.id);
    const ratings = organizationIds.length > 0 ? await this.prisma.supplierReview.groupBy({
      by: ['supplierOrganizationId'],
      where: { supplierOrganizationId: { in: organizationIds }, status: 'PUBLISHED' },
      _count: { _all: true },
      _avg: { rating: true },
    }) : [];
    const ratingMap = new Map(ratings.map((rating) => [rating.supplierOrganizationId, { count: rating._count._all, averageRating: rating._avg.rating }]));
    return organizations.map((organization) => ({ ...organization, reviewSummary: ratingMap.get(organization.id) ?? { count: 0, averageRating: null } }));
  }

  async getPublicProfile(organizationId: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, kind: 'SUPPLIER', status: 'ACTIVE', supplierProfile: { verificationStatus: 'VERIFIED' } },
      select: {
        id: true, displayName: true, province: true, city: true,
        supplierProfile: {
          select: {
            description: true, nationwideCoverage: true,
            serviceProvinceLinks: { select: { province: { select: { id: true, nameFa: true } } }, orderBy: { province: { sortOrder: 'asc' } } },
            categories: { select: { category: { select: { id: true, nameFa: true, slug: true } } }, orderBy: { category: { sortOrder: 'asc' } } },
          },
        },
      },
    });
    if (!organization) throw new NotFoundException('پروفایل عمومی فروشنده پیدا نشد.');
    const [aggregate, recentReviews] = await Promise.all([
      this.prisma.supplierReview.aggregate({ where: { supplierOrganizationId: organization.id, status: 'PUBLISHED' }, _count: { _all: true }, _avg: { rating: true } }),
      this.prisma.supplierReview.findMany({
        where: { supplierOrganizationId: organization.id, status: 'PUBLISHED' },
        select: { id: true, rating: true, comment: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { ...organization, reviewSummary: { count: aggregate._count._all, averageRating: aggregate._avg.rating }, recentReviews };
  }

  async performance(user: AuthenticatedUser) {
    const organizationIds = user.memberships
      .filter((membership) => ['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES'].includes(membership.role))
      .map((membership) => membership.organizationId);
    if (organizationIds.length === 0) return [];
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    const organizations = await this.prisma.organization.findMany({
      where: { id: { in: organizationIds }, kind: 'SUPPLIER' },
      select: {
        id: true,
        displayName: true,
        supplierProfile: { select: { verificationStatus: true } },
        creditWallet: { select: { cachedBalanceCredits: true } },
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'GRACE'] } },
          select: { status: true, expiresAt: true, graceEndsAt: true, plan: { select: { nameFa: true } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return Promise.all(organizations.map(async (organization) => {
      const [invitations, submittedOpportunities, wins, recentInvitations, responseSamples, reviewSummary] = await Promise.all([
        this.prisma.rfqInvitation.count({ where: { supplierOrganizationId: organization.id } }),
        this.prisma.rfqInvitation.count({ where: { supplierOrganizationId: organization.id, status: 'RESPONDED' } }),
        this.prisma.quotation.count({ where: { supplierOrganizationId: organization.id, status: 'ACCEPTED' } }),
        this.prisma.rfqInvitation.count({ where: { supplierOrganizationId: organization.id, invitedAt: { gte: since } } }),
        this.prisma.rfqInvitation.findMany({
          where: { supplierOrganizationId: organization.id, respondedAt: { not: null } },
          select: { invitedAt: true, respondedAt: true },
          orderBy: { respondedAt: 'desc' },
          take: 500,
        }),
        this.prisma.supplierReview.aggregate({
          where: { supplierOrganizationId: organization.id, status: 'PUBLISHED' },
          _count: { _all: true },
          _avg: { rating: true },
        }),
      ]);
      const totalResponseHours = responseSamples.reduce((total, item) => total + ((item.respondedAt!.getTime() - item.invitedAt.getTime()) / 3_600_000), 0);
      return {
        organizationId: organization.id,
        organizationName: organization.displayName,
        verificationStatus: organization.supplierProfile?.verificationStatus ?? 'INCOMPLETE',
        invitations,
        respondedOpportunities: submittedOpportunities,
        wins,
        recentInvitations,
        responseRatePercent: invitations > 0 ? Math.round((submittedOpportunities / invitations) * 1000) / 10 : 0,
        winRatePercent: submittedOpportunities > 0 ? Math.round((wins / submittedOpportunities) * 1000) / 10 : 0,
        averageResponseHours: responseSamples.length > 0 ? Math.round((totalResponseHours / responseSamples.length) * 10) / 10 : null,
        reviewCount: reviewSummary._count._all,
        averageRating: reviewSummary._avg.rating,
        availableCredits: organization.creditWallet?.cachedBalanceCredits ?? 0n,
        subscription: organization.subscriptions[0] ?? null,
      };
    }));
  }

  listVerificationQueue(user: AuthenticatedUser) {
    if (!user.permissions.includes('supplier.verify')) throw new ForbiddenException('مجوز مشاهده صف بررسی فروشندگان را ندارید.');
    return this.prisma.organization.findMany({
      where: { kind: 'SUPPLIER', supplierProfile: { verificationStatus: { in: ['PENDING', 'NEEDS_CORRECTION'] } } },
      include: {
        supplierProfile: { include: { categories: { include: { category: true } }, serviceProvinceLinks: { include: { province: true } }, verificationDocuments: { where: { status: { not: 'DELETED' } }, select: { id: true, purpose: true, status: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true, createdAt: true }, orderBy: { createdAt: 'asc' } } } },
        members: { where: { status: 'ACTIVE', role: 'SUPPLIER_OWNER' }, include: { user: { select: { id: true, mobile: true, firstName: true, lastName: true } } } },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  async getProfile(user: AuthenticatedUser, organizationId: string) {
    this.assertCanManageProfile(user, organizationId);
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, kind: 'SUPPLIER' },
      include: { supplierProfile: { include: { categories: { include: { category: true } }, serviceProvinceLinks: { include: { province: true } }, verificationDocuments: { where: { status: { not: 'DELETED' } }, select: { id: true, purpose: true, status: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true, createdAt: true }, orderBy: { createdAt: 'asc' } } } } },
    });
    if (!organization) throw new NotFoundException('سازمان فروشنده پیدا نشد.');
    return organization;
  }

  async upsertProfile(user: AuthenticatedUser, organizationId: string, input: UpsertSupplierProfileDto) {
    this.assertCanManageProfile(user, organizationId);
    const organization = await this.prisma.organization.findFirst({ where: { id: organizationId, kind: 'SUPPLIER' } });
    if (!organization) throw new NotFoundException('سازمان فروشنده پیدا نشد.');
    const serviceProvinceIds = input.nationwideCoverage ? [] : [...new Set(input.serviceProvinceIds)];
    if (!input.nationwideCoverage && serviceProvinceIds.length === 0) {
      throw new BadRequestException('حداقل یک استان خدمت‌رسانی یا پوشش کل ایران را انتخاب کنید.');
    }
    const categoryIds = [...new Set(input.categories.map((item) => item.categoryId))];
    const categoryCount = await this.prisma.category.count({ where: { id: { in: categoryIds }, isActive: true } });
    if (categoryCount !== categoryIds.length) throw new BadRequestException('یک یا چند دسته‌بندی انتخاب‌شده معتبر نیست.');
    const provinces = await this.prisma.province.findMany({ where: { id: { in: serviceProvinceIds }, isActive: true }, select: { id: true, nameFa: true } });
    if (provinces.length !== serviceProvinceIds.length) throw new BadRequestException('یک یا چند استان خدمت‌رسانی معتبر نیست.');
    const serviceProvinceNames = provinces.map((province) => province.nameFa);

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.supplierProfile.upsert({
        where: { organizationId },
        create: {
          organizationId,
          description: input.description,
          nationwideCoverage: input.nationwideCoverage,
          serviceProvinces: serviceProvinceNames,
          verificationStatus: 'PENDING',
        },
        update: {
          description: input.description,
          nationwideCoverage: input.nationwideCoverage,
          serviceProvinces: serviceProvinceNames,
          verificationStatus: 'PENDING',
          verificationReason: null,
          verifiedAt: null,
        },
      });
      await tx.supplierCategory.deleteMany({ where: { supplierProfileId: profile.id } });
      await tx.supplierCategory.createMany({ data: categoryIds.map((categoryId) => ({ supplierProfileId: profile.id, categoryId })) });
      await tx.supplierServiceProvince.deleteMany({ where: { supplierProfileId: profile.id } });
      if (serviceProvinceIds.length > 0) {
        await tx.supplierServiceProvince.createMany({ data: serviceProvinceIds.map((provinceId) => ({ supplierProfileId: profile.id, provinceId })) });
      }
      await tx.organization.update({ where: { id: organizationId }, data: { status: 'PENDING' } });
      await tx.auditLog.create({
        data: { actorUserId: user.id, organizationId, action: 'supplier.profile.submit', entityType: 'SupplierProfile', entityId: profile.id },
      });
      await tx.outboxEvent.create({
        data: { aggregateType: 'SupplierProfile', aggregateId: profile.id, eventType: 'ir.vazano.supplier.profile.submitted.v1', payload: { organizationId, categoryIds } },
      });
      return tx.supplierProfile.findUniqueOrThrow({ where: { id: profile.id }, include: { categories: { include: { category: true } }, serviceProvinceLinks: { include: { province: true } }, verificationDocuments: { where: { status: { not: 'DELETED' } }, select: { id: true, purpose: true, status: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true, createdAt: true }, orderBy: { createdAt: 'asc' } } } });
    });
  }

  async verify(user: AuthenticatedUser, organizationId: string, input: VerifySupplierDto) {
    if (!user.permissions.includes('supplier.verify')) throw new ForbiddenException('مجوز بررسی فروشنده را ندارید.');
    const allowed: SupplierVerificationStatus[] = ['VERIFIED', 'NEEDS_CORRECTION', 'REJECTED', 'SUSPENDED'];
    if (!allowed.includes(input.status)) throw new BadRequestException('وضعیت بررسی انتخاب‌شده معتبر نیست.');
    if (input.status !== 'VERIFIED' && !input.reason?.trim()) throw new BadRequestException('ثبت دلیل برای این تصمیم الزامی است.');
    const profile = await this.prisma.supplierProfile.findUnique({ where: { organizationId } });
    if (!profile) throw new NotFoundException('پروفایل فروشنده برای بررسی پیدا نشد.');
    if (input.status === 'VERIFIED') {
      const readyDocumentCount = await this.prisma.attachment.count({ where: { supplierProfileId: profile.id, purpose: 'CERTIFICATE', status: 'READY' } });
      if (readyDocumentCount === 0) throw new BadRequestException('تأیید فروشنده بدون حداقل یک مدرک سالم و بررسی‌شده مجاز نیست.');
    }
    const organizationStatus = input.status === 'VERIFIED' ? 'ACTIVE' : input.status === 'SUSPENDED' ? 'SUSPENDED' : 'PENDING';
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.supplierProfile.update({
        where: { id: profile.id },
        data: {
          verificationStatus: input.status,
          verificationReason: input.reason?.trim() || null,
          verifiedAt: input.status === 'VERIFIED' ? new Date() : null,
        },
        include: { categories: { include: { category: true } } },
      });
      await tx.organization.update({ where: { id: organizationId }, data: { status: organizationStatus } });
      await tx.auditLog.create({
        data: { actorUserId: user.id, organizationId, action: `supplier.verify.${input.status.toLowerCase()}`, entityType: 'SupplierProfile', entityId: profile.id, metadata: { reason: input.reason ?? null } },
      });
      await tx.outboxEvent.create({
        data: { aggregateType: 'SupplierProfile', aggregateId: profile.id, eventType: 'ir.vazano.supplier.verification.changed.v1', payload: { organizationId, status: input.status } },
      });
      return result;
    });
  }

  private assertCanManageProfile(user: AuthenticatedUser, organizationId: string): void {
    const membership = user.memberships.find((item) => item.organizationId === organizationId);
    const allowed = membership?.role === 'SUPPLIER_OWNER' || membership?.role === 'SUPPLIER_MANAGER' || user.permissions.includes('supplier.verify');
    if (!allowed) throw new ForbiddenException('مجوز مدیریت پروفایل این فروشنده را ندارید.');
  }
}
