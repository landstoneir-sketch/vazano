import { BadRequestException } from '@nestjs/common';

export type ProductSpecificationValue = string | number | boolean | string[] | null;

export type ProductSpecificationBinding = {
  isRequired: boolean;
  attribute: {
    code: string;
    nameFa: string;
    dataType: 'TEXT' | 'NUMBER' | 'SINGLE_SELECT' | 'MULTI_SELECT' | 'BOOLEAN';
    options: unknown;
    validation: unknown;
  };
};

export function assertValidProductSpecifications(
  specifications: Record<string, ProductSpecificationValue>,
  bindings: ProductSpecificationBinding[],
  requireRequiredAttributes = true,
): void {
  const bindingByCode = new Map(bindings.map((binding) => [binding.attribute.code, binding]));

  if (requireRequiredAttributes) {
    for (const binding of bindings) {
      if (binding.isRequired && !isPresent(specifications[binding.attribute.code])) {
        throw new BadRequestException(`ویژگی «${binding.attribute.nameFa}» برای این محصول الزامی است.`);
      }
    }
  }

  for (const [code, value] of Object.entries(specifications)) {
    const binding = bindingByCode.get(code);
    if (!binding) throw new BadRequestException(`ویژگی فنی «${code}» برای دسته انتخاب‌شده معتبر نیست.`);
    if (!isPresent(value)) continue;

    const options = Array.isArray(binding.attribute.options)
      ? binding.attribute.options.filter((option): option is string => typeof option === 'string')
      : [];
    const validation = typeof binding.attribute.validation === 'object'
      && binding.attribute.validation !== null
      && !Array.isArray(binding.attribute.validation)
      ? binding.attribute.validation as Record<string, unknown>
      : {};

    if (binding.attribute.dataType === 'TEXT') {
      if (typeof value !== 'string') throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» باید متن باشد.`);
      const maxLength = typeof validation.maxLength === 'number' ? validation.maxLength : undefined;
      if (maxLength && value.length > maxLength) throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» بیش از حد طولانی است.`);
    }
    if (binding.attribute.dataType === 'NUMBER') {
      const numericValue = typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) : Number.NaN);
      if (!Number.isFinite(numericValue)) throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» باید عدد باشد.`);
      const minimum = typeof validation.min === 'number' ? validation.min : undefined;
      const maximum = typeof validation.max === 'number' ? validation.max : undefined;
      if (minimum !== undefined && numericValue < minimum) throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» کمتر از حد مجاز است.`);
      if (maximum !== undefined && numericValue > maximum) throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» بیشتر از حد مجاز است.`);
    }
    if (binding.attribute.dataType === 'SINGLE_SELECT' && (typeof value !== 'string' || !options.includes(value))) {
      throw new BadRequestException(`گزینه انتخاب‌شده برای «${binding.attribute.nameFa}» معتبر نیست.`);
    }
    if (binding.attribute.dataType === 'MULTI_SELECT' && (!Array.isArray(value) || value.some((selected) => !options.includes(selected)))) {
      throw new BadRequestException(`گزینه‌های انتخاب‌شده برای «${binding.attribute.nameFa}» معتبر نیست.`);
    }
    if (binding.attribute.dataType === 'BOOLEAN' && typeof value !== 'boolean') {
      throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» باید بله یا خیر باشد.`);
    }
  }
}

function isPresent(value: ProductSpecificationValue | undefined): boolean {
  return value !== null
    && value !== undefined
    && (typeof value !== 'string' || value.trim().length > 0)
    && (!Array.isArray(value) || value.length > 0);
}
