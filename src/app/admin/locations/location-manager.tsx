'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Province = { id: string; code: string; nameFa: string; nameEn: string | null; sortOrder: number; isActive: boolean; updatedAt: string; _count: { cities: number; rfqs: number } };
type City = { id: string; provinceId: string; code: string; nameFa: string; nameEn: string | null; isProvinceCapital: boolean; sortOrder: number; isActive: boolean; updatedAt: string; _count: { rfqs: number } };
type ProvinceDraft = { id?: string; code: string; nameFa: string; nameEn: string; sortOrder: number; isActive: boolean; updatedAt?: string };
type CityDraft = { id?: string; code: string; nameFa: string; nameEn: string; isProvinceCapital: boolean; sortOrder: number; isActive: boolean; updatedAt?: string };

const emptyProvince: ProvinceDraft = { code: '', nameFa: '', nameEn: '', sortOrder: 100, isActive: true };
const emptyCity: CityDraft = { code: '', nameFa: '', nameEn: '', isProvinceCapital: false, sortOrder: 100, isActive: true };

export function LocationManager() {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [provinceDraft, setProvinceDraft] = useState<ProvinceDraft>(emptyProvince);
  const [cityDraft, setCityDraft] = useState<CityDraft>(emptyCity);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadProvinces() {
    const data = await apiRequest<Province[]>('/admin/locations/provinces');
    setProvinces(data);
    setSelectedProvinceId((current) => current || data[0]?.id || '');
  }

  async function loadCities(provinceId: string) {
    if (!provinceId) { setCities([]); return; }
    setCities(await apiRequest<City[]>(`/admin/locations/cities?provinceId=${encodeURIComponent(provinceId)}`));
  }

  useEffect(() => {
    let active = true;
    void apiRequest<Province[]>('/admin/locations/provinces').then((data) => {
      if (!active) return;
      setProvinces(data); setSelectedProvinceId(data[0]?.id || '');
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت استان‌ها انجام نشد.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!selectedProvinceId) return;
    let active = true;
    void apiRequest<City[]>(`/admin/locations/cities?provinceId=${encodeURIComponent(selectedProvinceId)}`).then((data) => { if (active) setCities(data); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت شهرها انجام نشد.'); });
    return () => { active = false; };
  }, [selectedProvinceId]);

  async function saveProvince(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('');
    try {
      if (provinceDraft.id) {
        await apiRequest(`/admin/locations/provinces/${provinceDraft.id}`, { method: 'PUT', body: JSON.stringify({ nameFa: provinceDraft.nameFa, nameEn: provinceDraft.nameEn || undefined, sortOrder: provinceDraft.sortOrder, isActive: provinceDraft.isActive, expectedUpdatedAt: provinceDraft.updatedAt }) });
        setMessage('استان به‌روزرسانی شد.');
      } else {
        await apiRequest('/admin/locations/provinces', { method: 'POST', body: JSON.stringify({ ...provinceDraft, nameEn: provinceDraft.nameEn || undefined }) });
        setMessage('استان جدید ایجاد شد.');
      }
      await loadProvinces(); setProvinceDraft(emptyProvince);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'ذخیره استان انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function saveCity(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('');
    try {
      if (cityDraft.id) {
        await apiRequest(`/admin/locations/cities/${cityDraft.id}`, { method: 'PUT', body: JSON.stringify({ provinceId: selectedProvinceId, nameFa: cityDraft.nameFa, nameEn: cityDraft.nameEn || undefined, isProvinceCapital: cityDraft.isProvinceCapital, sortOrder: cityDraft.sortOrder, isActive: cityDraft.isActive, expectedUpdatedAt: cityDraft.updatedAt }) });
        setMessage('شهر به‌روزرسانی شد.');
      } else {
        await apiRequest('/admin/locations/cities', { method: 'POST', body: JSON.stringify({ ...cityDraft, provinceId: selectedProvinceId, nameEn: cityDraft.nameEn || undefined }) });
        setMessage('شهر جدید ایجاد شد.');
      }
      await Promise.all([loadCities(selectedProvinceId), loadProvinces()]); setCityDraft(emptyCity);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'ذخیره شهر انجام نشد.'); }
    finally { setBusy(false); }
  }

  function editProvince(province: Province) {
    setSelectedProvinceId(province.id); setCityDraft(emptyCity); setProvinceDraft({ id: province.id, code: province.code, nameFa: province.nameFa, nameEn: province.nameEn ?? '', sortOrder: province.sortOrder, isActive: province.isActive, updatedAt: province.updatedAt }); setMessage(''); setError('');
  }

  function editCity(city: City) {
    setCityDraft({ id: city.id, code: city.code, nameFa: city.nameFa, nameEn: city.nameEn ?? '', isProvinceCapital: city.isProvinceCapital, sortOrder: city.sortOrder, isActive: city.isActive, updatedAt: city.updatedAt }); setMessage(''); setError('');
  }

  return <div className="stack">{error && <div className="message message-error">{error}</div>}{message && <div className="message message-success">{message}</div>}<section className="card stack"><div className="admin-card-title"><div><h2>استان‌ها</h2><p>{provinces.length.toLocaleString('fa-IR')} استان ثبت شده است.</p></div><button className="button button-secondary" type="button" onClick={() => setProvinceDraft(emptyProvince)}>استان جدید</button></div><div className="content-item-list">{provinces.map((province) => <button className={selectedProvinceId === province.id ? 'content-item-active' : ''} type="button" key={province.id} onClick={() => editProvince(province)}><strong>{province.nameFa}{!province.isActive ? ' — غیرفعال' : ''}</strong><span>{province._count.cities.toLocaleString('fa-IR')} شهر · {province._count.rfqs.toLocaleString('fa-IR')} استعلام</span></button>)}</div><form className="form-grid" onSubmit={saveProvince}><label className="form-field"><span>نام فارسی استان</span><input value={provinceDraft.nameFa} onChange={(event) => setProvinceDraft({ ...provinceDraft, nameFa: event.target.value })} required /></label><label className="form-field"><span>نام انگلیسی</span><input dir="ltr" value={provinceDraft.nameEn} onChange={(event) => setProvinceDraft({ ...provinceDraft, nameEn: event.target.value })} /></label><label className="form-field"><span>کد پایدار</span><input dir="ltr" value={provinceDraft.code} disabled={Boolean(provinceDraft.id)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => setProvinceDraft({ ...provinceDraft, code: event.target.value.toLowerCase() })} required /></label><label className="form-field"><span>ترتیب نمایش</span><input type="number" min="0" max="1000" value={provinceDraft.sortOrder} onChange={(event) => setProvinceDraft({ ...provinceDraft, sortOrder: Number(event.target.value) })} required /></label><label className="check-field full"><input type="checkbox" checked={provinceDraft.isActive} onChange={(event) => setProvinceDraft({ ...provinceDraft, isActive: event.target.checked })} /><span>در فرم‌های جدید قابل انتخاب باشد</span></label><button className="button button-primary" disabled={busy}>{provinceDraft.id ? 'ذخیره تغییرات استان' : 'ایجاد استان'}</button></form></section>
  <section className="card stack"><div className="admin-card-title"><div><h2>شهرهای استان انتخاب‌شده</h2><p>مرکز استان در ابتدای فهرست فرم استعلام نمایش داده می‌شود.</p></div><button className="button button-secondary" type="button" disabled={!selectedProvinceId} onClick={() => setCityDraft(emptyCity)}>شهر جدید</button></div><div className="content-item-list">{cities.map((city) => <button className={cityDraft.id === city.id ? 'content-item-active' : ''} type="button" key={city.id} onClick={() => editCity(city)}><strong>{city.nameFa}{city.isProvinceCapital ? ' · مرکز استان' : ''}{!city.isActive ? ' — غیرفعال' : ''}</strong><span>{city.code} · {city._count.rfqs.toLocaleString('fa-IR')} استعلام</span></button>)}</div><form className="form-grid" onSubmit={saveCity}><label className="form-field"><span>نام فارسی شهر</span><input value={cityDraft.nameFa} onChange={(event) => setCityDraft({ ...cityDraft, nameFa: event.target.value })} required /></label><label className="form-field"><span>نام انگلیسی</span><input dir="ltr" value={cityDraft.nameEn} onChange={(event) => setCityDraft({ ...cityDraft, nameEn: event.target.value })} /></label><label className="form-field"><span>کد پایدار</span><input dir="ltr" value={cityDraft.code} disabled={Boolean(cityDraft.id)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => setCityDraft({ ...cityDraft, code: event.target.value.toLowerCase() })} required /></label><label className="form-field"><span>ترتیب نمایش</span><input type="number" min="0" max="10000" value={cityDraft.sortOrder} onChange={(event) => setCityDraft({ ...cityDraft, sortOrder: Number(event.target.value) })} required /></label><label className="check-field"><input type="checkbox" checked={cityDraft.isProvinceCapital} onChange={(event) => setCityDraft({ ...cityDraft, isProvinceCapital: event.target.checked })} /><span>مرکز استان است</span></label><label className="check-field"><input type="checkbox" checked={cityDraft.isActive} onChange={(event) => setCityDraft({ ...cityDraft, isActive: event.target.checked })} /><span>قابل انتخاب باشد</span></label><button className="button button-primary" disabled={busy || !selectedProvinceId}>{cityDraft.id ? 'ذخیره تغییرات شهر' : 'ایجاد شهر'}</button></form></section></div>;
}
