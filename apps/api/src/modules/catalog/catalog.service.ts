import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

type GuidanceProfile = {
  requiredChecks: string[];
  comparisonCriteria: string[];
  suggestedFamilies: string[];
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function knowledgeProfile(metadata: unknown): string | null {
  const value = objectValue(metadata)?.knowledgeProfile;
  return typeof value === 'string' && /^[a-z0-9-]+$/.test(value) ? value : null;
}

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

  async getCategoryGuidance(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { metadata: true, parent: { select: { metadata: true } } },
    });
    if (!category) throw new NotFoundException('دسته‌بندی پیدا نشد.');

    const profile = knowledgeProfile(category.metadata) ?? knowledgeProfile(category.parent?.metadata);
    if (!profile) return { profile: null, applications: [], profiles: {} };

    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: `knowledge.application_guidance.${profile}.v1` },
      select: { value: true, version: true },
    });
    const value = objectValue(setting?.value);
    if (!value) return { profile, applications: [], profiles: {} };

    const rawProfiles = objectValue(value.profiles) ?? {};
    const profiles = Object.fromEntries(
      Object.entries(rawProfiles).flatMap(([key, raw]) => {
        const parsed = objectValue(raw);
        if (!parsed) return [];
        const guidance: GuidanceProfile = {
          requiredChecks: stringList(parsed.requiredChecks),
          comparisonCriteria: stringList(parsed.comparisonCriteria),
          suggestedFamilies: stringList(parsed.suggestedFamilies),
        };
        return [[key, guidance]];
      }),
    );
    const applications = Array.isArray(value.applications)
      ? value.applications.flatMap((raw) => {
          if (!Array.isArray(raw) || typeof raw[0] !== 'string' || typeof raw[1] !== 'string' || typeof raw[2] !== 'string') return [];
          return [{ code: raw[0], labelFa: raw[1], profileKey: raw[2], sensitive: raw[3] === true }];
        })
      : [];

    return {
      profile,
      version: typeof value.version === 'string' ? value.version : '1.0',
      settingVersion: setting?.version ?? 0,
      packVersion: typeof value.packVersion === 'string' ? value.packVersion : null,
      disclaimerFa: typeof value.disclaimerFa === 'string' ? value.disclaimerFa : null,
      applications,
      profiles,
    };
  }
}
