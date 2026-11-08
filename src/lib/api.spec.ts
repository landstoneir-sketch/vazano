import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, digitsOnly, normalizeDecimalInput, normalizeIranianMobileInput } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('apiRequest', () => {
  it('supports successful responses without a body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiRequest<void>('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('returns data from the standard API envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: { status: 'ok' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest<{ status: string }>('/health')).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith('/v1/health', expect.objectContaining({ credentials: 'include' }));
  });
});

describe('input normalization', () => {
  it('accepts Persian and Arabic digits while keeping only numbers', () => {
    expect(digitsOnly('۱۲٣-45 abc')).toBe('12345');
  });

  it('limits Iranian mobile input to eleven digits', () => {
    expect(normalizeIranianMobileInput('۰۹۱۳ ۱۹۰ ۸۰۳۰۹')).toBe('09131908030');
  });

  it('normalizes decimal quantities without accepting unrelated characters', () => {
    expect(normalizeDecimalInput('۱٬۲۵۰٫۵ متر')).toBe('1250.5');
  });
});
