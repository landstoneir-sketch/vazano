import { SupplierProfileForm } from './supplier-profile-form';

export const metadata = { title: 'پروفایل تأمین فروشنده' };

export default async function SupplierProfilePage({ params }: PageProps<'/supplier/profile/[organizationId]'>) {
  const { organizationId } = await params;
  return <section className="container dashboard"><div className="eyebrow">فروشنده</div><h1>توانمندی و محدوده تأمین</h1><p className="muted">این اطلاعات مبنای توزیع قاعده‌محور استعلام‌هاست.</p><SupplierProfileForm organizationId={organizationId} /></section>;
}
