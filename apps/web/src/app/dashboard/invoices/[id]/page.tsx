import { BillingInvoiceView } from './billing-invoice-view';

export const metadata = { title: 'صورتحساب وازانو' };

export default async function BillingInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <section className="container dashboard"><BillingInvoiceView invoiceId={id} /></section>;
}
