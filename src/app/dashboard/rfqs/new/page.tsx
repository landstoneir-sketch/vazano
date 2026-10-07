import { NewRfqForm } from './rfq-form';

export const metadata = { title: 'ثبت استعلام جدید' };

export default function NewRfqPage() {
  return <section className="container dashboard"><div className="eyebrow">استعلام قیمت</div><h1>ثبت استعلام جدید</h1><p className="muted">قیمت‌ها بدون مالیات نمایش داده می‌شوند. همه استعلام‌های دوره پایلوت پیش از انتشار بازبینی می‌شوند.</p><NewRfqForm /></section>;
}
