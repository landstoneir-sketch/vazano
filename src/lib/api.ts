const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/v1';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

type ApiEnvelope<T> = { data: T; meta?: Record<string, unknown> };

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as ApiEnvelope<T> | { error?: { message?: string } };
  if (!response.ok) {
    const message = 'error' in body ? body.error?.message : undefined;
    throw new Error(message ?? 'در ارتباط با سرور خطایی رخ داد.');
  }
  return (body as ApiEnvelope<T>).data;
}

export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
}

export function digitsOnly(value: string, maxLength?: number): string {
  const normalized = normalizeDigits(value).replace(/\D/g, '');
  return typeof maxLength === 'number' ? normalized.slice(0, maxLength) : normalized;
}

export function normalizeIranianMobileInput(value: string): string {
  return digitsOnly(value, 11);
}

export function normalizeDecimalInput(value: string): string {
  const normalized = normalizeDigits(value).replace(/[٫,]/g, '.').replace(/[^\d.]/g, '');
  const [integer = '', ...fractions] = normalized.split('.');
  return fractions.length > 0 ? `${integer}.${fractions.join('')}` : integer;
}
