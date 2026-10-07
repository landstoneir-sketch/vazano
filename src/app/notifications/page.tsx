import { NotificationsList } from './notifications-list';

export const metadata = { title: 'اعلان‌ها' };

export default function NotificationsPage() {
  return (
    <section className="container dashboard">
      <div className="eyebrow">مرکز اعلان‌ها</div>
      <h1>اعلان‌های من</h1>
      <p className="muted">رویدادهای مهم استعلام، پیشنهاد قیمت و اشتراک را اینجا پیگیری کنید.</p>
      <NotificationsList />
    </section>
  );
}
