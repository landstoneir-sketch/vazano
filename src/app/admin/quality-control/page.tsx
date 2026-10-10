import { QualityControlQueue } from './quality-control-queue';

export const metadata = { title: 'عملیات کنترل کیفیت' };

export default function AdminQualityControlPage() {
  return <section className="container dashboard"><div className="eyebrow">خدمات تکمیلی وازانو</div><h1>صف کنترل کیفیت</h1><p className="muted">درخواست‌های تأییدشده خریداران را شروع، تکمیل یا با ثبت دلیل لغو کنید.</p><QualityControlQueue /></section>;
}
