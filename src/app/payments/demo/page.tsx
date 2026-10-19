import type { Metadata } from 'next';
import { DemoPaymentGateway } from './demo-payment-gateway';

export const metadata: Metadata = { title: 'درگاه نمایشی پرداخت' };

const allowedCallbackPaths = new Set([
  '/v1/subscriptions/zarinpal/callback',
  '/v1/rfqs/commitments/zarinpal/callback',
  '/v1/quality-control/zarinpal/callback',
]);

function validatedCallback(value: string | undefined): string | null {
  if (!value || process.env.NODE_ENV === 'production') return null;
  try {
    const callback = new URL(value);
    const apiBase = new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/v1');
    if (callback.origin !== apiBase.origin || !allowedCallbackPaths.has(callback.pathname)) return null;
    callback.search = '';
    callback.hash = '';
    return callback.toString();
  } catch {
    return null;
  }
}

export default async function DemoPaymentPage({ searchParams }: PageProps<'/payments/demo'>) {
  const query = await searchParams;
  const authority = typeof query.authority === 'string' && /^A[0-9A-F]{32}$/.test(query.authority) ? query.authority : '';
  const callbackUrl = validatedCallback(typeof query.callback === 'string' ? query.callback : undefined);
  const amountRial = typeof query.amountRial === 'string' && /^\d{1,24}$/.test(query.amountRial) ? query.amountRial : null;
  const description = typeof query.description === 'string' ? query.description.slice(0, 160) : null;
  const orderId = typeof query.orderId === 'string' ? query.orderId.slice(0, 80) : null;
  const enabled = Boolean(authority && callbackUrl);

  return <DemoPaymentGateway authority={authority} callbackUrl={callbackUrl} amountRial={amountRial} description={description} orderId={orderId} enabled={enabled} />;
}
