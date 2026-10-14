'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../../../../lib/api';
import { formatProductSpecifications, type ProductAttributeBinding, type ProductSpecifications } from '../../../../../lib/product-specifications';

type Organization = { id: string; displayName: string; kind: string; status: string };
type RfqItem = { id: string; title: string; quantity: string; specifications: ProductSpecifications; category: { nameFa: string; attributeBindings: ProductAttributeBinding[] }; unit: { symbolFa: string } };
type Rfq = { id: string; code: string; title: string; description: string | null; deliveryProvince: string | null; deliveryCity: string | null; requiredAt: string | null; responseDeadline: string | null; installationRequired: boolean; items: RfqItem[] };
type QuotationItem = { rfqItemId: string; quantity: string; unitPriceRial: string; discountRial: string; isAlternative: boolean; offeredDescription: string | null };
type CreatedQuotation = { id: string; code: string; status: string; finalAmountRial: string; updatedAt: string };
type SupplierQuotation = CreatedQuotation & {
  rfq: { id: string };
  paymentTerms: string | null;
  preparationDays: number | null;
  deliveryDate: string | null;
  validUntil: string | null;
  discountRial: string;
  taxRial: string;
  packagingRial: string;
  loadingRial: string;
  shippingRial: string;
  otherCostsRial: string;
  items: QuotationItem[];
};
type ProposalFeePolicy = { version: string; rate: string; minToman: number; maxToman: number; refundFractionIfEligible: string };
type Attachment = { id: string; originalName: string; status: string; sizeBytes: number };
type UploadIntent = { attachment: Attachment; upload: { url: string; method: 'PUT'; headers: Record<string, string> } };

const toRial = (toman: string) => Math.round(Number(toman || '0') * 10).toString();
const fromRial = (rial: string) => (BigInt(rial || '0') / BigInt(10)).toString();
const dateAfterDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const datePart = (value: string | null) => value ? new Date(value).toISOString().slice(0, 10) : '';

