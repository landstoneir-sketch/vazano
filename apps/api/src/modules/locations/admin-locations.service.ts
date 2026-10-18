import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateCityDto } from './create-city.dto';
import { CreateProvinceDto } from './create-province.dto';
import { UpdateCityDto } from './update-city.dto';
import { UpdateProvinceDto } from './update-province.dto';

@Injectable()
export class AdminLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  listProvinces(user: AuthenticatedUser) {
    this.requireManagePermission(user);
    return this.prisma.province.findMany({ include: { _count: { select: { cities: true, rfqs: true } } }, orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }] });
  }

  listCities(user: AuthenticatedUser, provinceId?: string) {
    this.requireManagePermission(user);
    return this.prisma.city.findMany({
      where: provinceId ? { provinceId } : undefined,
      include: { province: { select: { id: true, nameFa: true } }, _count: { select: { rfqs: true } } },
      orderBy: [{ province: { sortOrder: 'asc' } }, { isProvinceCapital: 'desc' }, { sortOrder: 'asc' }, { nameFa: 'asc' }],
    });
  }

  async createProvince(user: AuthenticatedUser, input: CreateProvinceDto) {
    this.requireManagePermission(user);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const province = await tx.province.create({ data: { code: input.code.trim(), nameFa: input.nameFa.trim(), nameEn: input.nameEn?.trim() || null, sortOrder: input.sortOrder, isActive: input.isActive ?? true } });
        await tx.auditLog.create({ data: { actorUserId: user.id, action: 'location.province.create', entityType: 'Province', entityId: province.id, metadata: { code: province.code } } });
        return province;
      });
    } catch (error: unknown) {
      this.rethrowUniqueConflict(error, 'کد یا نام این استان قبلاً ثبت شده است.');
    }
  }

  async updateProvince(user: AuthenticatedUser, provinceId: string, input: UpdateProvinceDto) {
    this.requireManagePermission(user);
    const province = await this.prisma.province.findUnique({ where: { id: provinceId } });
    if (!province) throw new NotFoundException('استان پیدا نشد.');
    if (!input.isActive) {
      const activeCities = await this.prisma.city.count({ where: { provinceId, isActive: true } });
      if (activeCities > 0) throw new BadRequestException('پیش از غیرفعال‌کردن استان، شهرهای فعال آن را غیرفعال کنید.');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const result = await tx.province.updateMany({
          where: { id: provinceId, updatedAt: new Date(input.expectedUpdatedAt) },
          data: { nameFa: input.nameFa.trim(), nameEn: input.nameEn?.trim() || null, sortOrder: input.sortOrder, isActive: input.isActive },
        });
        if (result.count !== 1) throw new ConflictException('این استان هم‌زمان تغییر کرده است؛ اطلاعات را دوباره بارگذاری کنید.');
        await tx.auditLog.create({ data: { actorUserId: user.id, action: 'location.province.update', entityType: 'Province', entityId: provinceId, metadata: { code: province.code } } });
        return tx.province.findUniqueOrThrow({ where: { id: provinceId }, include: { _count: { select: { cities: true, rfqs: true } } } });
      });
    } catch (error: unknown) {
      this.rethrowUniqueConflict(error, 'نام این استان قبلاً ثبت شده است.');
    }
  }

  async createCity(user: AuthenticatedUser, input: CreateCityDto) {
    this.requireManagePermission(user);
    await this.assertProvince(input.provinceId, input.isActive ?? true);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const city = await tx.city.create({ data: { provinceId: input.provinceId, code: input.code.trim(), nameFa: input.nameFa.trim(), nameEn: input.nameEn?.trim() || null, isProvinceCapital: input.isProvinceCapital ?? false, sortOrder: input.sortOrder, isActive: input.isActive ?? true } });
        await tx.auditLog.create({ data: { actorUserId: user.id, action: 'location.city.create', entityType: 'City', entityId: city.id, metadata: { code: city.code, provinceId: city.provinceId } } });
        return city;
      });
    } catch (error: unknown) {
      this.rethrowUniqueConflict(error, 'کد یا نام این شهر در استان انتخاب‌شده قبلاً ثبت شده است.');
    }
  }

  async updateCity(user: AuthenticatedUser, cityId: string, input: UpdateCityDto) {
    this.requireManagePermission(user);
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city) throw new NotFoundException('شهر پیدا نشد.');
    await this.assertProvince(input.provinceId, input.isActive);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const result = await tx.city.updateMany({
          where: { id: cityId, updatedAt: new Date(input.expectedUpdatedAt) },
          data: { provinceId: input.provinceId, nameFa: input.nameFa.trim(), nameEn: input.nameEn?.trim() || null, isProvinceCapital: input.isProvinceCapital, sortOrder: input.sortOrder, isActive: input.isActive },
        });
        if (result.count !== 1) throw new ConflictException('این شهر هم‌زمان تغییر کرده است؛ اطلاعات را دوباره بارگذاری کنید.');
        await tx.auditLog.create({ data: { actorUserId: user.id, action: 'location.city.update', entityType: 'City', entityId: cityId, metadata: { code: city.code, provinceId: input.provinceId } } });
        return tx.city.findUniqueOrThrow({ where: { id: cityId }, include: { province: { select: { id: true, nameFa: true } }, _count: { select: { rfqs: true } } } });
      });
    } catch (error: unknown) {
      this.rethrowUniqueConflict(error, 'نام این شهر در استان انتخاب‌شده قبلاً ثبت شده است.');
    }
  }

  private async assertProvince(provinceId: string, requireActive: boolean) {
    const province = await this.prisma.province.findUnique({ where: { id: provinceId }, select: { isActive: true } });
    if (!province) throw new NotFoundException('استان انتخاب‌شده پیدا نشد.');
    if (requireActive && !province.isActive) throw new BadRequestException('شهر فعال باید در یک استان فعال قرار داشته باشد.');
  }

  private requireManagePermission(user: AuthenticatedUser) {
    if (!user.permissions.includes('location.manage')) throw new ForbiddenException('شما مجوز مدیریت استان‌ها و شهرها را ندارید.');
  }

  private rethrowUniqueConflict(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message);
    throw error;
  }
}
