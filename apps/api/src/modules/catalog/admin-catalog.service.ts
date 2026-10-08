import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductAttributeDataType } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateCategoryDto } from './create-category.dto';
import { CreateProductAttributeDto } from './create-product-attribute.dto';
import { CreateUnitDto } from './create-unit.dto';
import { UpdateCategoryDto } from './update-category.dto';
import { UpdateProductAttributeDto } from './update-product-attribute.dto';
import { UpdateUnitDto } from './update-unit.dto';
import { UpsertCategoryAttributeDto } from './upsert-category-attribute.dto';

const categoryInclude = {
  industry: { select: { id: true, code: true, nameFa: true } },
  parent: { select: { id: true, code: true, nameFa: true } },
  attributeBindings: {
    include: { attribute: true },
    orderBy: { sortOrder: 'asc' as const },
  },
  _count: { select: { children: true, rfqItems: true, supplierCategories: true } },
} satisfies Prisma.CategoryInclude;

@Injectable()
export class AdminCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories(user: AuthenticatedUser) {
    this.requireManagePermission(user);
    return this.prisma.category.findMany({
      include: categoryInclude,
      orderBy: [{ industry: { sortOrder: 'asc' } }, { parentId: 'asc' }, { sortOrder: 'asc' }, { nameFa: 'asc' }],
    });
  }

  async createCategory(user: AuthenticatedUser, input: CreateCategoryDto) {
    this.requireManagePermission(user);
    const industry = await this.prisma.industry.findUnique({ where: { id: input.industryId } });
    if (!industry) throw new NotFoundException('حوزه صنعتی انتخاب‌شده پیدا نشد.');
    await this.assertValidParent(input.parentId, input.industryId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.category.create({
          data: {
            industryId: input.industryId,
            parentId: input.parentId || null,
            code: input.code.trim(),
            slug: input.slug.trim(),
            nameFa: input.nameFa.trim(),
            nameEn: input.nameEn?.trim() || null,
            sortOrder: input.sortOrder ?? 0,
            isActive: input.isActive ?? true,
          },
          include: categoryInclude,
        });
        await tx.auditLog.create({
          data: { actorUserId: user.id, action: 'category.create', entityType: 'Category', entityId: category.id, metadata: { code: category.code } },
        });
        return category;
      });
    } catch (error: unknown) {
      this.rethrowUniqueConflict(error, 'کد یا نشانی این دسته‌بندی قبلاً ثبت شده است.');
    }
  }

  async updateCategory(user: AuthenticatedUser, categoryId: string, input: UpdateCategoryDto) {
    this.requireManagePermission(user);
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('دسته‌بندی پیدا نشد.');

    const parentId = input.clearParent ? null : input.parentId ?? category.parentId;
    await this.assertValidParent(parentId ?? undefined, category.industryId, category.id);
    if (!input.isActive) {
      const activeChildren = await this.prisma.category.count({ where: { parentId: category.id, isActive: true } });
      if (activeChildren > 0) throw new BadRequestException('پیش از غیرفعال‌کردن این دسته، زیرگروه‌های فعال آن را غیرفعال کنید.');
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.category.updateMany({
        where: { id: category.id, updatedAt: new Date(input.expectedUpdatedAt) },
        data: {
          parentId,
          nameFa: input.nameFa.trim(),
          nameEn: input.nameEn?.trim() || null,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        },
      });
      if (result.count !== 1) throw new ConflictException('این دسته‌بندی هم‌زمان تغییر کرده است؛ اطلاعات را دوباره بارگذاری کنید.');
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'category.update',
          entityType: 'Category',
          entityId: category.id,
          metadata: { code: category.code, previousUpdatedAt: category.updatedAt.toISOString() },
        },
      });
      return tx.category.findUniqueOrThrow({ where: { id: category.id }, include: categoryInclude });
    });
  }

  listAttributes(user: AuthenticatedUser) {
    this.requireManagePermission(user);
    return this.prisma.productAttributeDefinition.findMany({
      include: {
        categoryLinks: {
          include: { category: { select: { id: true, code: true, nameFa: true, isActive: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ isActive: 'desc' }, { nameFa: 'asc' }],
    });
  }

  listUnits(user: AuthenticatedUser) {
    this.requireManagePermission(user);
    return this.prisma.unitOfMeasure.findMany({
      include: { _count: { select: { rfqItems: true } } },
      orderBy: [{ isActive: 'desc' }, { nameFa: 'asc' }],
    });
  }

  async createUnit(user: AuthenticatedUser, input: CreateUnitDto) {
    this.requireManagePermission(user);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const unit = await tx.unitOfMeasure.create({
          data: {
            code: input.code.trim(),
            nameFa: input.nameFa.trim(),
            symbolFa: input.symbolFa.trim(),
            decimalScale: input.decimalScale,
            isActive: input.isActive ?? true,
          },
          include: { _count: { select: { rfqItems: true } } },
        });
        await tx.auditLog.create({ data: {
          actorUserId: user.id,
          action: 'unit_of_measure.create',
          entityType: 'UnitOfMeasure',
          entityId: unit.id,
          metadata: { code: unit.code, symbolFa: unit.symbolFa },
        } });
        return unit;
      });
    } catch (error: unknown) {
      this.rethrowUniqueConflict(error, 'کد این واحد اندازه‌گیری قبلاً ثبت شده است.');
    }
  }

  async updateUnit(user: AuthenticatedUser, unitId: string, input: UpdateUnitDto) {
    this.requireManagePermission(user);
    const unit = await this.prisma.unitOfMeasure.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('واحد اندازه‌گیری پیدا نشد.');

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.unitOfMeasure.updateMany({
        where: { id: unit.id, updatedAt: new Date(input.expectedUpdatedAt) },
        data: {
          nameFa: input.nameFa.trim(),
          symbolFa: input.symbolFa.trim(),
          decimalScale: input.decimalScale,
          isActive: input.isActive,
        },
      });
      if (result.count !== 1) throw new ConflictException('این واحد هم‌زمان تغییر کرده است؛ اطلاعات را دوباره بارگذاری کنید.');
      await tx.auditLog.create({ data: {
        actorUserId: user.id,
        action: 'unit_of_measure.update',
        entityType: 'UnitOfMeasure',
        entityId: unit.id,
        metadata: { code: unit.code, previousUpdatedAt: unit.updatedAt.toISOString() },
      } });
      return tx.unitOfMeasure.findUniqueOrThrow({ where: { id: unit.id }, include: { _count: { select: { rfqItems: true } } } });
    });
  }

  async createAttribute(user: AuthenticatedUser, input: CreateProductAttributeDto) {
    this.requireManagePermission(user);
    const options = this.normalizeOptions(input.options ?? []);
    const validation = this.normalizeValidation(input.validation ?? {});
    this.validateAttributeConfiguration(input.dataType, options, validation);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const attribute = await tx.productAttributeDefinition.create({
          data: {
            code: input.code.trim(),
            nameFa: input.nameFa.trim(),
            nameEn: input.nameEn?.trim() || null,
            dataType: input.dataType,
            unitLabelFa: input.unitLabelFa?.trim() || null,
            options,
            validation,
            isActive: input.isActive ?? true,
          },
          include: { categoryLinks: true },
        });
        await tx.auditLog.create({
          data: { actorUserId: user.id, action: 'product_attribute.create', entityType: 'ProductAttributeDefinition', entityId: attribute.id, metadata: { code: attribute.code } },
        });
        return attribute;
      });
    } catch (error: unknown) {
      this.rethrowUniqueConflict(error, 'کد این ویژگی قبلاً ثبت شده است.');
    }
  }

  async updateAttribute(user: AuthenticatedUser, attributeId: string, input: UpdateProductAttributeDto) {
    this.requireManagePermission(user);
    const attribute = await this.prisma.productAttributeDefinition.findUnique({ where: { id: attributeId } });
    if (!attribute) throw new NotFoundException('ویژگی محصول پیدا نشد.');
    const options = this.normalizeOptions(input.options);
    const validation = this.normalizeValidation(input.validation);
    this.validateAttributeConfiguration(attribute.dataType, options, validation);

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.productAttributeDefinition.updateMany({
        where: { id: attribute.id, version: input.expectedVersion },
        data: {
          nameFa: input.nameFa.trim(),
          nameEn: input.nameEn?.trim() || null,
          unitLabelFa: input.unitLabelFa?.trim() || null,
          options,
          validation,
          isActive: input.isActive,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('این ویژگی هم‌زمان تغییر کرده است؛ اطلاعات را دوباره بارگذاری کنید.');
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'product_attribute.update',
          entityType: 'ProductAttributeDefinition',
          entityId: attribute.id,
          metadata: { code: attribute.code, previousVersion: attribute.version },
        },
      });
      return tx.productAttributeDefinition.findUniqueOrThrow({
        where: { id: attribute.id },
        include: { categoryLinks: { include: { category: { select: { id: true, code: true, nameFa: true, isActive: true } } } } },
      });
    });
  }

  async upsertBinding(user: AuthenticatedUser, categoryId: string, attributeId: string, input: UpsertCategoryAttributeDto) {
    this.requireManagePermission(user);
    const [category, attribute] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true, code: true } }),
      this.prisma.productAttributeDefinition.findUnique({ where: { id: attributeId }, select: { id: true, code: true } }),
    ]);
    if (!category) throw new NotFoundException('دسته‌بندی پیدا نشد.');
    if (!attribute) throw new NotFoundException('ویژگی محصول پیدا نشد.');

    return this.prisma.$transaction(async (tx) => {
      const binding = await tx.categoryAttribute.upsert({
        where: { categoryId_attributeId: { categoryId, attributeId } },
        create: { categoryId, attributeId, isRequired: input.isRequired, sortOrder: input.sortOrder },
        update: { isRequired: input.isRequired, sortOrder: input.sortOrder },
        include: { attribute: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'category_attribute.upsert',
          entityType: 'CategoryAttribute',
          entityId: `${categoryId}:${attributeId}`,
          metadata: { categoryCode: category.code, attributeCode: attribute.code, isRequired: input.isRequired, sortOrder: input.sortOrder },
        },
      });
      return binding;
    });
  }

  async removeBinding(user: AuthenticatedUser, categoryId: string, attributeId: string) {
    this.requireManagePermission(user);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.categoryAttribute.deleteMany({ where: { categoryId, attributeId } });
      if (result.count !== 1) throw new NotFoundException('اتصال ویژگی به دسته‌بندی پیدا نشد.');
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'category_attribute.remove',
          entityType: 'CategoryAttribute',
          entityId: `${categoryId}:${attributeId}`,
        },
      });
      return { removed: true };
    });
  }

  private requireManagePermission(user: AuthenticatedUser): void {
    if (!user.permissions.includes('category.manage')) throw new ForbiddenException('شما مجوز مدیریت دسته‌بندی‌ها را ندارید.');
  }

  private async assertValidParent(parentId: string | undefined, industryId: string, categoryId?: string): Promise<void> {
    if (!parentId) return;
    if (parentId === categoryId) throw new BadRequestException('یک دسته‌بندی نمی‌تواند والد خودش باشد.');
    let current = await this.prisma.category.findUnique({ where: { id: parentId }, select: { id: true, industryId: true, parentId: true } });
    if (!current) throw new NotFoundException('دسته‌بندی والد پیدا نشد.');
    if (current.industryId !== industryId) throw new BadRequestException('دسته‌بندی والد باید در همان حوزه صنعتی باشد.');
    const visited = new Set<string>();
    while (current) {
      if (current.id === categoryId) throw new BadRequestException('انتخاب این والد یک حلقه در درخت دسته‌بندی ایجاد می‌کند.');
      if (!current.parentId || visited.has(current.id)) break;
      visited.add(current.id);
      current = await this.prisma.category.findUnique({ where: { id: current.parentId }, select: { id: true, industryId: true, parentId: true } });
    }
  }

  private normalizeOptions(options: string[]): string[] {
    const normalized = [...new Set(options.map((option) => option.trim()).filter(Boolean))];
    if (normalized.length > 100 || normalized.some((option) => option.length > 100)) {
      throw new BadRequestException('حداکثر ۱۰۰ گزینه با طول حداکثر ۱۰۰ نویسه مجاز است.');
    }
    return normalized;
  }

  private normalizeValidation(validation: Record<string, unknown>): Prisma.InputJsonObject {
    const serialized = JSON.stringify(validation);
    if (serialized.length > 2_000) throw new BadRequestException('قواعد اعتبارسنجی بیش از حد بزرگ است.');
    return JSON.parse(serialized) as Prisma.InputJsonObject;
  }

  private validateAttributeConfiguration(dataType: ProductAttributeDataType, options: string[], validation: Prisma.InputJsonObject): void {
    const usesOptions = dataType === ProductAttributeDataType.SINGLE_SELECT || dataType === ProductAttributeDataType.MULTI_SELECT;
    if (usesOptions && options.length === 0) throw new BadRequestException('برای ویژگی‌های انتخابی حداقل یک گزینه تعریف کنید.');
    if (!usesOptions && options.length > 0) throw new BadRequestException('گزینه‌ها فقط برای ویژگی‌های انتخابی قابل تعریف هستند.');
    const min = validation.min;
    const max = validation.max;
    if (min !== undefined && typeof min !== 'number') throw new BadRequestException('کمینه باید عدد باشد.');
    if (max !== undefined && typeof max !== 'number') throw new BadRequestException('بیشینه باید عدد باشد.');
    if (typeof min === 'number' && typeof max === 'number' && min > max) throw new BadRequestException('کمینه نمی‌تواند از بیشینه بیشتر باشد.');
  }

  private rethrowUniqueConflict(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message);
    throw error;
  }
}
