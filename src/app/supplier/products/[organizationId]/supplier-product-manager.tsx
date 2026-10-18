'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { formatProductSpecifications, type ProductAttributeBinding, type ProductSpecifications } from '@/lib/product-specifications';

type SpecificationValue = string | number | boolean | string[] | null;
type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type Category = { id: string; nameFa: string; slug: string };
type ProductCategory = Category & { attributeBindings: ProductAttributeBinding[] };
type ProductAttribute = {
  id: string; code: string; nameFa: string; dataType: 'TEXT' | 'NUMBER' | 'SINGLE_SELECT' | 'MULTI_SELECT' | 'BOOLEAN';
  unitLabelFa: string | null; options: string[]; validation: Record<string, unknown>; isRequired: boolean;
};
type SupplierProfile = { supplierProfile: null | { categories: Array<{ category: Category }> } };
type SupplierProduct = {
  id: string; categoryId: string; nameFa: string; sku: string | null; description: string | null;
  specifications: Record<string, SpecificationValue>; minimumOrderDescription: string | null; leadTimeDescription: string | null;
  isAvailable: boolean; status: ProductStatus; version: number; updatedAt: string; category: ProductCategory;
};
type ProductDraft = {
  id: string; categoryId: string; nameFa: string; sku: string; description: string;
  specifications: Record<string, SpecificationValue>; minimumOrderDescription: string; leadTimeDescription: string;
  isAvailable: boolean; status: ProductStatus; expectedVersion: number;
};

const statusLabels: Record<ProductStatus, string> = { DRAFT: 'پیش‌نویس', PUBLISHED: 'منتشرشده', ARCHIVED: 'بایگانی‌شده' };

