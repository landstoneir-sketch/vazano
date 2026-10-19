import { MessagesCenter } from './messages-center';

export const metadata = { title: 'مرکز پیام' };

type MessagesPageProps = {
  searchParams: Promise<{ thread?: string; rfq?: string; supplier?: string }>;
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const query = await searchParams;
  return (
    <section className="container dashboard">
      <div className="eyebrow">ارتباط امن در بستر استعلام</div>
      <h1>مرکز پیام</h1>
      <p className="muted">هر گفت‌وگو فقط بین خریدار و همان فروشنده دعوت‌شده قابل مشاهده است.</p>
      <MessagesCenter initialThreadId={query.thread} rfqId={query.rfq} supplierOrganizationId={query.supplier} />
    </section>
  );
}
