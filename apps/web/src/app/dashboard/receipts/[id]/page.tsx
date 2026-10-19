import { PaymentReceiptView } from './payment-receipt-view';

export const metadata = { title: 'رسید پرداخت' };

export default async function PaymentReceiptPage({ params }: PageProps<'/dashboard/receipts/[id]'>) {
  const { id } = await params;
  return <section className="container dashboard receipt-page"><PaymentReceiptView receiptId={id} /></section>;
}