export function SupplierProductManager({ organizationId }: { organizationId: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(() => emptyDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    const [profile, productItems] = await Promise.all([
      apiRequest<SupplierProfile>(`/suppliers/organizations/${organizationId}/profile`),
      apiRequest<SupplierProduct[]>(`/suppliers/organizations/${organizationId}/products`),
    ]);
    const profileCategories = profile.supplierProfile?.categories.map((item) => item.category) ?? [];
    setCategories(profileCategories);
    setProducts(productItems);
    setDraft((current) => current.categoryId || profileCategories.length === 0 ? current : { ...current, categoryId: profileCategories[0]!.id });
  }

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<SupplierProfile>(`/suppliers/organizations/${organizationId}/profile`),
      apiRequest<SupplierProduct[]>(`/suppliers/organizations/${organizationId}/products`),
    ]).then(([profile, productItems]) => {
      if (!active) return;
      const profileCategories = profile.supplierProfile?.categories.map((item) => item.category) ?? [];
      setCategories(profileCategories);
      setProducts(productItems);
      setDraft((current) => current.categoryId || profileCategories.length === 0 ? current : { ...current, categoryId: profileCategories[0]!.id });
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت محصولات انجام نشد.'); });
    return () => { active = false; };
  }, [organizationId]);

  useEffect(() => {
    if (!draft.categoryId) return;
    let active = true;
    void apiRequest<ProductAttribute[]>(`/catalog/categories/${draft.categoryId}/attributes`)
      .then((items) => { if (active) setAttributes(items); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت ویژگی‌های فنی انجام نشد.'); });
    return () => { active = false; };
  }, [draft.categoryId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const payload = {
        categoryId: draft.categoryId,
        nameFa: draft.nameFa,
        sku: draft.sku || undefined,
        description: draft.description || undefined,
        specifications: draft.specifications,
        minimumOrderDescription: draft.minimumOrderDescription || undefined,
        leadTimeDescription: draft.leadTimeDescription || undefined,
        isAvailable: draft.isAvailable,
        status: draft.status,
        ...(draft.id ? { expectedVersion: draft.expectedVersion } : {}),
      };
      await apiRequest(`/suppliers/organizations/${organizationId}/products${draft.id ? `/${draft.id}` : ''}`, {
        method: draft.id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setMessage(draft.id ? 'تغییرات محصول ذخیره شد.' : 'محصول جدید ثبت شد.');
      setDraft({ ...emptyDraft(), categoryId: categories[0]?.id ?? '' });
      await refresh();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'ذخیره محصول انجام نشد.');
    } finally { setBusy(false); }
  }

  function edit(product: SupplierProduct) {
    setMessage(''); setError('');
    setDraft({
      id: product.id, categoryId: product.categoryId, nameFa: product.nameFa, sku: product.sku ?? '', description: product.description ?? '',
      specifications: product.specifications ?? {}, minimumOrderDescription: product.minimumOrderDescription ?? '', leadTimeDescription: product.leadTimeDescription ?? '',
      isAvailable: product.isAvailable, status: product.status, expectedVersion: product.version,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setSpecification(code: string, value: SpecificationValue) {
    setDraft((current) => ({ ...current, specifications: { ...current.specifications, [code]: value } }));
  }

  function toggleMultiValue(code: string, option: string, checked: boolean) {
    const current = Array.isArray(draft.specifications[code]) ? draft.specifications[code] as string[] : [];
    setSpecification(code, checked ? [...current, option] : current.filter((item) => item !== option));
  }

  return <div className="stack">
    {error && <div className="message message-error">{error}</div>}
    {message && <div className="message message-success">{message}</div>}
    {categories.length === 0 && <div className="message message-warning">ابتدا در پروفایل فروشنده حداقل یک دسته قابل‌تأمین ثبت کنید.</div>}
    <form className="card form-grid" onSubmit={submit}>
      <div className="full"><h2>{draft.id ? 'ویرایش محصول' : 'ثبت محصول جدید'}</h2><p className="muted">برای انتشار عمومی، همه ویژگی‌های الزامی دسته را کامل کنید. پیش‌نویس ناقص قابل ذخیره است.</p></div>
      <label className="form-field"><span>دسته محصول</span><select value={draft.categoryId} onChange={(event) => { setAttributes([]); setDraft((current) => ({ ...current, categoryId: event.target.value, specifications: {} })); }} required><option value="">انتخاب کنید</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.nameFa}</option>)}</select></label>
      <label className="form-field"><span>نام محصول</span><input value={draft.nameFa} onChange={(event) => setDraft((current) => ({ ...current, nameFa: event.target.value }))} minLength={2} maxLength={160} required placeholder="مثلاً تراورتن کرم موج‌دار معدن نمونه" /></label>
      <label className="form-field"><span>کد داخلی / SKU (اختیاری)</span><input dir="ltr" value={draft.sku} onChange={(event) => setDraft((current) => ({ ...current, sku: event.target.value }))} maxLength={80} /></label>
      <label className="form-field"><span>وضعیت نمایش</span><select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ProductStatus }))}><option value="DRAFT">پیش‌نویس</option><option value="PUBLISHED">انتشار عمومی</option><option value="ARCHIVED">بایگانی</option></select></label>
      <label className="form-field full"><span>معرفی محصول (اختیاری)</span><textarea rows={3} maxLength={2000} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
      {attributes.map((attribute) => <AttributeField key={attribute.id} attribute={attribute} value={draft.specifications[attribute.code]} setValue={(value) => setSpecification(attribute.code, value)} toggleMulti={(option, checked) => toggleMultiValue(attribute.code, option, checked)} />)}
      <label className="form-field"><span>حداقل سفارش (اختیاری)</span><input maxLength={300} value={draft.minimumOrderDescription} onChange={(event) => setDraft((current) => ({ ...current, minimumOrderDescription: event.target.value }))} placeholder="مثلاً ۱۰۰ مترمربع" /></label>
      <label className="form-field"><span>زمان آماده‌سازی (اختیاری)</span><input maxLength={300} value={draft.leadTimeDescription} onChange={(event) => setDraft((current) => ({ ...current, leadTimeDescription: event.target.value }))} placeholder="مثلاً ۱۰ روز کاری" /></label>
      <label className="check-field full"><input type="checkbox" checked={draft.isAvailable} onChange={(event) => setDraft((current) => ({ ...current, isAvailable: event.target.checked }))} /><span>در حال حاضر قابل تأمین است</span></label>
      <div className="actions full"><button className="button button-primary" disabled={busy || categories.length === 0}>{busy ? 'در حال ذخیره…' : draft.id ? 'ذخیره تغییرات' : 'ثبت محصول'}</button>{draft.id && <button className="button button-secondary" type="button" onClick={() => setDraft({ ...emptyDraft(), categoryId: categories[0]?.id ?? '' })}>انصراف از ویرایش</button>}</div>
    </form>
    <section className="stack"><div><h2>فهرست محصولات</h2><p className="muted">محصولات منتشرشده و موجود در پروفایل عمومی فروشنده نمایش داده می‌شوند.</p></div>{products.length === 0 && <div className="card">هنوز محصولی ثبت نشده است.</div>}{products.map((product) => {
      const values = formatProductSpecifications(product.specifications as ProductSpecifications, product.category.attributeBindings);
      return <article className="card list-card" key={product.id}><div><div className="eyebrow">{product.category.nameFa} · {statusLabels[product.status]}</div><h3>{product.nameFa}</h3><p>{product.description ?? 'بدون توضیح تکمیلی'}</p><div className="specification-summary">{product.sku && <span>کد: {product.sku}</span>}{values.slice(0, 5).map((item) => <span key={item.code}>{item.label}: {item.value}</span>)}<span>{product.isAvailable ? 'قابل تأمین' : 'موقتاً ناموجود'}</span></div></div><div className="list-card-actions"><button className="button button-secondary" type="button" onClick={() => edit(product)}>ویرایش</button></div></article>;
    })}</section>
  </div>;
}

