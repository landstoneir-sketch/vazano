'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Profile = {
  id: string; displayName: string; province: string | null; city: string | null;
  supplierProfile: {
    description: string | null; nationwideCoverage: boolean;
    serviceProvinceLinks: Array<{ province: { id: string; nameFa: string } }>;
    categories: Array<{ category: { id: string; nameFa: string; slug: string } }>;
  };
  reviewSummary: { count: number; averageRating: number | null };
  recentReviews: Array<{ id: string; rating: number; comment: string | null; createdAt: string }>;
};

export function PublicSupplierProfile({ organizationId }: { organizationId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<Profile>(`/public/suppliers/${organizationId}`)
      .then((data) => { if (active) setProfile(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت پروفایل فروشنده انجام نشد.'); });
    return () => { active = false; };
  }, [organizationId]);

  if (error) return <div className="message message-error">{error}</div>;
  if (!profile) return <div className="card">در حال دریافت پروفایل فروشنده…</div>;
  return <div className="stack"><div><div className="eyebrow">فروشنده تأییدشده وازانو</div><h1>{profile.displayName}</h1><p className="muted">{profile.supplierProfile.nationwideCoverage ? 'خدمت‌رسانی در سراسر ایران' : [profile.province, profile.city].filter(Boolean).join('، ') || 'محدوده فعالیت تأییدشده'}</p></div><div className="dashboard-grid"><article className="card billing-summary-card"><span>میانگین رضایت</span><strong>{profile.reviewSummary.averageRating === null ? '—' : `${profile.reviewSummary.averageRating.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} / ۵`}</strong></article><article className="card billing-summary-card"><span>ارزیابی خرید معتبر</span><strong>{profile.reviewSummary.count.toLocaleString('fa-IR')}</strong></article><article className="card billing-summary-card"><span>وضعیت احراز</span><strong>تأییدشده</strong></article></div><article className="card"><h2>درباره مجموعه</h2><p>{profile.supplierProfile.description ?? 'اطلاعات کسب‌وکار و توانمندی‌های این فروشنده توسط وازانو بررسی شده است.'}</p></article><article className="card"><h2>محصولات قابل تأمین</h2><div className="specification-summary">{profile.supplierProfile.categories.map(({ category }) => <span key={category.id}>{category.nameFa}</span>)}</div></article>{!profile.supplierProfile.nationwideCoverage && <article className="card"><h2>استان‌های تحت پوشش</h2><p>{profile.supplierProfile.serviceProvinceLinks.map(({ province }) => province.nameFa).join('، ') || 'ثبت نشده'}</p></article>}<section className="stack"><h2>تجربه خریداران</h2>{profile.recentReviews.length === 0 && <div className="card">هنوز ارزیابی معتبری برای این فروشنده منتشر نشده است.</div>}{profile.recentReviews.map((review) => <article className="card" key={review.id}><div className="admin-card-title"><strong className="price" aria-label={`${review.rating} از ۵`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</strong><span className="muted">{new Date(review.createdAt).toLocaleDateString('fa-IR')}</span></div><p>{review.comment ?? 'خریدار فقط امتیاز عددی ثبت کرده است.'}</p><small className="muted">خرید معتبر ثبت‌شده در وازانو</small></article>)}</section><div className="actions"><Link className="button button-primary" href="/login">ثبت استعلام جدید</Link><Link className="button button-secondary" href={'/suppliers' as Route}>بازگشت به فروشندگان</Link></div></div>;
}
