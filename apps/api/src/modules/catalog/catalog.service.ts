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
}
