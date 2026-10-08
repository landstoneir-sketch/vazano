import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  listProvinces() {
    return this.prisma.province.findMany({
      where: { isActive: true },
      select: { id: true, code: true, nameFa: true, nameEn: true },
      orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
    });
  }

  listCities(provinceId: string) {
    return this.prisma.city.findMany({
      where: { provinceId, isActive: true, province: { isActive: true } },
      select: { id: true, provinceId: true, code: true, nameFa: true, nameEn: true, isProvinceCapital: true },
      orderBy: [{ isProvinceCapital: 'desc' }, { sortOrder: 'asc' }, { nameFa: 'asc' }],
    });
  }
}
