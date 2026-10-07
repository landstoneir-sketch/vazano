import { FaqList } from './faq-list';

export const metadata = { title: 'پرسش‌های متداول' };

export default function FaqPage() {
  return <section className="container dashboard"><div className="eyebrow">راهنمای وازانو</div><h1>پرسش‌های متداول</h1><p className="muted">پاسخ کوتاه به پرسش‌های رایج خریداران و فروشندگان.</p><FaqList /></section>;
}
