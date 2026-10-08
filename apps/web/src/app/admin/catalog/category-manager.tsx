'use client';

import { FormEvent, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';
import type { CatalogCategory, Industry, ProductAttribute } from './catalog-types';

type Props = {
  industries: Industry[];
  categories: CatalogCategory[];
  attributes: ProductAttribute[];
  reload: () => Promise<void>;
};

type CategoryDraft = {
  id?: string;
  industryId: string;
  parentId: string;
  code: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
  updatedAt?: string;
};

function newDraft(industries: Industry[]): CategoryDraft {
  return { industryId: industries[0]?.id ?? '', parentId: '', code: '', slug: '', nameFa: '', nameEn: '', sortOrder: 0, isActive: true };
}

function fromCategory(category: CatalogCategory): CategoryDraft {
  return {
    id: category.id,
    industryId: category.industryId,
    parentId: category.parentId ?? '',
    code: category.code,
    slug: category.slug,
    nameFa: category.nameFa,
    nameEn: category.nameEn ?? '',
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    updatedAt: category.updatedAt,
  };
}

export function CategoryManager({ industries, categories, attributes, reload }: Props) {
  const [draft, setDraft] = useState<CategoryDraft>(() => newDraft(industries));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const effectiveIndustryId = draft.industryId || industries[0]?.id || '';
  const selectedCategory = categories.find((item) => item.id === draft.id);
  const parentOptions = useMemo(
    () => categories.filter((item) => item.industryId === effectiveIndustryId && item.id !== draft.id),
    [categories, draft.id, effectiveIndustryId],
  );

  async function saveCategory(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (draft.id) {
        await apiRequest(`/admin/catalog/categories/${draft.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            parentId: draft.parentId || undefined,
            clearParent: !draft.parentId,
            nameFa: draft.nameFa,
            nameEn: draft.nameEn || undefined,
            sortOrder: draft.sortOrder,
            isActive: draft.isActive,
            expectedUpdatedAt: draft.updatedAt,
          }),
        });
        setMessage('دسته‌بندی به‌روزرسانی شد.');
      } else {
        await apiRequest('/admin/catalog/categories', {
          method: 'POST',
          body: JSON.stringify({ ...draft, industryId: effectiveIndustryId, parentId: draft.parentId || undefined, nameEn: draft.nameEn || undefined }),
        });
        setMessage('دسته‌بندی جدید ایجاد شد.');
      }
      await reload();
      setDraft(newDraft(industries));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'ذخیره دسته‌بندی انجام نشد.');
    } finally { setBusy(false); }
  }

  return <div className="stack">
    <section className="card stack">
      <div className="admin-card-title"><div><h2>دسته‌بندی‌های بازار</h2><p>حذف فیزیکی انجام نمی‌شود؛ دسته‌های قدیمی را غیرفعال کنید تا سوابق استعلام‌ها حفظ شود.</p></div><button className="button button-secondary" type="button" onClick={() => setDraft(newDraft(industries))}>دسته جدید</button></div>
      <div className="content-item-list catalog-item-list">{categories.map((category) => <button className={draft.id === category.id ? 'content-item-active' : ''} type="button" key={category.id} onClick={() => { setDraft(fromCategory(category)); setError(''); setMessage(''); }}><strong>{category.nameFa}</strong><span>{category.parent?.nameFa ?? category.industry.nameFa} · {category.isActive ? 'فعال' : 'غیرفعال'}</span></button>)}</div>
      <form className="form-grid" onSubmit={saveCategory}>
        {error && <div className="message message-error">{error}</div>}{message && <div className="message message-success">{message}</div>}
        <label className="form-field"><span>نام فارسی</span><input dir="rtl" value={draft.nameFa} onChange={(event) => setDraft({ ...draft, nameFa: event.target.value })} required /></label>
        <label className="form-field"><span>نام انگلیسی</span><input value={draft.nameEn} onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })} /></label>
        <label className="form-field"><span>حوزه صنعتی</span><select value={effectiveIndustryId} disabled={Boolean(draft.id)} onChange={(event) => setDraft({ ...draft, industryId: event.target.value, parentId: '' })}>{industries.map((industry) => <option key={industry.id} value={industry.id}>{industry.nameFa}</option>)}</select></label>
        <label className="form-field"><span>دسته والد</span><select value={draft.parentId} onChange={(event) => setDraft({ ...draft, parentId: event.target.value })}><option value="">بدون والد</option>{parentOptions.map((category) => <option key={category.id} value={category.id}>{category.nameFa}</option>)}</select></label>
        <label className="form-field"><span>کد پایدار</span><input value={draft.code} disabled={Boolean(draft.id)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => setDraft({ ...draft, code: event.target.value.toLowerCase() })} required /></label>
        <label className="form-field"><span>نشانی لاتین</span><input value={draft.slug} disabled={Boolean(draft.id)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => setDraft({ ...draft, slug: event.target.value.toLowerCase() })} required /></label>
        <label className="form-field"><span>ترتیب نمایش</span><input type="number" min="0" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label>
        <label className="check-field"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /><span>در فرم استعلام قابل انتخاب باشد</span></label>
        <button className="button button-primary" disabled={busy || !effectiveIndustryId}>{busy ? 'در حال ذخیره…' : draft.id ? 'ذخیره تغییرات' : 'ایجاد دسته‌بندی'}</button>
      </form>
    </section>
    {selectedCategory && <CategoryBindings category={selectedCategory} attributes={attributes} reload={reload} />}
  </div>;
}

function CategoryBindings({ category, attributes, reload }: { category: CatalogCategory; attributes: ProductAttribute[]; reload: () => Promise<void> }) {
  return <section className="card stack"><div><h2>فیلدهای «{category.nameFa}»</h2><p>ویژگی‌های ضروری، هنگام ثبت استعلام توسط خریدار اجباری خواهند بود.</p></div><div className="catalog-binding-grid">{attributes.map((attribute) => {
    const binding = category.attributeBindings.find((item) => item.attributeId === attribute.id);
    return <BindingEditor key={`${category.id}:${attribute.id}`} categoryId={category.id} attribute={attribute} binding={binding} reload={reload} />;
  })}</div></section>;
}

function BindingEditor({ categoryId, attribute, binding, reload }: { categoryId: string; attribute: ProductAttribute; binding?: CatalogCategory['attributeBindings'][number]; reload: () => Promise<void> }) {
  const [enabled, setEnabled] = useState(Boolean(binding));
  const [required, setRequired] = useState(binding?.isRequired ?? false);
  const [sortOrder, setSortOrder] = useState(binding?.sortOrder ?? 0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function save() {
    setBusy(true); setMessage('');
    try {
      if (enabled) await apiRequest(`/admin/catalog/categories/${categoryId}/attributes/${attribute.id}`, { method: 'PUT', body: JSON.stringify({ isRequired: required, sortOrder }) });
      else if (binding) await apiRequest(`/admin/catalog/categories/${categoryId}/attributes/${attribute.id}`, { method: 'DELETE' });
      await reload(); setMessage('ذخیره شد.');
    } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : 'ذخیره اتصال انجام نشد.'); }
    finally { setBusy(false); }
  }

  return <article className="catalog-binding-card"><strong>{attribute.nameFa}</strong><small>{attribute.code} · {dataTypeLabel(attribute.dataType)}</small><label className="check-field"><input type="checkbox" checked={enabled} onChange={(event) => { setEnabled(event.target.checked); if (!event.target.checked) setRequired(false); }} /><span>فعال برای این دسته</span></label><label className="check-field"><input type="checkbox" checked={required} disabled={!enabled} onChange={(event) => setRequired(event.target.checked)} /><span>ورود مقدار الزامی باشد</span></label><label className="form-field"><span>ترتیب</span><input type="number" min="0" disabled={!enabled} value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} /></label><button className="button button-secondary" type="button" disabled={busy} onClick={() => void save()}>ذخیره</button>{message && <small>{message}</small>}</article>;
}

function dataTypeLabel(value: ProductAttribute['dataType']): string {
  return ({ TEXT: 'متن', NUMBER: 'عدد', SINGLE_SELECT: 'تک‌انتخابی', MULTI_SELECT: 'چندانتخابی', BOOLEAN: 'بله/خیر' } as const)[value];
}
