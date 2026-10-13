'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';

type Category = { id: string; parentId: string | null; nameFa: string };
type Province = { id: string; nameFa: string };
type VerificationDocument = { id: string; originalName: string; status: string; sizeBytes: number };
type UploadIntent = { attachment: VerificationDocument; upload: { url: string; method: 'PUT'; headers: Record<string, string> } };
type SupplierProfile = {
  id: string;
  verificationStatus: string;
  description: string | null;
  productionCapacityDescription: string | null;
  minimumOrderDescription: string | null;
  leadTimeDescription: string | null;
  officialInvoiceAvailable: boolean;
  sampleAvailable: boolean;
  installationAvailable: boolean;
  nationwideCoverage: boolean;
  serviceProvinces: string[];
  serviceProvinceLinks: Array<{ provinceId: string }>;
  categories: Array<{ categoryId: string }>;
  verificationDocuments: VerificationDocument[];
};
type ProfileResponse = { displayName: string; supplierProfile: SupplierProfile | null };

export function SupplierProfileForm({ organizationId }: { organizationId: string }) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('INCOMPLETE');
  const [description, setDescription] = useState('');
  const [productionCapacityDescription, setProductionCapacityDescription] = useState('');
  const [minimumOrderDescription, setMinimumOrderDescription] = useState('');
  const [leadTimeDescription, setLeadTimeDescription] = useState('');
  const [officialInvoiceAvailable, setOfficialInvoiceAvailable] = useState(false);
  const [sampleAvailable, setSampleAvailable] = useState(false);
  const [installationAvailable, setInstallationAvailable] = useState(false);
  const [nationwide, setNationwide] = useState(true);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [selectedProvinceIds, setSelectedProvinceIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [profileExists, setProfileExists] = useState(false);
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([apiRequest<ProfileResponse>(`/suppliers/organizations/${organizationId}/profile`), apiRequest<Category[]>('/catalog/categories'), apiRequest<Province[]>('/locations/provinces')])
      .then(([profile, categoryData, provinceData]) => {
        if (!active) return;
        setName(profile.displayName); setCategories(categoryData.filter((item) => item.parentId)); setProvinces(provinceData);
        if (profile.supplierProfile) {
          setProfileExists(true); setDocuments(profile.supplierProfile.verificationDocuments);
          setStatus(profile.supplierProfile.verificationStatus); setDescription(profile.supplierProfile.description ?? '');
          setProductionCapacityDescription(profile.supplierProfile.productionCapacityDescription ?? '');
          setMinimumOrderDescription(profile.supplierProfile.minimumOrderDescription ?? '');
          setLeadTimeDescription(profile.supplierProfile.leadTimeDescription ?? '');
          setOfficialInvoiceAvailable(profile.supplierProfile.officialInvoiceAvailable);
          setSampleAvailable(profile.supplierProfile.sampleAvailable);
          setInstallationAvailable(profile.supplierProfile.installationAvailable);
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
      const result = await apiRequest<SupplierProfile>(`/suppliers/organizations/${organizationId}/profile`, { method: 'PUT', body: JSON.stringify({
        description,
        productionCapacityDescription,
        minimumOrderDescription,
        leadTimeDescription,
        officialInvoiceAvailable,
        sampleAvailable,
        installationAvailable,
        nationwideCoverage: nationwide,
        serviceProvinceIds: nationwide ? [] : selectedProvinceIds,
        categories: selected.map((categoryId) => ({ categoryId })),
      }) });
      setProfileExists(true); setDocuments(result.verificationDocuments); setStatus(result.verificationStatus); setMessage('پروفایل برای بررسی وازانو ارسال شد. اکنون مدارک هویتی یا مجوز فعالیت را بارگذاری کنید.');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'ثبت پروفایل انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function uploadDocument() {
    if (!selectedFile) return;
    setBusy(true); setMessage('');
    try {
      const intent = await apiRequest<UploadIntent>(`/attachments/suppliers/${organizationId}/upload-intent`, {
        method: 'POST',
        body: JSON.stringify({ fileName: selectedFile.name, mimeType: selectedFile.type, sizeBytes: selectedFile.size, purpose: 'CERTIFICATE' }),
      });
      const upload = await fetch(intent.upload.url, { method: intent.upload.method, headers: intent.upload.headers, body: selectedFile });
      if (!upload.ok) throw new Error('ارسال مدرک به فضای ذخیره‌سازی انجام نشد.');
      const completed = await apiRequest<VerificationDocument>(`/attachments/${intent.attachment.id}/complete`, { method: 'POST' });
      setDocuments((current) => [...current, completed]); setSelectedFile(null); setMessage('مدرک با موفقیت بارگذاری و برای بررسی امنیتی ثبت شد.');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'بارگذاری مدرک انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function downloadDocument(documentId: string) {
    try {
      const result = await apiRequest<{ url: string }>(`/attachments/${documentId}/download-url`);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'دریافت مدرک انجام نشد.'); }
  }

  return <form className="card form-grid" onSubmit={submit}>
    {message && <div className="message">{message}</div>}<div className="full"><h2>{name}</h2><p>وضعیت تأیید: {status}</p></div>
    <label className="form-field full"><span>معرفی مجموعه و توان تولید</span><textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <label className="form-field full"><span>ظرفیت تولید و تأمین</span><textarea rows={3} maxLength={1000} value={productionCapacityDescription} onChange={(event) => setProductionCapacityDescription(event.target.value)} placeholder="مثلاً ظرفیت تقریبی، خطوط فرآوری، شیفت کاری یا امکان تأمین سفارش پروژه‌ای" /><small>اطلاعات را به‌صورت واقعی و قابل بررسی بنویسید؛ واحد و دوره زمانی را داخل متن مشخص کنید.</small></label>
    <label className="form-field"><span>حداقل سفارش</span><input maxLength={300} value={minimumOrderDescription} onChange={(event) => setMinimumOrderDescription(event.target.value)} placeholder="مثلاً وابسته به نوع محصول و ابعاد" /></label>
    <label className="form-field"><span>زمان معمول آماده‌سازی</span><input maxLength={300} value={leadTimeDescription} onChange={(event) => setLeadTimeDescription(event.target.value)} placeholder="مثلاً ۷ تا ۲۰ روز کاری" /></label>
    <fieldset className="fieldset full"><legend>توانمندی‌های تجاری و خدماتی</legend><div className="check-grid">
      <label className="check-field"><input type="checkbox" checked={officialInvoiceAvailable} onChange={(event) => setOfficialInvoiceAvailable(event.target.checked)} /><span>امکان صدور فاکتور رسمی</span></label>
      <label className="check-field"><input type="checkbox" checked={sampleAvailable} onChange={(event) => setSampleAvailable(event.target.checked)} /><span>امکان ارائه نمونه محصول</span></label>
      <label className="check-field"><input type="checkbox" checked={installationAvailable} onChange={(event) => setInstallationAvailable(event.target.checked)} /><span>امکان ارائه خدمات نصب</span></label>
    </div></fieldset>
    <label className="check-field full"><input type="checkbox" checked={nationwide} onChange={(event) => setNationwide(event.target.checked)} /><span>امکان تأمین در کل ایران</span></label>
    {!nationwide && <fieldset className="fieldset full"><legend>استان‌های تحت پوشش</legend><p className="muted">فقط استان‌هایی را انتخاب کنید که امکان تأمین و تحویل واقعی در آن‌ها دارید.</p><div className="check-grid">{provinces.map((province) => <label className="check-field" key={province.id}><input type="checkbox" checked={selectedProvinceIds.includes(province.id)} onChange={(event) => setSelectedProvinceIds((current) => event.target.checked ? [...current, province.id] : current.filter((id) => id !== province.id))} /><span>{province.nameFa}</span></label>)}</div></fieldset>}
    <fieldset className="fieldset full"><legend>انواع سنگ قابل تأمین</legend><div className="check-grid">{categories.map((category) => <label className="check-field" key={category.id}><input type="checkbox" checked={selected.includes(category.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, category.id] : current.filter((id) => id !== category.id))} /><span>{category.nameFa}</span></label>)}</div></fieldset>
    <button className="button button-primary" disabled={busy || selected.length === 0 || (!nationwide && selectedProvinceIds.length === 0)}>{busy ? 'در حال ثبت…' : 'ارسال برای بررسی'}</button>
    <fieldset className="fieldset full"><legend>مدارک احراز مجموعه</legend>
      <p className="muted">ابتدا اطلاعات بالا را ثبت کنید، سپس حداقل یک مدرک هویتی، ثبتی یا مجوز فعالیت با فرمت PDF یا تصویر و حداکثر ۲۰ مگابایت بارگذاری کنید.</p>
      <div className="attachment-upload-row"><input aria-label="انتخاب مدرک احراز فروشنده" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={!profileExists || busy || ['VERIFIED', 'SUSPENDED'].includes(status)} onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} /><button className="button button-secondary" type="button" disabled={!profileExists || busy || !selectedFile || ['VERIFIED', 'SUSPENDED'].includes(status)} onClick={() => void uploadDocument()}>بارگذاری مدرک</button></div>
      {documents.length > 0 && <ul>{documents.map((document) => <li key={document.id}>{document.originalName} — {documentStatusLabel(document.status)} {document.status === 'READY' && <button className="button button-ghost" type="button" onClick={() => void downloadDocument(document.id)}>مشاهده</button>}</li>)}</ul>}
    </fieldset>
  </form>;
}

function documentStatusLabel(status: string): string {
  return ({ PENDING_UPLOAD: 'در انتظار بارگذاری', PENDING_SCAN: 'در انتظار بررسی امنیتی', READY: 'آماده بررسی', QUARANTINED: 'قرنطینه‌شده', REJECTED: 'ردشده' } as Record<string, string>)[status] ?? status;
}
