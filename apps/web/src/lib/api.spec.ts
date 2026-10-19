import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api';

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
