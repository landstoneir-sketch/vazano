import { QuoteForm } from './quote-form';

export const metadata = { title: 'ثبت پیشنهاد قیمت' };

export default async function QuotePage({ params, searchParams }: PageProps<'/supplier/rfqs/[id]/quote'>) {
  const { id } = await params;
  const query = await searchParams;
  const organizationId = typeof query.organizationId === 'string' ? query.organizationId : '';
  return <section className="container dashboard quote-page">
    <header className="dashboard-page-heading">
      <div><div className="eyebrow">فروشنده</div><h1>ثبت پیشنهاد قیمت</h1><p className="muted">برای هر ردیفی که توان تأمین آن را دارید قیمت و شرایط واقعی ثبت کنید؛ می‌توانید پیش از ارسال نهایی، پیشنهاد را به‌صورت پیش‌نویس نگه دارید.</p></div>
      <aside><strong>قیمت‌ها به تومان و بدون مالیات</strong><span>مالیات، حمل، بسته‌بندی و سایر هزینه‌ها جداگانه و شفاف ثبت می‌شوند.</span></aside>
    </header>
    <ol className="rfq-completion-guide quote-completion-guide" aria-label="مراحل ثبت پیشنهاد">
      <li><b>۱</b><span>شرایط تحویل</span></li><li><b>۲</b><span>اقلام و قیمت</span></li><li><b>۳</b><span>هزینه‌ها</span></li><li><b>۴</b><span>بازبینی و ارسال</span></li>
    </ol>
    <QuoteForm rfqId={id} initialOrganizationId={organizationId} />
  </section>;
}
