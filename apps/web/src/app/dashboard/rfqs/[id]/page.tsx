import { RfqDetail } from './rfq-detail';

export const metadata = { title: 'جزئیات استعلام' };

export default async function RfqDetailPage({ params, searchParams }: PageProps<'/dashboard/rfqs/[id]'>) {
  const { id } = await params;
  const query = await searchParams;
  const qualityPayment = typeof query.qualityPayment === 'string' ? query.qualityPayment : undefined;
  return <section className="container dashboard"><RfqDetail rfqId={id} qualityPaymentResult={qualityPayment} /></section>;
}
