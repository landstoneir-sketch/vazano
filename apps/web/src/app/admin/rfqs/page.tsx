import { ReviewQueue } from './review-queue';

export const metadata = { title: 'صف بررسی استعلام‌ها' };

export default function AdminRfqsPage() {
  return <section className="container dashboard"><div className="eyebrow">عملیات وازانو</div><h1>صف بررسی استعلام‌ها</h1><p className="muted">در دوره پایلوت، انتشار همه استعلام‌ها نیازمند بازبینی انسانی است.</p><ReviewQueue /></section>;
}
