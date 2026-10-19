import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupplierProductStatus, SupplierVerificationStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpsertSupplierProfileDto } from './upsert-supplier-profile.dto';
import { VerifySupplierDto } from './verify-supplier.dto';
import type { PublicSupplierSearchDto } from './public-supplier-search.dto';
import { CreateSupplierProductDto } from './create-supplier-product.dto';
import { UpdateSupplierProductDto } from './update-supplier-product.dto';
import { assertValidProductSpecifications } from '../catalog/product-specification-policy';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublicProfiles(search: PublicSupplierSearchDto = {}) {
    const query = search.q?.trim();
    const province = search.province?.trim();
    const supplierProfileWhere: Prisma.SupplierProfileWhereInput = {
      verificationStatus: 'VERIFIED',
      ...(search.category ? { categories: { some: { category: { slug: search.category, isActive: true } } } } : {}),
    };
    const where: Prisma.OrganizationWhereInput = {
      kind: 'SUPPLIER',
      status: 'ACTIVE',
      supplierProfile: { is: supplierProfileWhere },
      ...(province ? { OR: [{ province: { contains: province, mode: 'insensitive' } }, { city: { contains: province, mode: 'insensitive' } }] } : {}),
      ...(query ? {
        AND: [{
          OR: [
            { displayName: { contains: query, mode: 'insensitive' } },
            { province: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
            { supplierProfile: { is: { categories: { some: { category: { nameFa: { contains: query, mode: 'insensitive' }, isActive: true } } } } } },
            { supplierProfile: { is: { products: { some: { status: 'PUBLISHED', isAvailable: true, category: { isActive: true }, nameFa: { contains: query, mode: 'insensitive' } } } } } },
          ],
        }],
      } : {}),
    };
    const organizations = await this.prisma.organization.findMany({
      where,
      select: {
        id: true, displayName: true, province: true, city: true,
        supplierProfile: { select: { description: true, productionCapacityDescription: true, minimumOrderDescription: true, leadTimeDescription: true, officialInvoiceAvailable: true, sampleAvailable: true, installationAvailable: true, nationwideCoverage: true, categories: { select: { category: { select: { id: true, nameFa: true, slug: true } } } } } },
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
            description: true, productionCapacityDescription: true, minimumOrderDescription: true, leadTimeDescription: true, officialInvoiceAvailable: true, sampleAvailable: true, installationAvailable: true, nationwideCoverage: true,
            serviceProvinceLinks: { select: { province: { select: { id: true, nameFa: true } } }, orderBy: { province: { sortOrder: 'asc' } } },
            categories: { select: { category: { select: { id: true, nameFa: true, slug: true } } }, orderBy: { category: { sortOrder: 'asc' } } },
            products: {
              where: { status: 'PUBLISHED', isAvailable: true, category: { isActive: true } },
              select: { id: true, nameFa: true, sku: true, description: true, specifications: true, minimumOrderDescription: true, leadTimeDescription: true, category: { select: { id: true, nameFa: true, slug: true, attributeBindings: { include: { attribute: true }, orderBy: { sortOrder: 'asc' } } } } },
              orderBy: { updatedAt: 'desc' },
              take: 50,
            },
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

  async listProducts(user: AuthenticatedUser, organizationId: string) {
    this.assertCanViewSupplier(user, organizationId);
    const profile = await this.prisma.supplierProfile.findUnique({ where: { organizationId }, select: { id: true } });
    if (!profile) return [];
    return this.prisma.supplierProduct.findMany({
      where: { supplierProfileId: profile.id },
      include: { category: { select: { id: true, nameFa: true, slug: true, attributeBindings: { include: { attribute: true }, orderBy: { sortOrder: 'asc' } } } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async createProduct(user: AuthenticatedUser, organizationId: string, input: CreateSupplierProductDto) {
    this.assertCanManageProfile(user, organizationId);
    const { profileId, bindings } = await this.productContext(organizationId, input.categoryId);
    const status = input.status ?? SupplierProductStatus.DRAFT;
    const specifications = input.specifications ?? {};
    assertValidProductSpecifications(specifications, bindings, status === SupplierProductStatus.PUBLISHED);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.supplierProduct.create({
          data: {
            supplierProfileId: profileId,
            categoryId: input.categoryId,
            nameFa: input.nameFa.trim(),
            sku: input.sku?.trim() || null,
            description: input.description?.trim() || null,
            specifications,
            minimumOrderDescription: input.minimumOrderDescription?.trim() || null,
            leadTimeDescription: input.leadTimeDescription?.trim() || null,
            isAvailable: input.isAvailable ?? true,
            status,
          },
          include: { category: { select: { id: true, nameFa: true, slug: true, attributeBindings: { include: { attribute: true }, orderBy: { sortOrder: 'asc' } } } } },
        });
        await tx.auditLog.create({ data: { actorUserId: user.id, organizationId, action: 'supplier_product.create', entityType: 'SupplierProduct', entityId: product.id, metadata: { status, categoryId: input.categoryId } } });
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'SupplierProduct',
            aggregateId: product.id,
            eventType: 'ir.vazano.supplier.product.created.v1',
            payload: {
              organizationId,
              productId: product.id,
              categoryId: input.categoryId,
              status,
            },
          },
        });
        return product;
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('کد محصول در این سازمان تکراری است.');
      throw error;
    }
  }

  async updateProduct(user: AuthenticatedUser, organizationId: string, productId: string, input: UpdateSupplierProductDto) {
    this.assertCanManageProfile(user, organizationId);
    const existing = await this.prisma.supplierProduct.findFirst({ where: { id: productId, supplierProfile: { organizationId } } });
    if (!existing) throw new NotFoundException('محصول فروشنده پیدا نشد.');
    const { bindings } = await this.productContext(organizationId, input.categoryId);
    const status = input.status ?? existing.status;
    const specifications = input.specifications ?? {};
    assertValidProductSpecifications(specifications, bindings, status === SupplierProductStatus.PUBLISHED);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const result = await tx.supplierProduct.updateMany({
          where: { id: existing.id, version: input.expectedVersion },
          data: {
            categoryId: input.categoryId,
            nameFa: input.nameFa.trim(),
            sku: input.sku?.trim() || null,
            description: input.description?.trim() || null,
            specifications,
            minimumOrderDescription: input.minimumOrderDescription?.trim() || null,
            leadTimeDescription: input.leadTimeDescription?.trim() || null,
            isAvailable: input.isAvailable ?? true,
            status,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) throw new ConflictException('این محصول هم‌زمان ویرایش شده است؛ فهرست را تازه‌سازی کنید.');
        await tx.auditLog.create({ data: { actorUserId: user.id, organizationId, action: 'supplier_product.update', entityType: 'SupplierProduct', entityId: existing.id, metadata: { fromStatus: existing.status, toStatus: status, previousVersion: existing.version } } });
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'SupplierProduct',
            aggregateId: existing.id,
            eventType: 'ir.vazano.supplier.product.updated.v1',
            payload: {
              organizationId,
              productId: existing.id,
              categoryId: input.categoryId,
              status,
            },
          },
        });
        return tx.supplierProduct.findUniqueOrThrow({
          where: { id: existing.id },
          include: {
            category: {
              select: {
                id: true,
                nameFa: true,
                slug: true,
                attributeBindings: { include: { attribute: true }, orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        });
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('کد محصول در این سازمان تکراری است.');
      throw error;
    }
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
    const capabilityData = {
      description: input.description?.trim() || null,
      productionCapacityDescription: input.productionCapacityDescription?.trim() || null,
      minimumOrderDescription: input.minimumOrderDescription?.trim() || null,
      leadTimeDescription: input.leadTimeDescription?.trim() || null,
      officialInvoiceAvailable: input.officialInvoiceAvailable ?? false,
      sampleAvailable: input.sampleAvailable ?? false,
      installationAvailable: input.installationAvailable ?? false,
    };

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.supplierProfile.upsert({
        where: { organizationId },
        create: {
          organizationId,
          ...capabilityData,
          nationwideCoverage: input.nationwideCoverage,
          serviceProvinces: serviceProvinceNames,
          verificationStatus: 'PENDING',
        },
        update: {
          ...capabilityData,
          nationwideCoverage: input.nationwideCoverage,
          serviceProvinces: serviceProvinceNames,
          verificationStatus: 'PENDING',
          verificationReason: null,
          verifiedAt: null,
        },
      });
      await tx.supplierCategory.deleteMany({ where: { supplierProfileId: profile.id } });
      await tx.supplierCategory.createMany({ data: categoryIds.map((categoryId) => ({ supplierProfileId: profile.id, categoryId })) });
      await tx.supplierProduct.updateMany({
        where: { supplierProfileId: profile.id, categoryId: { notIn: categoryIds }, status: { not: 'ARCHIVED' } },
        data: { status: 'ARCHIVED', version: { increment: 1 } },
      });
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

  private assertCanViewSupplier(user: AuthenticatedUser, organizationId: string): void {
    const isMember = user.memberships.some((item) => item.organizationId === organizationId && ['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES'].includes(item.role));
    if (!isMember && !user.permissions.includes('supplier.verify')) throw new ForbiddenException('مجوز مشاهده محصولات این فروشنده را ندارید.');
  }

  private async productContext(organizationId: string, categoryId: string) {
    const profile = await this.prisma.supplierProfile.findUnique({
      where: { organizationId },
      select: { id: true, categories: { where: { categoryId }, select: { categoryId: true } } },
    });
    if (!profile) throw new NotFoundException('ابتدا پروفایل فروشنده را تکمیل کنید.');
    if (profile.categories.length === 0) throw new BadRequestException('محصول باید در یکی از دسته‌های تأییدشده پروفایل فروشنده ثبت شود.');
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, isActive: true },
      select: { attributeBindings: { where: { attribute: { isActive: true } }, include: { attribute: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!category) throw new BadRequestException('دسته‌بندی محصول معتبر یا فعال نیست.');
    return { profileId: profile.id, bindings: category.attributeBindings };
  }
}
