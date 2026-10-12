import { SupplierDirectory } from './supplier-directory';

export const metadata = { title: 'فروشندگان تأییدشده' };

export default function SuppliersPage() {
  return <section className="container dashboard"><div className="eyebrow">شبکه تأمین وازانو</div><h1>فروشندگان تأییدشده</h1><p className="muted">فقط مجموعه‌هایی نمایش داده می‌شوند که اطلاعات کسب‌وکار و توانمندی آن‌ها توسط وازانو بررسی شده است.</p><SupplierDirectory /></section>;
}
