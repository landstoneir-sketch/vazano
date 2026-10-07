import { UserManagement } from './user-management';

export const metadata = { title: 'مدیریت کاربران' };

export default function AdminUsersPage() {
  return <section className="container dashboard">
    <div className="eyebrow">مدیریت دسترسی</div>
    <h1>کاربران و نشست‌های فعال</h1>
    <p className="muted">وضعیت کاربران را کنترل کنید و در رخدادهای مشکوک، تمام نشست‌های فعال را ببندید.</p>
    <UserManagement />
  </section>;
}
