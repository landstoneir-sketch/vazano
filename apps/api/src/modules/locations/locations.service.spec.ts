import type { PrismaService } from '../../shared/prisma/prisma.service';
import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  it('returns only active provinces in owner-defined order', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new LocationsService({ province: { findMany } } as unknown as PrismaService);

    await service.listProvinces();

    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true, code: true, nameFa: true, nameEn: true },
      orderBy: [{ sortOrder: 'asc' }, { nameFa: 'asc' }],
    });
  });

  it('does not expose cities from inactive provinces', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new LocationsService({ city: { findMany } } as unknown as PrismaService);

    await service.listCities('province-1');

    expect(findMany).toHaveBeenCalledWith({
      where: { provinceId: 'province-1', isActive: true, province: { isActive: true } },
      select: { id: true, provinceId: true, code: true, nameFa: true, nameEn: true, isProvinceCapital: true },
      orderBy: [{ isProvinceCapital: 'desc' }, { sortOrder: 'asc' }, { nameFa: 'asc' }],
    });
  });
});
