import Link from 'next/link';
export const metadata = { title: 'داشبورد' };
export default function DashboardPage() {
  return <section className="container dashboard"><div className="eyebrow">نسخه MVP</div><h1>داشبورد وازانو</h1><p className="muted">ثبت‌نام، سازمان خریدار، دسته‌بندی سنگ و ثبت استعلام به هسته عملیاتی متصل است.</p><div className="dashboard-grid"><article className="card"><h2>استعلام‌های من</h2><strong>فعال</strong></article><article className="card"><h2>پوشش بازار</h2><strong>کل ایران</strong></article><article className="card"><h2>نمایش قیمت</h2><strong>بدون مالیات</strong></article></div><div className="actions"><Link className="button button-primary" href="/dashboard/rfqs/new">ثبت استعلام جدید</Link><Link className="button button-secondary" href="/dashboard/organization">حساب سازمانی</Link></div></section>;
}
