export type Industry = { id: string; code: string; nameFa: string };

export type UnitOfMeasure = {
  id: string;
  code: string;
  nameFa: string;
  symbolFa: string;
  decimalScale: number;
  isActive: boolean;
  updatedAt: string;
  _count: { rfqItems: number };
};

export type AttributeDataType = 'TEXT' | 'NUMBER' | 'SINGLE_SELECT' | 'MULTI_SELECT' | 'BOOLEAN';

export type ProductAttribute = {
  id: string;
  code: string;
  nameFa: string;
  nameEn: string | null;
  dataType: AttributeDataType;
  unitLabelFa: string | null;
  options: unknown;
  validation: unknown;
  isActive: boolean;
  version: number;
  categoryLinks: Array<{
    categoryId: string;
    attributeId: string;
    isRequired: boolean;
    sortOrder: number;
    category?: { id: string; code: string; nameFa: string; isActive: boolean };
  }>;
};

export type CatalogCategory = {
  id: string;
  industryId: string;
  parentId: string | null;
  code: string;
  slug: string;
  nameFa: string;
  nameEn: string | null;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
  industry: Industry;
  parent: { id: string; code: string; nameFa: string } | null;
  attributeBindings: Array<{
    categoryId: string;
    attributeId: string;
    isRequired: boolean;
    sortOrder: number;
    attribute: ProductAttribute;
  }>;
  _count: { children: number; rfqItems: number; supplierCategories: number };
};

export function stringOptions(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function validationRules(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
