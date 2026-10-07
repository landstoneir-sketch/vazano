import { RfqDetail } from './rfq-detail';

export const metadata = { title: 'جزئیات استعلام' };

export default async function RfqDetailPage({ params }: PageProps<'/dashboard/rfqs/[id]'>) {
  const { id } = await params;
  return <section className="container dashboard"><RfqDetail rfqId={id} /></section>;
}
