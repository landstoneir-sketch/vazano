import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../shared/prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  it('returns a stable dynamic-form contract for active category attributes', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        isRequired: true,
        sortOrder: 2,
        attribute: {
          id: 'attribute-1',
          code: 'stone_color',
          nameFa: 'رنگ',
          nameEn: 'Color',
          dataType: 'SINGLE_SELECT',
          unitLabelFa: null,
          options: ['کرم', 'سفید'],
          validation: { maxSelections: 1 },
          version: 3,
        },
      },
      {
        isRequired: false,
        sortOrder: 3,
        attribute: {
          id: 'attribute-2',
          code: 'description',
          nameFa: 'توضیحات',
          nameEn: null,
          dataType: 'TEXT',
          unitLabelFa: null,
          options: null,
          validation: null,
          version: 1,
        },
      },
    ]);
    const prisma = { categoryAttribute: { findMany } } as unknown as PrismaService;
    const service = new CatalogService(prisma);

    await expect(service.listCategoryAttributes('category-1')).resolves.toEqual([
      {
        id: 'attribute-1', code: 'stone_color', nameFa: 'رنگ', nameEn: 'Color', dataType: 'SINGLE_SELECT',
        unitLabelFa: null, options: ['کرم', 'سفید'], validation: { maxSelections: 1 }, isRequired: true, sortOrder: 2, version: 3,
      },
      {
        id: 'attribute-2', code: 'description', nameFa: 'توضیحات', nameEn: null, dataType: 'TEXT',
        unitLabelFa: null, options: [], validation: {}, isRequired: false, sortOrder: 3, version: 1,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { categoryId: 'category-1', attribute: { isActive: true } },
      include: { attribute: true },
      orderBy: [{ sortOrder: 'asc' }, { attribute: { nameFa: 'asc' } }],
    });
  });

  it('inherits a knowledge profile and ignores malformed guidance entries', async () => {
    const prisma = {
      category: {
        findUnique: jest.fn().mockResolvedValue({ metadata: {}, parent: { metadata: { knowledgeProfile: 'natural-stone' } } }),
      },
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue({
          version: 4,
          value: {
            version: '1.2',
            packVersion: '2026-10',
            disclaimerFa: 'راهنما جایگزین نظر کارشناس نیست.',
            applications: [
              ['facade', 'نما', 'facade-profile', true],
              ['invalid'],
              [12, 'نامعتبر', 'invalid-profile'],
            ],
            profiles: {
              'facade-profile': {
                requiredChecks: ['مقاومت یخبندان', 12],
                comparisonCriteria: ['ثبات رنگ'],
                suggestedFamilies: ['تراورتن'],
              },
              malformed: 'not-an-object',
            },
          },
        }),
      },
    } as unknown as PrismaService;
    const service = new CatalogService(prisma);

    await expect(service.getCategoryGuidance('category-1')).resolves.toEqual({
      profile: 'natural-stone',
      version: '1.2',
      settingVersion: 4,
      packVersion: '2026-10',
      disclaimerFa: 'راهنما جایگزین نظر کارشناس نیست.',
      applications: [{ code: 'facade', labelFa: 'نما', profileKey: 'facade-profile', sensitive: true }],
      profiles: {
        'facade-profile': {
          requiredChecks: ['مقاومت یخبندان'],
          comparisonCriteria: ['ثبات رنگ'],
          suggestedFamilies: ['تراورتن'],
        },
      },
    });
  });

  it('returns an empty guide when no knowledge profile is assigned', async () => {
    const findSetting = jest.fn();
    const prisma = {
      category: { findUnique: jest.fn().mockResolvedValue({ metadata: null, parent: { metadata: {} } }) },
      systemSetting: { findUnique: findSetting },
    } as unknown as PrismaService;
    const service = new CatalogService(prisma);

    await expect(service.getCategoryGuidance('category-1')).resolves.toEqual({ profile: null, applications: [], profiles: {} });
    expect(findSetting).not.toHaveBeenCalled();
  });

  it('rejects guidance lookup for an unknown category', async () => {
    const prisma = { category: { findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    const service = new CatalogService(prisma);

    await expect(service.getCategoryGuidance('missing-category')).rejects.toBeInstanceOf(NotFoundException);
  });
});
