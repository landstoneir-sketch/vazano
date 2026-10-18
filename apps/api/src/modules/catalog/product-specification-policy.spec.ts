import { BadRequestException } from '@nestjs/common';
import { assertValidProductSpecifications, type ProductSpecificationBinding } from './product-specification-policy';

const bindings: ProductSpecificationBinding[] = [
  { isRequired: true, attribute: { code: 'color', nameFa: 'رنگ', dataType: 'SINGLE_SELECT', options: ['کرم', 'سفید'], validation: {} } },
  { isRequired: false, attribute: { code: 'thickness', nameFa: 'ضخامت', dataType: 'NUMBER', options: [], validation: { min: 1, max: 10 } } },
];

describe('product specification policy', () => {
  it('accepts configured attributes and limits', () => {
    expect(() => assertValidProductSpecifications({ color: 'کرم', thickness: 2 }, bindings)).not.toThrow();
  });

  it('requires mandatory attributes for publishable products and RFQ items', () => {
    expect(() => assertValidProductSpecifications({ thickness: 2 }, bindings)).toThrow(BadRequestException);
  });

  it('allows incomplete drafts but still rejects unknown attributes', () => {
    expect(() => assertValidProductSpecifications({}, bindings, false)).not.toThrow();
    expect(() => assertValidProductSpecifications({ quarry: 'نامعتبر' }, bindings, false)).toThrow(/معتبر نیست/);
  });
});
