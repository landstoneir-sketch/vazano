const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/v1';

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
