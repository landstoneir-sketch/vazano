'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Supplier = {
  id: string; displayName: string; province: string | null; city: string | null;
  supplierProfile: { description: string | null; nationwideCoverage: boolean; categories: Array<{ category: { id: string; nameFa: string; slug: string } }> };
  reviewSummary: { count: number; averageRating: number | null };
};

export function SupplierDirectory() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<Supplier[]>('/public/suppliers')
      .then((data) => { if (active) setItems(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت فهرست فروشندگان انجام نشد.'); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fa-IR');
    if (!normalized) return items;
    return items.filter((item) => [item.displayName, item.province, item.city, ...item.supplierProfile.categories.map(({ category }) => category.nameFa)].filter(Boolean).some((value) => value!.toLocaleLowerCase('fa-IR').includes(normalized)));
  }, [items, query]);

  return <div className="stack">{error && <div className="message message-error">{error}</div>}<label className="form-field"><span>جست‌وجوی نام، شهر یا نوع سنگ</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثلاً تراورتن یا اصفهان" /></label>{!error && items.length === 0 && <div className="card">فروشنده تأییدشده‌ای برای نمایش وجود ندارد.</div>}{items.length > 0 && filtered.length === 0 && <div className="card">فروشنده‌ای مطابق جست‌وجوی شما پیدا نشد.</div>}<div className="feature-grid">{filtered.map((supplier) => <article className="card stack" key={supplier.id}><div><div className="eyebrow">فروشنده تأییدشده وازانو</div><h2>{supplier.displayName}</h2><p className="muted">{supplier.supplierProfile.nationwideCoverage ? 'پوشش سراسر ایران' : [supplier.province, supplier.city].filter(Boolean).join('، ') || 'محدوده فعالیت ثبت‌شده'}</p></div><p>{supplier.supplierProfile.description ?? 'اطلاعات توانمندی این فروشنده بررسی و تأیید شده است.'}</p><div className="specification-summary">{supplier.supplierProfile.categories.slice(0, 6).map(({ category }) => <span key={category.id}>{category.nameFa}</span>)}</div><p><strong>{supplier.reviewSummary.averageRating === null ? 'بدون امتیاز' : `${supplier.reviewSummary.averageRating.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} از ۵`}</strong> · {supplier.reviewSummary.count.toLocaleString('fa-IR')} ارزیابی معتبر</p><Link className="button button-secondary" href={`/suppliers/${supplier.id}` as Route}>مشاهده پروفایل</Link></article>)}</div></div>;
}
