import { UserProfileForm } from './user-profile-form';

export const metadata = { title: 'پروفایل من' };

export default function UserProfilePage() {
  return <section className="container dashboard">
    <div className="eyebrow">حساب کاربری</div>
    <h1>پروفایل من</h1>
    <p className="muted">اطلاعات تماس شما در تعاملات سازمانی و پیگیری درخواست‌ها استفاده می‌شود.</p>
    <UserProfileForm />
  </section>;
}
