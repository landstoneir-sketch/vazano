export type ProductAttributeBinding = {
  isRequired: boolean;
  sortOrder: number;
  attribute: {
    code: string;
    nameFa: string;
    unitLabelFa: string | null;
  };
};

export type ProductSpecifications = Record<string, unknown>;

export function formatProductSpecifications(
  specifications: ProductSpecifications,
  bindings: ProductAttributeBinding[],
): Array<{ code: string; label: string; value: string }> {
  const bindingByCode = new Map(bindings.map((binding) => [binding.attribute.code, binding]));
  return Object.entries(specifications).flatMap(([code, rawValue]) => {
    const binding = bindingByCode.get(code);
    if (!binding || rawValue === null || rawValue === undefined || rawValue === '') return [];
    const value = Array.isArray(rawValue)
      ? rawValue.filter((item): item is string => typeof item === 'string').join('، ')
      : typeof rawValue === 'boolean'
        ? (rawValue ? 'بله' : 'خیر')
        : String(rawValue);
    if (!value) return [];
    const label = binding.attribute.unitLabelFa
      ? `${binding.attribute.nameFa} (${binding.attribute.unitLabelFa})`
      : binding.attribute.nameFa;
    return [{ code, label, value }];
  });
}
