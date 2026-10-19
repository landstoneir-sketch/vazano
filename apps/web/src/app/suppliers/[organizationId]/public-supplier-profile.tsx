'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { formatProductSpecifications, type ProductAttributeBinding, type ProductSpecifications } from '@/lib/product-specifications';

type Profile = {
  id: string; displayName: string; province: string | null; city: string | null;
  supplierProfile: {
    description: string | null;
    productionCapacityDescription: string | null;
    minimumOrderDescription: string | null;
    leadTimeDescription: string | null;
    officialInvoiceAvailable: boolean;
    sampleAvailable: boolean;
    installationAvailable: boolean;
    nationwideCoverage: boolean;
    serviceProvinceLinks: Array<{ province: { id: string; nameFa: string } }>;
    categories: Array<{ category: { id: string; nameFa: string; slug: string } }>;
    products: Array<{
      id: string; nameFa: string; sku: string | null; description: string | null; specifications: ProductSpecifications;
      minimumOrderDescription: string | null; leadTimeDescription: string | null;
      category: { id: string; nameFa: string; slug: string; attributeBindings: ProductAttributeBinding[] };
    }>;
  };
  reviewSummary: { count: number; averageRating: number | null };
  recentReviews: Array<{ id: string; rating: number; comment: string | null; createdAt: string }>;
};
type PublicProductImage = { id: string; originalName: string; url: string };

export function PublicSupplierProfile({ organizationId }: { organizationId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [productImages, setProductImages] = useState<Record<string, PublicProductImage[]>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<Profile>(`/public/suppliers/${organizationId}`)
      .then(async (data) => {
        const imageEntries = await Promise.all(data.supplierProfile.products.map(async (product) => {
          const images = await apiRequest<PublicProductImage[]>(`/public/supplier-products/${product.id}/images`).catch(() => []);
          return [product.id, images] as const;
        }));
        if (active) { setProfile(data); setProductImages(Object.fromEntries(imageEntries)); }
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت پروفایل فروشنده انجام نشد.'); });
    return () => { active = false; };
  }, [organizationId]);

  if (error) return <div className="message message-error">{error}</div>;
  if (!profile) return <div className="card">در حال دریافت پروفایل فروشنده…</div>;
  const capabilities = [
    profile.supplierProfile.officialInvoiceAvailable ? 'صدور فاکتور رسمی' : null,
    profile.supplierProfile.sampleAvailable ? 'ارائه نمونه محصول' : null,
    profile.supplierProfile.installationAvailable ? 'خدمات نصب' : null,
  ].filter((item): item is string => Boolean(item));

  return <div className="stack">
    <div><div className="eyebrow">فروشنده تأییدشده وازانو</div><h1>{profile.displayName}</h1><p className="muted">{profile.supplierProfile.nationwideCoverage ? 'خدمت‌رسانی در سراسر ایران' : [profile.province, profile.city].filter(Boolean).join('، ') || 'محدوده فعالیت تأییدشده'}</p></div>
    <div className="dashboard-grid"><article className="card billing-summary-card"><span>میانگین رضایت</span><strong>{profile.reviewSummary.averageRating === null ? '—' : `${profile.reviewSummary.averageRating.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} / ۵`}</strong></article><article className="card billing-summary-card"><span>ارزیابی خرید معتبر</span><strong>{profile.reviewSummary.count.toLocaleString('fa-IR')}</strong></article><article className="card billing-summary-card"><span>وضعیت احراز</span><strong>تأییدشده</strong></article></div>
    <article className="card"><h2>درباره مجموعه</h2><p>{profile.supplierProfile.description ?? 'اطلاعات کسب‌وکار و توانمندی‌های این فروشنده توسط وازانو بررسی شده است.'}</p></article>
    <article className="card"><h2>ظرفیت و شرایط تأمین</h2><p>{profile.supplierProfile.productionCapacityDescription ?? 'جزئیات ظرفیت برای هر استعلام در پیشنهاد قیمت اعلام می‌شود.'}</p><div className="specification-summary"><span>حداقل سفارش: {profile.supplierProfile.minimumOrderDescription ?? 'وابسته به محصول'}</span><span>زمان آماده‌سازی: {profile.supplierProfile.leadTimeDescription ?? 'در پیشنهاد قیمت اعلام می‌شود'}</span></div>{capabilities.length > 0 && <div className="specification-summary">{capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div>}</article>
    <article className="card"><h2>دسته‌های قابل تأمین</h2><div className="specification-summary">{profile.supplierProfile.categories.map(({ category }) => <span key={category.id}>{category.nameFa}</span>)}</div></article>
    <section className="stack"><div><h2>محصولات معرفی‌شده</h2><p className="muted">قیمت و موجودی قطعی هر محصول در پیشنهاد همان استعلام اعلام می‌شود.</p></div>{profile.supplierProfile.products.length === 0 && <div className="card">این فروشنده هنوز محصول عمومی ثبت نکرده است.</div>}{profile.supplierProfile.products.map((product) => {
      const values = formatProductSpecifications(product.specifications, product.category.attributeBindings);
      const images = productImages[product.id] ?? [];
      return <article className="card" key={product.id}>{images.length > 0 && <div className="product-image-gallery">{images.map((image) => <a href={image.url} target="_blank" rel="noreferrer" className="product-image" style={{ backgroundImage: `url(${JSON.stringify(image.url)})` }} aria-label={`مشاهده تصویر ${product.nameFa}`} key={image.id}><span className="sr-only">{image.originalName}</span></a>)}</div>}<div className="admin-card-title"><div><div className="eyebrow">{product.category.nameFa}</div><h3>{product.nameFa}</h3></div>{product.sku && <span className="status-badge">کد {product.sku}</span>}</div><p>{product.description ?? 'برای این محصول توضیح تکمیلی ثبت نشده است.'}</p><div className="specification-summary">{values.map((item) => <span key={item.code}>{item.label}: {item.value}</span>)}{product.minimumOrderDescription && <span>حداقل سفارش: {product.minimumOrderDescription}</span>}{product.leadTimeDescription && <span>آماده‌سازی: {product.leadTimeDescription}</span>}</div></article>;
    })}</section>
    {!profile.supplierProfile.nationwideCoverage && <article className="card"><h2>استان‌های تحت پوشش</h2><p>{profile.supplierProfile.serviceProvinceLinks.map(({ province }) => province.nameFa).join('، ') || 'ثبت نشده'}</p></article>}
    <section className="stack"><h2>تجربه خریداران</h2>{profile.recentReviews.length === 0 && <div className="card">هنوز ارزیابی معتبری برای این فروشنده منتشر نشده است.</div>}{profile.recentReviews.map((review) => <article className="card" key={review.id}><div className="admin-card-title"><strong className="price" aria-label={`${review.rating} از ۵`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</strong><span className="muted">{new Date(review.createdAt).toLocaleDateString('fa-IR')}</span></div><p>{review.comment ?? 'خریدار فقط امتیاز عددی ثبت کرده است.'}</p><small className="muted">خرید معتبر ثبت‌شده در وازانو</small></article>)}</section>
    <div className="actions"><Link className="button button-primary" href="/login">ثبت استعلام جدید</Link><Link className="button button-secondary" href={'/suppliers' as Route}>بازگشت به فروشندگان</Link></div>
  </div>;
}
