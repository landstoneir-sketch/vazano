import { NewRfqForm } from '@/app/dashboard/rfqs/new/rfq-form';

export const metadata = { title: 'ثبت استعلام توسط اپراتور' };

export default function AdminCreateRfqPage() {
  return <section className="container dashboard">
    <div className="eyebrow">عملیات وازانو</div>
    <h1>ثبت استعلام از طرف خریدار</h1>
    <p className="muted">حساب و فرد تماس خریدار را انتخاب کنید. منبع ثبت و هویت اپراتور در سوابق ممیزی نگهداری می‌شود.</p>
    <NewRfqForm operatorMode />
  </section>;
}
