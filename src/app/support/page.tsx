import { SupportCenter } from './support-center';

export const metadata = { title: 'پشتیبانی' };

export default async function SupportPage({ searchParams }: PageProps<'/support'>) {
  const query = await searchParams;
  const isManualRenewal = query.request === 'manual-renewal';
  const requestedOrganizationId = typeof query.organizationId === 'string' ? query.organizationId : undefined;
  return (
    <section className="container dashboard">
      <div className="eyebrow">پشتیبانی و اعتماد</div>
      <h1>مرکز پشتیبانی و گزارش تخلف</h1>
      <p className="muted">درخواست پشتیبانی، شکایت یا گزارش تخلف خود را ثبت و وضعیت رسیدگی را پیگیری کنید.</p>
      <SupportCenter initialRequest={isManualRenewal ? 'MANUAL_RENEWAL' : undefined} initialOrganizationId={requestedOrganizationId} />
    </section>
  );
}
