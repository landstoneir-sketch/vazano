import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupplierVerificationStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpsertSupplierProfileDto } from './upsert-supplier-profile.dto';
import { VerifySupplierDto } from './verify-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  listVerificationQueue(user: AuthenticatedUser) {
    if (!user.permissions.includes('supplier.verify')) throw new ForbiddenException('مجوز مشاهده صف بررسی فروشندگان را ندارید.');
    return this.prisma.organization.findMany({
      where: { kind: 'SUPPLIER', supplierProfile: { verificationStatus: { in: ['PENDING', 'NEEDS_CORRECTION'] } } },
      include: {
        supplierProfile: { include: { categories: { include: { category: true } }, serviceProvinceLinks: { include: { province: true } } } },
        members: { where: { status: 'ACTIVE', role: 'SUPPLIER_OWNER' }, include: { user: { select: { id: true, mobile: true, firstName: true, lastName: true } } } },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }

  async getProfile(user: AuthenticatedUser, organizationId: string) {
    this.assertCanManageProfile(user, organizationId);
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, kind: 'SUPPLIER' },
      include: { supplierProfile: { include: { categories: { include: { category: true } }, serviceProvinceLinks: { include: { province: true } } } } },
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
      return tx.supplierProfile.findUniqueOrThrow({ where: { id: profile.id }, include: { categories: { include: { category: true } }, serviceProvinceLinks: { include: { province: true } } } });
    });
  }

  async verify(user: AuthenticatedUser, organizationId: string, input: VerifySupplierDto) {
    if (!user.permissions.includes('supplier.verify')) throw new ForbiddenException('مجوز بررسی فروشنده را ندارید.');
    const allowed: SupplierVerificationStatus[] = ['VERIFIED', 'NEEDS_CORRECTION', 'REJECTED', 'SUSPENDED'];
    if (!allowed.includes(input.status)) throw new BadRequestException('وضعیت بررسی انتخاب‌شده معتبر نیست.');
    if (input.status !== 'VERIFIED' && !input.reason?.trim()) throw new BadRequestException('ثبت دلیل برای این تصمیم الزامی است.');
    const profile = await this.prisma.supplierProfile.findUnique({ where: { organizationId } });
    if (!profile) throw new NotFoundException('پروفایل فروشنده برای بررسی پیدا نشد.');
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
