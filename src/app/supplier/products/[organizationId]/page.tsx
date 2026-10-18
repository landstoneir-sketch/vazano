import { SupplierProductManager } from './supplier-product-manager';

export const metadata = { title: 'محصولات فروشنده' };

export default async function SupplierProductsPage({ params }: PageProps<'/supplier/products/[organizationId]'>) {
  const { organizationId } = await params;
  return <section className="container dashboard">
    <header className="dashboard-page-heading"><div><div className="eyebrow">فضای فروشنده</div><h1>محصولات قابل تأمین</h1><p className="muted">محصولات واقعی مجموعه را با مشخصات فنی داده‌محور ثبت کنید؛ قیمت نهایی همچنان فقط در پاسخ به استعلام اعلام می‌شود.</p></div></header>
    <SupplierProductManager organizationId={organizationId} />
  </section>;
}
