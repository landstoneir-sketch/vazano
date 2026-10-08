import { describe, expect, it } from 'vitest';
import { formatProductSpecifications, type ProductAttributeBinding } from './product-specifications';

const bindings: ProductAttributeBinding[] = [
  { isRequired: true, sortOrder: 1, attribute: { code: 'thickness-mm', nameFa: 'ضخامت', unitLabelFa: 'میلی‌متر' } },
  { isRequired: false, sortOrder: 2, attribute: { code: 'application', nameFa: 'محل مصرف', unitLabelFa: null } },
  { isRequired: false, sortOrder: 3, attribute: { code: 'bookmatched', nameFa: 'بوک‌مچ', unitLabelFa: null } },
];

describe('formatProductSpecifications', () => {
  it('formats numbers, multi-select values and booleans with Persian labels', () => {
    expect(formatProductSpecifications({
      'thickness-mm': '20',
      application: ['نما', 'کف'],
      bookmatched: true,
      legacy: 'ignored',
    }, bindings)).toEqual([
      { code: 'thickness-mm', label: 'ضخامت (میلی‌متر)', value: '20' },
      { code: 'application', label: 'محل مصرف', value: 'نما، کف' },
      { code: 'bookmatched', label: 'بوک‌مچ', value: 'بله' },
    ]);
  });
});
