'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Supplier = {
  id: string; displayName: string; province: string | null; city: string | null;
  supplierProfile: { description: string | null; productionCapacityDescription: string | null; officialInvoiceAvailable: boolean; sampleAvailable: boolean; installationAvailable: boolean; nationwideCoverage: boolean; categories: Array<{ category: { id: string; nameFa: string; slug: string } }> };
  reviewSummary: { count: number; averageRating: number | null };
};

export function SupplierDirectory() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      const normalized = query.trim();
      const path = normalized.length >= 2 ? `/public/suppliers?q=${encodeURIComponent(normalized)}` : '/public/suppliers';
      void apiRequest<Supplier[]>(path)
        .then((data) => { if (active) setItems(data); })
        .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت فهرست فروشندگان انجام نشد.'); })
        .finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  return <div className="stack">{error && <div className="message message-error">{error}</div>}<label className="form-field"><span>جست‌وجوی نام، شهر یا نوع سنگ</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثلاً تراورتن یا اصفهان" /><small>جست‌وجو در فروشندگان تأییدشده و اطلاعات عمومی آن‌ها انجام می‌شود.</small></label>{loading && <div className="card" role="status">در حال جست‌وجوی شبکه تأمین…</div>}{!loading && !error && items.length === 0 && <div className="card">{query.trim().length >= 2 ? 'فروشنده‌ای مطابق جست‌وجوی شما پیدا نشد.' : 'فروشنده تأییدشده‌ای برای نمایش وجود ندارد.'}</div>}<div className="feature-grid">{!loading && items.map((supplier) => <article className="card stack" key={supplier.id}><div><div className="eyebrow">فروشنده تأییدشده وازانو</div><h2>{supplier.displayName}</h2><p className="muted">{supplier.supplierProfile.nationwideCoverage ? 'پوشش سراسر ایران' : [supplier.province, supplier.city].filter(Boolean).join('، ') || 'محدوده فعالیت ثبت‌شده'}</p></div><p>{supplier.supplierProfile.description ?? 'اطلاعات توانمندی این فروشنده بررسی و تأیید شده است.'}</p>{supplier.supplierProfile.productionCapacityDescription && <p className="muted">{supplier.supplierProfile.productionCapacityDescription}</p>}<div className="specification-summary">{supplier.supplierProfile.categories.slice(0, 6).map(({ category }) => <span key={category.id}>{category.nameFa}</span>)}{supplier.supplierProfile.officialInvoiceAvailable && <span>فاکتور رسمی</span>}{supplier.supplierProfile.sampleAvailable && <span>نمونه محصول</span>}{supplier.supplierProfile.installationAvailable && <span>نصب</span>}</div><p><strong>{supplier.reviewSummary.averageRating === null ? 'بدون امتیاز' : `${supplier.reviewSummary.averageRating.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} از ۵`}</strong> · {supplier.reviewSummary.count.toLocaleString('fa-IR')} ارزیابی معتبر</p><Link className="button button-secondary" href={`/suppliers/${supplier.id}` as Route}>مشاهده پروفایل</Link></article>)}</div></div>;
}
