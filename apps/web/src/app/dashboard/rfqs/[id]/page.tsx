import { RfqDetail } from './rfq-detail';

export const metadata = { title: 'جزئیات استعلام' };

export default async function RfqDetailPage({ params, searchParams }: PageProps<'/dashboard/rfqs/[id]'>) {
  const { id } = await params;
  const query = await searchParams;
  const qualityPayment = typeof query.qualityPayment === 'string' ? query.qualityPayment : undefined;
  const qualityReceiptId = typeof query.qualityReceiptId === 'string' ? query.qualityReceiptId : undefined;
  const commitmentPayment = typeof query.commitmentPayment === 'string' ? query.commitmentPayment : undefined;
  const receiptId = typeof query.receiptId === 'string' ? query.receiptId : undefined;
  return <section className="container dashboard"><RfqDetail rfqId={id} qualityPaymentResult={qualityPayment} qualityReceiptId={qualityReceiptId} commitmentPaymentResult={commitmentPayment} commitmentReceiptId={receiptId} /></section>;
}
