import { PublicSupplierProfile } from './public-supplier-profile';

export const metadata = { title: 'پروفایل فروشنده' };

export default async function PublicSupplierPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  return <section className="container dashboard"><PublicSupplierProfile organizationId={organizationId} /></section>;
}
