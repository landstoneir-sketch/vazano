'use client';

import { FormEvent, useState } from 'react';
import { apiRequest } from '@/lib/api';
import type { UnitOfMeasure } from './catalog-types';

type UnitDraft = {
  id?: string;
  code: string;
  nameFa: string;
  symbolFa: string;
  decimalScale: number;
  isActive: boolean;
  updatedAt?: string;
};

const emptyUnit: UnitDraft = { code: '', nameFa: '', symbolFa: '', decimalScale: 2, isActive: true };

function fromUnit(unit: UnitOfMeasure): UnitDraft {
  return { id: unit.id, code: unit.code, nameFa: unit.nameFa, symbolFa: unit.symbolFa, decimalScale: unit.decimalScale, isActive: unit.isActive, updatedAt: unit.updatedAt };
}

export function UnitManager({ units, reload }: { units: UnitOfMeasure[]; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState<UnitDraft>(emptyUnit);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('');
    try {
      if (draft.id) {
        await apiRequest(`/admin/catalog/units/${draft.id}`, { method: 'PUT', body: JSON.stringify({
          nameFa: draft.nameFa, symbolFa: draft.symbolFa, decimalScale: draft.decimalScale,
          isActive: draft.isActive, expectedUpdatedAt: draft.updatedAt,
        }) });
        setMessage('واحد اندازه‌گیری به‌روزرسانی شد.');
      } else {
        await apiRequest('/admin/catalog/units', { method: 'POST', body: JSON.stringify(draft) });
        setMessage('واحد اندازه‌گیری جدید ایجاد شد.');
      }
      await reload(); setDraft(emptyUnit);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'ذخیره واحد اندازه‌گیری انجام نشد.'); }
    finally { setBusy(false); }
  }

  return <section className="card stack"><div className="admin-card-title"><div><h2>واحدهای اندازه‌گیری</h2><p>واحد استفاده‌شده حذف نمی‌شود؛ برای جلوگیری از انتخاب در استعلام‌های جدید آن را غیرفعال کنید.</p></div><button className="button button-secondary" type="button" onClick={() => { setDraft(emptyUnit); setMessage(''); setError(''); }}>واحد جدید</button></div><div className="content-item-list">{units.map((unit) => <button className={draft.id === unit.id ? 'content-item-active' : ''} type="button" key={unit.id} onClick={() => { setDraft(fromUnit(unit)); setMessage(''); setError(''); }}><strong>{unit.nameFa} ({unit.symbolFa})</strong><span>{unit.code} · {unit._count.rfqItems.toLocaleString('fa-IR')} ردیف استعلام</span></button>)}</div><form className="form-grid" onSubmit={save}>{error && <div className="message message-error">{error}</div>}{message && <div className="message message-success">{message}</div>}<label className="form-field"><span>نام فارسی</span><input dir="rtl" value={draft.nameFa} onChange={(event) => setDraft({ ...draft, nameFa: event.target.value })} required /></label><label className="form-field"><span>نماد نمایشی</span><input dir="rtl" value={draft.symbolFa} onChange={(event) => setDraft({ ...draft, symbolFa: event.target.value })} required /></label><label className="form-field"><span>کد پایدار</span><input value={draft.code} disabled={Boolean(draft.id)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => setDraft({ ...draft, code: event.target.value.toLowerCase() })} required /></label><label className="form-field"><span>تعداد رقم اعشار مجاز</span><input type="number" min="0" max="8" value={draft.decimalScale} onChange={(event) => setDraft({ ...draft, decimalScale: Number(event.target.value) })} required /></label><label className="check-field full"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /><span>در استعلام‌های جدید قابل انتخاب باشد</span></label><button className="button button-primary" disabled={busy}>{busy ? 'در حال ذخیره…' : draft.id ? 'ذخیره تغییرات واحد' : 'ایجاد واحد'}</button></form></section>;
}
