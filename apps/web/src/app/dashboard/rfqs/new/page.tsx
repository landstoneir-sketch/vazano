import { NewRfqForm } from './rfq-form';

export const metadata = { title: 'ثبت استعلام جدید' };

export default async function NewRfqPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  return <section className="container dashboard"><div className="eyebrow">استعلام قیمت</div><h1>{edit ? 'ویرایش پیش‌نویس استعلام' : 'ثبت استعلام جدید'}</h1><p className="muted">قیمت‌ها بدون مالیات نمایش داده می‌شوند. همه استعلام‌های دوره پایلوت پیش از انتشار بازبینی می‌شوند.</p><NewRfqForm draftId={edit} /></section>;
}