export function QuoteForm({ rfqId, initialOrganizationId }: { rfqId: string; initialOrganizationId: string }) {
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState(initialOrganizationId);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [lineDiscounts, setLineDiscounts] = useState<Record<string, string>>({});
  const [includedItems, setIncludedItems] = useState<Record<string, boolean>>({});
  const [alternatives, setAlternatives] = useState<Record<string, boolean>>({});
  const [offeredDescriptions, setOfferedDescriptions] = useState<Record<string, string>>({});
  const [shippingToman, setShippingToman] = useState('0');
  const [packagingToman, setPackagingToman] = useState('0');
  const [loadingToman, setLoadingToman] = useState('0');
  const [otherCostsToman, setOtherCostsToman] = useState('0');
  const [discountToman, setDiscountToman] = useState('0');
  const [taxToman, setTaxToman] = useState('0');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [preparationDays, setPreparationDays] = useState('7');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [validUntil, setValidUntil] = useState(dateAfterDays(7));
  const [created, setCreated] = useState<CreatedQuotation | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [feePolicy, setFeePolicy] = useState<ProposalFeePolicy | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([apiRequest<Rfq>(`/rfqs/${rfqId}`), apiRequest<Organization[]>('/organizations/mine'), apiRequest<ProposalFeePolicy>('/quotations/active-policy')])
      .then(([rfqData, orgData, policyData]) => {
        if (!active) return;
        const suppliers = orgData.filter((item) => item.kind === 'SUPPLIER');
        setRfq(rfqData); setOrganizations(suppliers); setFeePolicy(policyData);
        setQuantities(Object.fromEntries(rfqData.items.map((item) => [item.id, item.quantity])));
        setIncludedItems(Object.fromEntries(rfqData.items.map((item) => [item.id, true])));
        setOrganizationId((current) => suppliers.some((item) => item.id === current) ? current : suppliers[0]?.id ?? '');
      })
      .catch((reason: unknown) => { if (active) setMessage(reason instanceof Error ? reason.message : 'دریافت اطلاعات انجام نشد.'); });
    return () => { active = false; };
  }, [rfqId]);

  useEffect(() => {
    if (!organizationId || !rfq) return;
    let active = true;
    void Promise.all([
      apiRequest<SupplierQuotation[]>(`/quotations/mine?organizationId=${encodeURIComponent(organizationId)}`),
      apiRequest(`/rfqs/${rfqId}/invitations/view`, { method: 'POST', body: JSON.stringify({ supplierOrganizationId: organizationId }) }),
    ])
      .then(([quotations]) => {
        if (!active) return;
        const draft = quotations.find((quotation) => quotation.rfq.id === rfqId && quotation.status === 'DRAFT') ?? null;
        setCreated(draft); setDraftDirty(false);
        if (!draft) {
          setPrices({}); setQuantities(Object.fromEntries(rfq.items.map((item) => [item.id, item.quantity])));
          setLineDiscounts({}); setIncludedItems(Object.fromEntries(rfq.items.map((item) => [item.id, true])));
          setAlternatives({}); setOfferedDescriptions({}); setAttachments([]); setMessage('');
          return;
        }
        setPrices(Object.fromEntries(draft.items.map((item) => [item.rfqItemId, fromRial(item.unitPriceRial)])));
        setQuantities(Object.fromEntries(draft.items.map((item) => [item.rfqItemId, item.quantity])));
        setLineDiscounts(Object.fromEntries(draft.items.map((item) => [item.rfqItemId, fromRial(item.discountRial)])));
        setIncludedItems(Object.fromEntries(rfq.items.map((item) => [item.id, draft.items.some((line) => line.rfqItemId === item.id)])));
        setAlternatives(Object.fromEntries(draft.items.map((item) => [item.rfqItemId, item.isAlternative])));
        setOfferedDescriptions(Object.fromEntries(draft.items.map((item) => [item.rfqItemId, item.offeredDescription ?? ''])));
        setShippingToman(fromRial(draft.shippingRial)); setPackagingToman(fromRial(draft.packagingRial));
        setLoadingToman(fromRial(draft.loadingRial)); setOtherCostsToman(fromRial(draft.otherCostsRial));
        setDiscountToman(fromRial(draft.discountRial)); setTaxToman(fromRial(draft.taxRial));
        setPaymentTerms(draft.paymentTerms ?? ''); setPreparationDays(String(draft.preparationDays ?? 0));
        setDeliveryDate(datePart(draft.deliveryDate)); setValidUntil(datePart(draft.validUntil) || dateAfterDays(7));
        setMessage('پیش‌نویس ذخیره‌شده بازیابی شد و قابل ویرایش است.');
      })
      .catch((reason: unknown) => { if (active) setMessage(reason instanceof Error ? reason.message : 'بررسی پیش‌نویس قبلی انجام نشد.'); });
    return () => { active = false; };
  }, [organizationId, rfq, rfqId]);

  useEffect(() => {
    if (!created?.id || created.status !== 'DRAFT') return;
    let active = true;
    void apiRequest<Attachment[]>(`/attachments/quotations/${created.id}`)
      .then((data) => { if (active) setAttachments(data); })
      .catch((reason: unknown) => { if (active) setMessage(reason instanceof Error ? reason.message : 'دریافت پیوست‌های پیشنهاد انجام نشد.'); });
    return () => { active = false; };
  }, [created?.id, created?.status]);

  const estimatedTotalToman = useMemo(() => {
    if (!rfq) return 0;
    const lines = rfq.items.reduce((sum, item) => includedItems[item.id]
      ? sum + Number(prices[item.id] || '0') * Number(quantities[item.id] || '0') - Number(lineDiscounts[item.id] || '0')
      : sum, 0);
    return lines - Number(discountToman || '0') + Number(shippingToman || '0') + Number(packagingToman || '0')
      + Number(loadingToman || '0') + Number(otherCostsToman || '0') + Number(taxToman || '0');
  }, [discountToman, includedItems, lineDiscounts, loadingToman, otherCostsToman, packagingToman, prices, quantities, rfq, shippingToman, taxToman]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rfq) return;
    setBusy(true); setMessage('');
    try {
      const items = rfq.items.filter((item) => includedItems[item.id]).map((item) => ({
        rfqItemId: item.id,
        quantity: quantities[item.id] || item.quantity,
        unitPriceRial: toRial(prices[item.id] || '0'),
        discountRial: toRial(lineDiscounts[item.id] || '0'),
        isAlternative: alternatives[item.id] ?? false,
        offeredDescription: offeredDescriptions[item.id] || undefined,
      }));
      if (items.length === 0) throw new Error('حداقل یک ردیف استعلام را برای پیشنهاد انتخاب کنید.');
      const payload = {
        rfqId,
        supplierOrganizationId: organizationId,
        paymentTerms: paymentTerms || undefined,
        preparationDays: Number(preparationDays),
        deliveryDate: deliveryDate ? new Date(`${deliveryDate}T12:00:00`).toISOString() : undefined,
        validUntil: new Date(`${validUntil}T23:59:59`).toISOString(),
        discountRial: toRial(discountToman), taxRial: toRial(taxToman), packagingRial: toRial(packagingToman),
        loadingRial: toRial(loadingToman), shippingRial: toRial(shippingToman), otherCostsRial: toRial(otherCostsToman),
        items,
        ...(created ? { expectedUpdatedAt: created.updatedAt } : {}),
      };
      const quotation = await apiRequest<CreatedQuotation>(created ? `/quotations/${created.id}` : '/quotations', {
        method: created ? 'PUT' : 'POST', body: JSON.stringify(payload),
      });
      setCreated(quotation); setDraftDirty(false); setMessage('پیش‌نویس پیشنهاد ذخیره شد. پس از بازبینی، آن را ارسال کنید.');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'ذخیره پیشنهاد انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!created) return;
    setBusy(true); setMessage('');
    try {
      const quotation = await apiRequest<CreatedQuotation>(`/quotations/${created.id}/submit`, { method: 'POST' });
      setCreated(quotation); setDraftDirty(false); setMessage('پیشنهاد قیمت با موفقیت ارسال شد و اعتبار آن از کیف پول کسر شد.');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'ارسال پیشنهاد انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function uploadAttachment() {
    if (!created || !selectedFile) return;
    setBusy(true); setMessage('');
    try {
      const purpose = selectedFile.type.startsWith('image/') ? 'PRODUCT_IMAGE' : selectedFile.type === 'application/pdf' ? 'PROFORMA' : 'SPECIFICATION';
      const intent = await apiRequest<UploadIntent>(`/attachments/quotations/${created.id}/upload-intent`, {
        method: 'POST', body: JSON.stringify({ fileName: selectedFile.name, mimeType: selectedFile.type, sizeBytes: selectedFile.size, purpose }),
      });
      const upload = await fetch(intent.upload.url, { method: intent.upload.method, headers: intent.upload.headers, body: selectedFile });
      if (!upload.ok) throw new Error('ارسال فایل به فضای ذخیره‌سازی انجام نشد.');
      const completed = await apiRequest<Attachment>(`/attachments/${intent.attachment.id}/complete`, { method: 'POST' });
      setAttachments((current) => [...current, completed]); setSelectedFile(null); setMessage('پیوست پیشنهاد با موفقیت ثبت شد.');
    } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : 'بارگذاری پیوست انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function removeAttachment(attachmentId: string) {
    setBusy(true); setMessage('');
    try {
      await apiRequest(`/attachments/${attachmentId}`, { method: 'DELETE' });
      setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
    } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : 'حذف پیوست انجام نشد.'); }
    finally { setBusy(false); }
  }

  if (!rfq) return <div className="card">{message || 'در حال دریافت استعلام…'}</div>;
  return <form className="card form-grid" onSubmit={save} onChangeCapture={(event) => {
    if (created?.status === 'DRAFT' && (!(event.target instanceof HTMLInputElement) || event.target.type !== 'file')) setDraftDirty(true);
  }}>
    {message && <div className={`message ${created?.status === 'SUBMITTED' ? 'message-success' : ''}`}>{message}</div>}
    <div className="full"><div className="eyebrow">{rfq.code}</div><h2>{rfq.title}</h2>{rfq.description && <p>{rfq.description}</p>}<div className="specification-summary"><span>تحویل: {rfq.deliveryProvince ?? 'نامشخص'}، {rfq.deliveryCity ?? 'نامشخص'}</span><span>مهلت پاسخ: {rfq.responseDeadline ? new Date(rfq.responseDeadline).toLocaleString('fa-IR') : 'تعیین نشده'}</span><span>زمان موردنیاز: {rfq.requiredAt ? new Date(rfq.requiredAt).toLocaleString('fa-IR') : 'تعیین نشده'}</span><span>نصب: {rfq.installationRequired ? 'موردنیاز است' : 'موردنیاز نیست'}</span></div></div>
    <label className="form-field"><span>حساب فروشنده</span><select value={organizationId} disabled={Boolean(created)} onChange={(event) => setOrganizationId(event.target.value)} required>{organizations.map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.status}</option>)}</select></label>
    <label className="form-field"><span>مدت آماده‌سازی (روز)</span><input type="number" min="0" value={preparationDays} onChange={(event) => setPreparationDays(event.target.value)} required /></label>
    <label className="form-field"><span>تاریخ تحویل (اختیاری)</span><input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></label>
    <label className="form-field"><span>اعتبار پیشنهاد تا</span><input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} required /></label>
    <label className="form-field full"><span>شرایط پرداخت (اختیاری)</span><textarea value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} maxLength={1000} rows={3} placeholder="مثلاً ۳۰٪ پیش‌پرداخت و تسویه پیش از بارگیری" /></label>
    <fieldset className="fieldset full"><legend>اقلام پیشنهادی — تومان، بدون مالیات</legend>{rfq.items.map((item) => {
      const details = formatProductSpecifications(item.specifications, item.category.attributeBindings);
      const included = includedItems[item.id] ?? false;
      return <div className="quote-line" key={item.id}><div><label className="check-field"><input type="checkbox" checked={included} onChange={(event) => setIncludedItems((current) => ({ ...current, [item.id]: event.target.checked }))} /><span><strong>{item.category.nameFa}</strong> — ارائه پیشنهاد برای این ردیف</span></label><span>{item.title} · درخواست: {item.quantity} {item.unit.symbolFa}</span>{details.length > 0 && <div className="specification-summary">{details.map((detail) => <span key={detail.code}>{detail.label}: {detail.value}</span>)}</div>}</div>{included && <div className="form-columns"><label className="form-field"><span>مقدار قابل تأمین</span><input type="number" min="0.0001" max={item.quantity} step="0.0001" value={quantities[item.id] ?? item.quantity} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} required /></label><label className="form-field"><span>قیمت هر واحد (تومان)</span><input inputMode="numeric" pattern="\d+" value={prices[item.id] ?? ''} onChange={(event) => setPrices((current) => ({ ...current, [item.id]: event.target.value }))} required /></label><label className="form-field"><span>تخفیف این ردیف (تومان)</span><input inputMode="numeric" pattern="\d+" value={lineDiscounts[item.id] ?? '0'} onChange={(event) => setLineDiscounts((current) => ({ ...current, [item.id]: event.target.value }))} /></label><label className="check-field"><input type="checkbox" checked={alternatives[item.id] ?? false} onChange={(event) => setAlternatives((current) => ({ ...current, [item.id]: event.target.checked }))} /><span>محصول جایگزین پیشنهاد می‌شود</span></label><label className="form-field full"><span>شرح محصول پیشنهادی (اختیاری)</span><input value={offeredDescriptions[item.id] ?? ''} maxLength={500} onChange={(event) => setOfferedDescriptions((current) => ({ ...current, [item.id]: event.target.value }))} /></label></div>}</div>;
    })}</fieldset>
    <label className="form-field"><span>تخفیف کل (تومان)</span><input inputMode="numeric" pattern="\d+" value={discountToman} onChange={(event) => setDiscountToman(event.target.value)} /></label>
    <label className="form-field"><span>بسته‌بندی (تومان)</span><input inputMode="numeric" pattern="\d+" value={packagingToman} onChange={(event) => setPackagingToman(event.target.value)} /></label>
    <label className="form-field"><span>بارگیری (تومان)</span><input inputMode="numeric" pattern="\d+" value={loadingToman} onChange={(event) => setLoadingToman(event.target.value)} /></label>
    <label className="form-field"><span>حمل (تومان)</span><input inputMode="numeric" pattern="\d+" value={shippingToman} onChange={(event) => setShippingToman(event.target.value)} /></label>
    <label className="form-field"><span>سایر هزینه‌های شفاف (تومان)</span><input inputMode="numeric" pattern="\d+" value={otherCostsToman} onChange={(event) => setOtherCostsToman(event.target.value)} /></label>
    <label className="form-field"><span>مالیات، جداگانه (تومان)</span><input inputMode="numeric" pattern="\d+" value={taxToman} onChange={(event) => setTaxToman(event.target.value)} /></label>
    <div className="card summary-card"><span>جمع برآوردی</span><strong>{Math.max(0, estimatedTotalToman).toLocaleString('fa-IR')} تومان</strong><small>{feePolicy ? `هزینه ارسال پیشنهاد براساس سیاست ${feePolicy.version}: ${(Number(feePolicy.rate) * 100).toLocaleString('fa-IR')}٪ مبلغ، حداقل ${feePolicy.minToman.toLocaleString('fa-IR')} و حداکثر ${feePolicy.maxToman.toLocaleString('fa-IR')} تومان.` : 'هزینه ارسال پیشنهاد هنگام ارسال نهایی محاسبه می‌شود.'}</small></div>
    {created?.status === 'DRAFT' && <fieldset className="fieldset full"><legend>پیش‌فاکتور، تصویر نمونه یا مشخصات فنی</legend><p className="muted">PDF، تصویر، Word یا Excel تا حداکثر ۲۰ مگابایت؛ فایل پیش از نمایش به خریدار بررسی امنیتی می‌شود.</p><div className="attachment-upload-row"><input aria-label="انتخاب پیوست پیشنهاد" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.docx" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} /><button className="button button-secondary" type="button" disabled={busy || !selectedFile} onClick={() => void uploadAttachment()}>بارگذاری فایل</button></div>{attachments.length > 0 && <div className="stack">{attachments.map((attachment) => <div className="list-card" key={attachment.id}><span>{attachment.originalName} · {attachmentStatusLabel(attachment.status)}</span><button className="button button-ghost" type="button" disabled={busy} onClick={() => void removeAttachment(attachment.id)}>حذف</button></div>)}</div>}</fieldset>}
    {created?.status !== 'SUBMITTED' && <button className="button button-secondary" disabled={busy || !organizationId}>{busy ? 'در حال ذخیره…' : created ? 'ذخیره تغییرات پیش‌نویس' : 'ذخیره پیش‌نویس'}</button>}
    {created?.status === 'DRAFT' && <button type="button" className="button button-primary" disabled={busy || draftDirty} onClick={() => void submit()}>{draftDirty ? 'ابتدا تغییرات را ذخیره کنید' : busy ? 'در حال ارسال…' : 'ارسال نهایی پیشنهاد'}</button>}
    {created?.status === 'SUBMITTED' && <Link className="button button-secondary" href="/supplier">بازگشت به فرصت‌های فروش</Link>}
  </form>;
}

function attachmentStatusLabel(status: string): string {
  if (status === 'READY') return 'آماده نمایش';
  if (status === 'QUARANTINED') return 'قرنطینه‌شده';
  if (status === 'REJECTED') return 'ردشده';
  return 'در انتظار بررسی امنیتی';
}
