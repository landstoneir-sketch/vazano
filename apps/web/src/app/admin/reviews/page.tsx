import { ReviewModerationQueue } from './review-moderation-queue';

export const metadata = { title: 'مدیریت امتیاز فروشندگان' };

export default function AdminReviewsPage() {
  return <section className="container dashboard"><div className="eyebrow">اعتماد و کیفیت بازار</div><h1>مدیریت امتیاز فروشندگان</h1><p className="muted">امتیازهای متصل به خرید واقعی را بررسی کنید. پنهان‌سازی فقط با دلیل مستند انجام می‌شود.</p><ReviewModerationQueue /></section>;
}
