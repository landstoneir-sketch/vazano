'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../../../lib/api';

type Organization = { id: string; displayName: string; kind: string };
type Industry = { id: string; nameFa: string };
type Category = { id: string; industryId: string; parentId: string | null; nameFa: string };
type Unit = { id: string; nameFa: string; symbolFa: string };
type ProductAttribute = {
  id: string;
  code: string;
  nameFa: string;
  dataType: 'TEXT' | 'NUMBER' | 'SINGLE_SELECT' | 'MULTI_SELECT' | 'BOOLEAN';
  unitLabelFa: string | null;
  options: string[];
  validation: Record<string, unknown>;
  isRequired: boolean;
};
type SpecificationValue = string | boolean | string[];
type CreatedRfq = { id: string; code: string; commitmentStatus: string; commitmentAmountRial: string | null; operationalStatus: string };
type Attachment = { id: string; originalName: string; status: string; sizeBytes: number };
type UploadIntent = { attachment: Attachment; upload: { url: string; method: 'PUT'; headers: Record<string, string> } };

export function NewRfqForm() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [title, setTitle] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [installationRequired, setInstallationRequired] = useState(false);
  const [qualityControlRequested, setQualityControlRequested] = useState(false);
  const [productAttributes, setProductAttributes] = useState<ProductAttribute[]>([]);
  const [specifications, setSpecifications] = useState<Record<string, SpecificationValue>>({});
  const [created, setCreated] = useState<CreatedRfq | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    void Promise.all([
      apiRequest<Organization[]>('/organizations/mine'),
      apiRequest<Industry[]>('/catalog/industries'),
      apiRequest<Category[]>('/catalog/categories'),
      apiRequest<Unit[]>('/catalog/units'),
    ]).then(([orgData, industryData, categoryData, unitData]) => {
      const buyers = orgData.filter((item) => item.kind === 'BUYER');
      setOrganizations(buyers); setIndustries(industryData); setCategories(categoryData); setUnits(unitData);
      setOrganizationId(buyers[0]?.id ?? ''); setIndustryId(industryData[0]?.id ?? ''); setUnitId(unitData[0]?.id ?? '');
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'دریافت اطلاعات اولیه انجام نشد.'));
  }, []);

  const selectableCategories = useMemo(() => categories.filter((item) => item.industryId === industryId && item.parentId), [categories, industryId]);

  useEffect(() => {
    if (!categoryId) return;
    let active = true;
    void apiRequest<ProductAttribute[]>(`/catalog/categories/${categoryId}/attributes`)
      .then((data) => { if (active) { setProductAttributes(data); setSpecifications({}); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت ویژگی‌های فنی انجام نشد.'); });
    return () => { active = false; };
  }, [categoryId]);

  function attributeLabel(attribute: ProductAttribute) {
    return attribute.unitLabelFa ? `${attribute.nameFa} (${attribute.unitLabelFa})` : attribute.nameFa;
  }

  function toggleMultiValue(code: string, option: string, checked: boolean) {
    setSpecifications((current) => {
      const selected = Array.isArray(current[code]) ? current[code] as string[] : [];
      return { ...current, [code]: checked ? [...selected, option] : selected.filter((item) => item !== option) };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setCreated(null);
    try {
      const rfq = await apiRequest<CreatedRfq>('/rfqs', { method: 'POST', body: JSON.stringify({
        buyerOrganizationId: organizationId,
        primaryDomainId: industryId,
        title,
        deliveryProvince: province || undefined,
        deliveryCity: city || undefined,
        installationRequired,
        qualityControlRequested,
        items: [{ categoryId, unitId, title: itemTitle, quantity, specifications }],
      }) });
      setCreated(rfq);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'ثبت استعلام انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function submitForReview() {
    if (!created) return;
    setBusy(true); setError('');
    try {
      const updated = await apiRequest<CreatedRfq>(`/rfqs/${created.id}/submit`, { method: 'POST' });
      setCreated(updated);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'ارسال برای بررسی انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function uploadAttachment() {
    if (!created || !selectedFile) return;
    setBusy(true); setError('');
    try {
      const intent = await apiRequest<UploadIntent>(`/attachments/rfqs/${created.id}/upload-intent`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          sizeBytes: selectedFile.size,
          purpose: selectedFile.type.startsWith('image/') ? 'PRODUCT_IMAGE' : 'GENERAL',
        }),
      });
      const upload = await fetch(intent.upload.url, { method: intent.upload.method, headers: intent.upload.headers, body: selectedFile });
      if (!upload.ok) throw new Error('ارسال فایل به فضای ذخیره‌سازی انجام نشد.');
      const completed = await apiRequest<Attachment>(`/attachments/${intent.attachment.id}/complete`, { method: 'POST' });
      setAttachments((items) => [...items, completed]);
      setSelectedFile(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'بارگذاری فایل انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  if (!error && organizations.length === 0) return <div className="card"><p>برای ثبت استعلام ابتدا حساب خریدار ایجاد کنید.</p><Link className="button button-primary" href="/dashboard/organization">ایجاد حساب خریدار</Link></div>;

  return <form className="card form-grid" onSubmit={submit}>
    {error && <div className="message message-error">{error}</div>}
    {created && <div className="message message-success"><strong>{created.operationalStatus === 'UNDER_REVIEW' ? 'استعلام در صف بررسی است.' : 'پیش‌نویس ثبت شد.'}</strong><br />کد استعلام: {created.code}<br />وضعیت تعهد: {created.commitmentStatus}{created.operationalStatus !== 'UNDER_REVIEW' && <><br /><button type="button" className="button button-secondary" onClick={() => void submitForReview()} disabled={busy}>ارسال برای بررسی وازانو</button></>}</div>}
    {created && created.operationalStatus !== 'UNDER_REVIEW' && <fieldset className="fieldset full"><legend>عکس، نقشه، متره یا مشخصات فنی</legend>
      <p className="muted">PDF، تصویر، Word یا Excel تا حداکثر ۲۰ مگابایت؛ فایل اجرایی و SVG پذیرفته نمی‌شود.</p>
      <div className="attachment-upload-row">
        <input aria-label="انتخاب فایل پیوست" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.docx" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
        <button className="button button-secondary" type="button" disabled={busy || !selectedFile} onClick={() => void uploadAttachment()}>بارگذاری فایل</button>
      </div>
      {attachments.length > 0 && <ul>{attachments.map((attachment) => <li key={attachment.id}>{attachment.originalName} — {attachment.status === 'READY' ? 'آماده' : 'در انتظار بررسی امنیتی'}</li>)}</ul>}
    </fieldset>}
    <label className="form-field"><span>حساب خریدار</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} required>{organizations.map((item) => <option value={item.id} key={item.id}>{item.displayName}</option>)}</select></label>
    <label className="form-field"><span>حوزه اصلی</span><select value={industryId} onChange={(event) => { setIndustryId(event.target.value); setCategoryId(''); setProductAttributes([]); setSpecifications({}); }} required>{industries.map((item) => <option value={item.id} key={item.id}>{item.nameFa}</option>)}</select></label>
    <label className="form-field full"><span>عنوان استعلام</span><input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} placeholder="مثلاً تأمین سنگ نمای پروژه مسکونی" /></label>
    <fieldset className="fieldset full"><legend>ردیف محصول</legend><div className="form-columns">
      <label className="form-field"><span>نوع سنگ</span><select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setProductAttributes([]); setSpecifications({}); }} required><option value="">انتخاب کنید</option>{selectableCategories.map((item) => <option value={item.id} key={item.id}>{item.nameFa}</option>)}</select></label>
      <label className="form-field"><span>شرح محصول</span><input value={itemTitle} onChange={(event) => setItemTitle(event.target.value)} required minLength={2} placeholder="سنگ تراورتن کرم، ضخامت ۲ سانتی‌متر" /></label>
      <label className="form-field"><span>مقدار</span><input value={quantity} onChange={(event) => setQuantity(event.target.value)} required inputMode="decimal" dir="ltr" /></label>
      <label className="form-field"><span>واحد</span><select value={unitId} onChange={(event) => setUnitId(event.target.value)} required>{units.map((item) => <option value={item.id} key={item.id}>{item.nameFa} ({item.symbolFa})</option>)}</select></label>
    </div></fieldset>
    {productAttributes.length > 0 && <fieldset className="fieldset full"><legend>مشخصات فنی محصول</legend><div className="form-columns">
      {productAttributes.map((attribute) => {
        const label = attributeLabel(attribute);
        const value = specifications[attribute.code];
        if (attribute.dataType === 'SINGLE_SELECT') return <label className="form-field" key={attribute.id}><span>{label}{attribute.isRequired ? ' *' : ''}</span><select aria-label={label} value={typeof value === 'string' ? value : ''} required={attribute.isRequired} onChange={(event) => setSpecifications((current) => ({ ...current, [attribute.code]: event.target.value }))}><option value="">انتخاب کنید</option>{attribute.options.map((option) => <option value={option} key={option}>{option}</option>)}</select></label>;
        if (attribute.dataType === 'MULTI_SELECT') return <fieldset className="attribute-options" key={attribute.id}><legend>{label}{attribute.isRequired ? ' *' : ''}</legend>{attribute.options.map((option) => <label className="check-field" key={option}><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={(event) => toggleMultiValue(attribute.code, option, event.target.checked)} /><span>{option}</span></label>)}</fieldset>;
        if (attribute.dataType === 'BOOLEAN') return <label className="check-field" key={attribute.id}><input type="checkbox" checked={value === true} onChange={(event) => setSpecifications((current) => ({ ...current, [attribute.code]: event.target.checked }))} /><span>{label}</span></label>;
        const minimum = typeof attribute.validation.min === 'number' ? attribute.validation.min : undefined;
        const maximum = typeof attribute.validation.max === 'number' ? attribute.validation.max : undefined;
        const maxLength = typeof attribute.validation.maxLength === 'number' ? attribute.validation.maxLength : undefined;
        return <label className="form-field" key={attribute.id}><span>{label}{attribute.isRequired ? ' *' : ''}</span><input aria-label={label} type={attribute.dataType === 'NUMBER' ? 'number' : 'text'} min={minimum} max={maximum} maxLength={maxLength} value={typeof value === 'string' ? value : ''} required={attribute.isRequired} onChange={(event) => setSpecifications((current) => ({ ...current, [attribute.code]: event.target.value }))} /></label>;
      })}
    </div></fieldset>}
    <label className="form-field"><span>استان تحویل</span><input value={province} onChange={(event) => setProvince(event.target.value)} /></label>
    <label className="form-field"><span>شهر تحویل</span><input value={city} onChange={(event) => setCity(event.target.value)} /></label>
    <label className="check-field"><input type="checkbox" checked={installationRequired} onChange={(event) => setInstallationRequired(event.target.checked)} /><span>نیاز به نصب دارم</span></label>
    <label className="check-field"><input type="checkbox" checked={qualityControlRequested} onChange={(event) => setQualityControlRequested(event.target.checked)} /><span>کنترل کیفیت توسط وازانو (کارمزد ۳٪ مبلغ خرید)</span></label>
    <div className="message">وازانو واسط اطلاعات است. مبلغ کالا، حمل، نصب و مالیات مستقیماً میان خریدار و فروشنده تعیین می‌شود.</div>
    <button className="button button-primary" disabled={busy || !organizationId}>{busy ? 'در حال ثبت…' : 'ذخیره پیش‌نویس استعلام'}</button>
  </form>;
}
