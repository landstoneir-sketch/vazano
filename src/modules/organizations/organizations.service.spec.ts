import { BadRequestException } from '@nestjs/common';
import { OrganizationKind, OrganizationType } from '@prisma/client';
import type { PrismaService } from '../../shared/prisma/prisma.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService location integrity', () => {
  function setup() {
    const tx = {
      province: { findFirst: jest.fn() },
      city: { findFirst: jest.fn() },
      organization: { create: jest.fn() },
      organizationMember: { create: jest.fn() },
      auditLog: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
    };
    const transaction = jest.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx));
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    return { service: new OrganizationsService(prisma), tx };
  }

  const baseInput = {
    kind: OrganizationKind.BUYER,
    type: OrganizationType.COMPANY,
    legalName: 'شرکت خریدار نمونه',
    displayName: 'خریدار نمونه',
    nationalId: '10101010101',
  };

  it('stores canonical location names instead of client location IDs', async () => {
    const { service, tx } = setup();
    tx.province.findFirst.mockResolvedValue({ id: 'province-tehran', nameFa: 'تهران' });
    tx.city.findFirst.mockResolvedValue({ nameFa: 'شهریار' });
    tx.organization.create.mockResolvedValue({ id: 'organization-1', kind: OrganizationKind.BUYER });

    await service.create('user-1', { ...baseInput, provinceId: 'province-tehran', cityId: 'city-shahriar' });

    expect(tx.city.findFirst).toHaveBeenCalledWith({
      where: { id: 'city-shahriar', provinceId: 'province-tehran', isActive: true },
      select: { nameFa: true },
    });
    expect(tx.organization.create).toHaveBeenCalledWith({
      data: {
        kind: OrganizationKind.BUYER,
        type: OrganizationType.COMPANY,
        legalName: 'شرکت خریدار نمونه',
        displayName: 'خریدار نمونه',
        nationalId: '10101010101',
        province: 'تهران',
        city: 'شهریار',
        status: 'ACTIVE',
      },
    });
  });

  it('rejects a city that does not belong to the selected active province', async () => {
    const { service, tx } = setup();
    tx.province.findFirst.mockResolvedValue({ id: 'province-tehran', nameFa: 'تهران' });
    tx.city.findFirst.mockResolvedValue(null);

    await expect(service.create('user-1', { ...baseInput, provinceId: 'province-tehran', cityId: 'city-isfahan' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.organization.create).not.toHaveBeenCalled();
  });

  it('rejects a city when no province is supplied', async () => {
    const { service, tx } = setup();

    await expect(service.create('user-1', { ...baseInput, cityId: 'city-shahriar' }))
      .rejects.toThrow('برای انتخاب شهر، استان را نیز انتخاب کنید.');
    expect(tx.province.findFirst).not.toHaveBeenCalled();
  });
});