function AttributeField({ attribute, value, setValue, toggleMulti }: { attribute: ProductAttribute; value: SpecificationValue | undefined; setValue: (value: SpecificationValue) => void; toggleMulti: (option: string, checked: boolean) => void }) {
  const label = attribute.unitLabelFa ? `${attribute.nameFa} (${attribute.unitLabelFa})` : attribute.nameFa;
  if (attribute.dataType === 'SINGLE_SELECT') return <label className="form-field"><span>{label}{attribute.isRequired ? ' *' : ''}</span><select value={typeof value === 'string' ? value : ''} onChange={(event) => setValue(event.target.value)} required={attribute.isRequired}><option value="">انتخاب کنید</option>{attribute.options.map((option) => <option value={option} key={option}>{option}</option>)}</select></label>;
  if (attribute.dataType === 'MULTI_SELECT') return <fieldset className="attribute-options"><legend>{label}{attribute.isRequired ? ' *' : ''}</legend>{attribute.options.map((option) => <label className="check-field" key={option}><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={(event) => toggleMulti(option, event.target.checked)} /><span>{option}</span></label>)}</fieldset>;
  if (attribute.dataType === 'BOOLEAN') return <label className="check-field"><input type="checkbox" checked={value === true} onChange={(event) => setValue(event.target.checked)} /><span>{label}</span></label>;
  const minimum = typeof attribute.validation.min === 'number' ? attribute.validation.min : undefined;
  const maximum = typeof attribute.validation.max === 'number' ? attribute.validation.max : undefined;
  const maxLength = typeof attribute.validation.maxLength === 'number' ? attribute.validation.maxLength : undefined;
  return <label className="form-field"><span>{label}{attribute.isRequired ? ' *' : ''}</span><input type={attribute.dataType === 'NUMBER' ? 'number' : 'text'} min={minimum} max={maximum} maxLength={maxLength} required={attribute.isRequired} value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} onChange={(event) => setValue(event.target.value)} /></label>;
}

function emptyDraft(): ProductDraft {
  return { id: '', categoryId: '', nameFa: '', sku: '', description: '', specifications: {}, minimumOrderDescription: '', leadTimeDescription: '', isAvailable: true, status: 'DRAFT', expectedVersion: 0 };
}

