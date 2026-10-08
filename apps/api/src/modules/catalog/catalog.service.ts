import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listIndustries() {
    return this.prisma.industry.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
    });
  }

  listCategories(industryId?: string) {
    return this.prisma.category.findMany({
      where: { isActive: true, ...(industryId ? { industryId } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
    });
  }

  listUnits() {
    return this.prisma.unitOfMeasure.findMany({
      where: { isActive: true },
      orderBy: { nameFa: 'asc' },
    });
  }

  async listCategoryAttributes(categoryId: string) {
    const bindings = await this.prisma.categoryAttribute.findMany({
      where: { categoryId, attribute: { isActive: true } },
      include: { attribute: true },
      orderBy: [{ sortOrder: 'asc' }, { attribute: { nameFa: 'asc' } }],
    });
    return bindings.map(({ isRequired, sortOrder, attribute }) => ({
      id: attribute.id,
      code: attribute.code,
      nameFa: attribute.nameFa,
      nameEn: attribute.nameEn,
      dataType: attribute.dataType,
      unitLabelFa: attribute.unitLabelFa,
      options: Array.isArray(attribute.options) ? attribute.options : [],
      validation: typeof attribute.validation === 'object' && attribute.validation !== null ? attribute.validation : {},
      isRequired,
      sortOrder,
      version: attribute.version,
    }));
  }
}
