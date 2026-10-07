import { QuoteForm } from './quote-form';

export const metadata = { title: 'ثبت پیشنهاد قیمت' };

export default async function QuotePage({ params, searchParams }: PageProps<'/supplier/rfqs/[id]/quote'>) {
  const { id } = await params;
  const query = await searchParams;
  const organizationId = typeof query.organizationId === 'string' ? query.organizationId : '';
  return <section className="container dashboard"><div className="eyebrow">فروشنده</div><h1>ثبت پیشنهاد قیمت</h1><QuoteForm rfqId={id} initialOrganizationId={organizationId} /></section>;
}
