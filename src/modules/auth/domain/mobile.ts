import { BadRequestException } from '@nestjs/common';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeIranianMobile(input: string): string {
  let value = input.trim().replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
  value = value.replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit))).replace(/[\s()-]/g, '');
  if (value.startsWith('+98')) value = `0${value.slice(3)}`;
  if (value.startsWith('0098')) value = `0${value.slice(4)}`;
  if (value.startsWith('98') && value.length === 12) value = `0${value.slice(2)}`;
  if (!/^09\d{9}$/.test(value)) throw new BadRequestException('شماره موبایل معتبر نیست.');
  return value;
}
