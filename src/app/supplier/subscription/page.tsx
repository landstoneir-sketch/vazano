import { SubscriptionManager } from './subscription-manager';

export const metadata = { title: 'اشتراک فروشنده' };

export default async function SupplierSubscriptionPage({ searchParams }: PageProps<'/supplier/subscription'>) {
  const query = await searchParams;
  const payment = typeof query.payment === 'string' && ['success', 'cancelled', 'failed'].includes(query.payment) ? query.payment : undefined;
  const trial = query.trial === 'success' ? 'success' : undefined;
  return <section className="container dashboard"><div className="eyebrow">حساب فروشنده</div><h1>اشتراک و پرداخت</h1><p className="muted">تاریخ پایان، سوابق و مبلغ تمدید را شفاف ببینید و پرداخت امن را از طریق زرین‌پال انجام دهید.</p><SubscriptionManager paymentResult={payment} trialResult={trial} /></section>;
}
