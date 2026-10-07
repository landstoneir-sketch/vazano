import { RfqList } from './rfq-list';

export const metadata = { title: 'استعلام‌های من' };

export default function BuyerRfqsPage() {
  return <section className="container dashboard"><div className="eyebrow">خریدار</div><h1>استعلام‌های من</h1><p className="muted">وضعیت بررسی، انتشار و پیشنهادهای دریافتی را یکجا پیگیری کنید.</p><RfqList /></section>;
}
