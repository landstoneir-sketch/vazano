'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';

type Category = { id: string; parentId: string | null; nameFa: string };
type Province = { id: string; nameFa: string };
type ProfileResponse = { displayName: string; supplierProfile: null | { verificationStatus: string; description: string | null; nationwideCoverage: boolean; serviceProvinces: string[]; serviceProvinceLinks: Array<{ provinceId: string }>; categories: Array<{ categoryId: string }> } };

export function SupplierProfileForm({ organizationId }: { organizationId: string }) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('INCOMPLETE');
  const [description, setDescription] = useState('');
  const [nationwide, setNationwide] = useState(true);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [selectedProvinceIds, setSelectedProvinceIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([apiRequest<ProfileResponse>(`/suppliers/organizations/${organizationId}/profile`), apiRequest<Category[]>('/catalog/categories'), apiRequest<Province[]>('/locations/provinces')])
      .then(([profile, categoryData, provinceData]) => {
        if (!active) return;
        setName(profile.displayName); setCategories(categoryData.filter((item) => item.parentId)); setProvinces(provinceData);
        if (profile.supplierProfile) {
          setStatus(profile.supplierProfile.verificationStatus); setDescription(profile.supplierProfile.description ?? '');
          setNationwide(profile.supplierProfile.nationwideCoverage);
          setSelectedProvinceIds(profile.supplierProfile.serviceProvinceLinks.length > 0
            ? profile.supplierProfile.serviceProvinceLinks.map((item) => item.provinceId)
            : provinceData.filter((province) => profile.supplierProfile?.serviceProvinces.includes(province.nameFa)).map((province) => province.id));
          setSelected(profile.supplierProfile.categories.map((item) => item.categoryId));
        }
      }).catch((reason: unknown) => { if (active) setMessage(reason instanceof Error ? reason.message : 'دریافت پروفایل انجام نشد.'); });
    return () => { active = false; };
  }, [organizationId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await apiRequest<{ verificationStatus: string }>(`/suppliers/organizations/${organizationId}/profile`, { method: 'PUT', body: JSON.stringify({
        description, nationwideCoverage: nationwide, serviceProvinceIds: nationwide ? [] : selectedProvinceIds, categories: selected.map((categoryId) => ({ categoryId })),
      }) });
      setStatus(result.verificationStatus); setMessage('پروفایل برای بررسی وازانو ارسال شد.');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'ثبت پروفایل انجام نشد.'); }
    finally { setBusy(false); }
  }

  return <form className="card form-grid" onSubmit={submit}>
    {message && <div className="message">{message}</div>}<div className="full"><h2>{name}</h2><p>وضعیت تأیید: {status}</p></div>
    <label className="form-field full"><span>معرفی مجموعه و توان تولید</span><textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <label className="check-field full"><input type="checkbox" checked={nationwide} onChange={(event) => setNationwide(event.target.checked)} /><span>امکان تأمین در کل ایران</span></label>
    {!nationwide && <fieldset className="fieldset full"><legend>استان‌های تحت پوشش</legend><p className="muted">فقط استان‌هایی را انتخاب کنید که امکان تأمین و تحویل واقعی در آن‌ها دارید.</p><div className="check-grid">{provinces.map((province) => <label className="check-field" key={province.id}><input type="checkbox" checked={selectedProvinceIds.includes(province.id)} onChange={(event) => setSelectedProvinceIds((current) => event.target.checked ? [...current, province.id] : current.filter((id) => id !== province.id))} /><span>{province.nameFa}</span></label>)}</div></fieldset>}
    <fieldset className="fieldset full"><legend>انواع سنگ قابل تأمین</legend><div className="check-grid">{categories.map((category) => <label className="check-field" key={category.id}><input type="checkbox" checked={selected.includes(category.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, category.id] : current.filter((id) => id !== category.id))} /><span>{category.nameFa}</span></label>)}</div></fieldset>
    <button className="button button-primary" disabled={busy || selected.length === 0 || (!nationwide && selectedProvinceIds.length === 0)}>{busy ? 'در حال ثبت…' : 'ارسال برای بررسی'}</button>
  </form>;
}
