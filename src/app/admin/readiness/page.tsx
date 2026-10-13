import { ReleaseReadinessPanel } from './release-readiness-panel';

export const metadata = { title: 'آمادگی انتشار' };

export default function ReleaseReadinessPage() {
  return <section className="container dashboard">
    <div className="eyebrow">مدیریت وازانو</div>
    <h1>آمادگی انتشار MVP</h1>
    <p className="muted">این صفحه Secretها را نمایش نمی‌دهد و فقط آماده‌بودن تنظیمات فنی و داده‌های ضروری انتشار را کنترل می‌کند.</p>
    <ReleaseReadinessPanel />
  </section>;
}
