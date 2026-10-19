'use client';

import { FormEvent, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';
import type { AttributeDataType, ProductAttribute } from './catalog-types';
import { stringOptions, validationRules } from './catalog-types';

type AttributeDraft = {
  id?: string;
  code: string;
  nameFa: string;
  nameEn: string;
  dataType: AttributeDataType;
  unitLabelFa: string;
  optionsText: string;
  min: string;
  max: string;
  maxLength: string;
  isActive: boolean;
  version?: number;
};

const emptyDraft: AttributeDraft = { code: '', nameFa: '', nameEn: '', dataType: 'TEXT', unitLabelFa: '', optionsText: '', min: '', max: '', maxLength: '', isActive: true };

function fromAttribute(attribute: ProductAttribute): AttributeDraft {
  const validation = validationRules(attribute.validation);
  return {
    id: attribute.id,
    code: attribute.code,
    nameFa: attribute.nameFa,
    nameEn: attribute.nameEn ?? '',
    dataType: attribute.dataType,
    unitLabelFa: attribute.unitLabelFa ?? '',
    optionsText: stringOptions(attribute.options).join('\n'),
    min: typeof validation.min === 'number' ? String(validation.min) : '',
    max: typeof validation.max === 'number' ? String(validation.max) : '',
    maxLength: typeof validation.maxLength === 'number' ? String(validation.maxLength) : '',
    isActive: attribute.isActive,
    version: attribute.version,
  };
}

export function AttributeManager({ attributes, reload }: { attributes: ProductAttribute[]; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState<AttributeDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const usesOptions = useMemo(() => ['SINGLE_SELECT', 'MULTI_SELECT'].includes(draft.dataType), [draft.dataType]);

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('');
    const options = usesOptions ? draft.optionsText.split(/\r?\n|،|,/).map((item) => item.trim()).filter(Boolean) : [];
    const validation: Record<string, number> = {};
    if (draft.min !== '') validation.min = Number(draft.min);
    if (draft.max !== '') validation.max = Number(draft.max);
    if (draft.maxLength !== '') validation.maxLength = Number(draft.maxLength);
    try {
      if (draft.id) {
        await apiRequest(`/admin/catalog/attributes/${draft.id}`, { method: 'PUT', body: JSON.stringify({
          nameFa: draft.nameFa, nameEn: draft.nameEn || undefined, unitLabelFa: draft.unitLabelFa || undefined,
          options, validation, isActive: draft.isActive, expectedVersion: draft.version,
        }) });
        setMessage('ویژگی به‌روزرسانی شد.');
      } else {
        await apiRequest('/admin/catalog/attributes', { method: 'POST', body: JSON.stringify({
          code: draft.code, nameFa: draft.nameFa, nameEn: draft.nameEn || undefined, dataType: draft.dataType,
          unitLabelFa: draft.unitLabelFa || undefined, options, validation, isActive: draft.isActive,
        }) });
        setMessage('ویژگی جدید ایجاد شد.');
      }
      await reload(); setDraft(emptyDraft);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'ذخیره ویژگی انجام نشد.'); }
    finally { setBusy(false); }
  }

  return <section className="card stack">
    <div className="admin-card-title"><div><h2>تعریف ویژگی‌های محصول</h2><p>کد و نوع داده پس از ایجاد ثابت می‌مانند تا استعلام‌های قبلی قابل تفسیر باقی بمانند.</p></div><button className="button button-secondary" type="button" onClick={() => { setDraft(emptyDraft); setMessage(''); setError(''); }}>ویژگی جدید</button></div>
    <div className="content-item-list catalog-item-list">{attributes.map((attribute) => <button className={draft.id === attribute.id ? 'content-item-active' : ''} type="button" key={attribute.id} onClick={() => { setDraft(fromAttribute(attribute)); setMessage(''); setError(''); }}><strong>{attribute.nameFa}</strong><span>{attribute.code} · {attribute.categoryLinks.length.toLocaleString('fa-IR')} دسته</span></button>)}</div>
    <form className="form-grid" onSubmit={save}>
      {error && <div className="message message-error">{error}</div>}{message && <div className="message message-success">{message}</div>}
      <label className="form-field"><span>عنوان فارسی</span><input dir="rtl" value={draft.nameFa} onChange={(event) => setDraft({ ...draft, nameFa: event.target.value })} required /></label>
      <label className="form-field"><span>عنوان انگلیسی</span><input value={draft.nameEn} onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })} /></label>
      <label className="form-field"><span>کد پایدار</span><input value={draft.code} disabled={Boolean(draft.id)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => setDraft({ ...draft, code: event.target.value.toLowerCase() })} required /></label>
      <label className="form-field"><span>نوع فیلد</span><select value={draft.dataType} disabled={Boolean(draft.id)} onChange={(event) => setDraft({ ...draft, dataType: event.target.value as AttributeDataType })}><option value="TEXT">متن</option><option value="NUMBER">عدد</option><option value="SINGLE_SELECT">انتخاب یک گزینه</option><option value="MULTI_SELECT">انتخاب چند گزینه</option><option value="BOOLEAN">بله / خیر</option></select></label>
      <label className="form-field"><span>واحد نمایشی</span><input dir="rtl" value={draft.unitLabelFa} onChange={(event) => setDraft({ ...draft, unitLabelFa: event.target.value })} placeholder="مثلاً میلی‌متر" /></label>
      <label className="check-field"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /><span>ویژگی فعال باشد</span></label>
      {usesOptions && <label className="form-field full"><span>گزینه‌ها؛ هر گزینه در یک خط</span><textarea rows={6} dir="rtl" value={draft.optionsText} onChange={(event) => setDraft({ ...draft, optionsText: event.target.value })} required /></label>}
      {draft.dataType === 'NUMBER' && <><label className="form-field"><span>کمینه مجاز</span><input type="number" step="any" value={draft.min} onChange={(event) => setDraft({ ...draft, min: event.target.value })} /></label><label className="form-field"><span>بیشینه مجاز</span><input type="number" step="any" value={draft.max} onChange={(event) => setDraft({ ...draft, max: event.target.value })} /></label></>}
      {draft.dataType === 'TEXT' && <label className="form-field"><span>حداکثر طول متن</span><input type="number" min="1" value={draft.maxLength} onChange={(event) => setDraft({ ...draft, maxLength: event.target.value })} /></label>}
      <button className="button button-primary" disabled={busy}>{busy ? 'در حال ذخیره…' : draft.id ? 'ذخیره تغییرات' : 'ایجاد ویژگی'}</button>
    </form>
  </section>;
}
