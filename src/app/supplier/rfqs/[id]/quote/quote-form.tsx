'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../../../../lib/api';
import { formatProductSpecifications, type ProductAttributeBinding, type ProductSpecifications } from '../../../../../lib/product-specifications';

type Organization = { id: string; displayName: string; kind: string; status: string };
type RfqItem = { id: string; title: string; quantity: string; specifications: ProductSpecifications; category: { nameFa: string; attributeBindings: ProductAttributeBinding[] }; unit: { symbolFa: string } };
type Rfq = { id: string; code: string; title: string; responseDeadline: string | null; items: RfqItem[] };
type CreatedQuotation = { id: string; code: string; status: string; finalAmountRial: string };
type ProposalFeePolicy = { version: string; rate: string; minToman: number; maxToman: number; refundFractionIfEligible: string };

const toRial = (toman: string) => Math.round(Number(toman || '0') * 10).toString();
const dateAfterDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function QuoteForm({ rfqId, initialOrganizationId }: { rfqId: string; initialOrganizationId: string }) {
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState(initialOrganizationId);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [shippingToman, setShippingToman] = useState('0');
  const [packagingToman, setPackagingToman] = useState('0');
  const [taxToman, setTaxToman] = useState('0');
  const [preparationDays, setPreparationDays] = useState('7');
  const [validUntil, setValidUntil] = useState(dateAfterDays(7));
  const [created, setCreated] = useState<CreatedQuotation | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [feePolicy, setFeePolicy] = useState<ProposalFeePolicy | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([apiRequest<Rfq>(`/rfqs/${rfqId}`), apiRequest<Organization[]>('/organizations/mine'), apiRequest<ProposalFeePolicy>('/quotations/active-policy')])
      .then(([rfqData, orgData, policyData]) => {
        if (!active) return;
        const suppliers = orgData.filter((item) => item.kind === 'SUPPLIER');
        setRfq(rfqData); setOrganizations(suppliers); setFeePolicy(policyData);
        setOrganizationId((current) => suppliers.some((item) => item.id === current) ? current : suppliers[0]?.id ?? '');
      })
      .catch((reason: unknown) => { if (active) setMessage(reason instanceof Error ? reason.message : 'دریافت اطلاعات انجام نشد.'); });
    return () => { active = false; };
  }, [rfqId]);

  const estimatedTotalToman = useMemo(() => {
    if (!rfq) return 0;
    const lines = rfq.items.reduce((sum, item) => sum + Number(prices[item.id] || '0') * Number(item.quantity), 0);
    return lines + Number(shippingToman || '0') + Number(packagingToman || '0') + Number(taxToman || '0');
  }, [packagingToman, prices, rfq, shippingToman, taxToman]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rfq) return;
    setBusy(true); setMessage(''); setCreated(null);
    try {
      const quotation = await apiRequest<CreatedQuotation>('/quotations', {
        method: 'POST',
        body: JSON.stringify({
          rfqId,
          supplierOrganizationId: organizationId,
          preparationDays: Number(preparationDays),
          validUntil: new Date(`${validUntil}T20:29:59.000Z`).toISOString(),
          shippingRial: toRial(shippingToman),
          packagingRial: toRial(packagingToman),
          taxRial: toRial(taxToman),
          items: rfq.items.map((item) => ({ rfqItemId: item.id, quantity: item.quantity, unitPriceRial: toRial(prices[item.id] || '0') })),
        }),
      });
      setCreated(quotation); setMessage('پیش‌نویس پیشنهاد ذخیره شد. پس از بازبینی، آن را ارسال کنید.');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'ذخیره پیشنهاد انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!created) return;
    setBusy(true); setMessage('');
    try {
      const quotation = await apiRequest<CreatedQuotation>(`/quotations/${created.id}/submit`, { method: 'POST' });
      setCreated(quotation); setMessage('پیشنهاد قیمت با موفقیت ارسال شد و اعتبار آن از کیف پول کسر شد.');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'ارسال پیشنهاد انجام نشد.'); }
    finally { setBusy(false); }
  }

  if (!rfq) return <div className="card">{message || 'در حال دریافت استعلام…'}</div>;
  return <form className="card form-grid" onSubmit={create}>
    {message && <div className={`message ${created?.status === 'SUBMITTED' ? 'message-success' : ''}`}>{message}</div>}
    <div className="full"><div className="eyebrow">{rfq.code}</div><h2>{rfq.title}</h2></div>
    <label className="form-field"><span>حساب فروشنده</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} required>{organizations.map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.status}</option>)}</select></label>
    <label className="form-field"><span>مدت آماده‌سازی (روز)</span><input type="number" min="0" value={preparationDays} onChange={(event) => setPreparationDays(event.target.value)} required /></label>
    <label className="form-field"><span>اعتبار پیشنهاد تا</span><input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} required /></label>
    <fieldset className="fieldset full"><legend>قیمت اقلام — تومان، بدون مالیات</legend>{rfq.items.map((item) => {
      const details = formatProductSpecifications(item.specifications, item.category.attributeBindings);
      return <div className="quote-line" key={item.id}><div><strong>{item.category.nameFa}</strong><br /><span>{item.title} · {item.quantity} {item.unit.symbolFa}</span>{details.length > 0 && <div className="specification-summary">{details.map((detail) => <span key={detail.code}>{detail.label}: {detail.value}</span>)}</div>}</div><label className="form-field"><span>قیمت هر واحد (تومان)</span><input inputMode="numeric" pattern="\d+" value={prices[item.id] ?? ''} onChange={(event) => setPrices((current) => ({ ...current, [item.id]: event.target.value }))} required /></label></div>;
    })}</fieldset>
    <label className="form-field"><span>بسته‌بندی (تومان)</span><input inputMode="numeric" pattern="\d+" value={packagingToman} onChange={(event) => setPackagingToman(event.target.value)} /></label>
    <label className="form-field"><span>حمل (تومان)</span><input inputMode="numeric" pattern="\d+" value={shippingToman} onChange={(event) => setShippingToman(event.target.value)} /></label>
    <label className="form-field"><span>مالیات، جداگانه (تومان)</span><input inputMode="numeric" pattern="\d+" value={taxToman} onChange={(event) => setTaxToman(event.target.value)} /></label>
    <div className="card summary-card"><span>جمع برآوردی</span><strong>{estimatedTotalToman.toLocaleString('fa-IR')} تومان</strong><small>{feePolicy ? `هزینه ارسال پیشنهاد براساس سیاست ${feePolicy.version}: ${(Number(feePolicy.rate) * 100).toLocaleString('fa-IR')}٪ مبلغ، حداقل ${feePolicy.minToman.toLocaleString('fa-IR')} و حداکثر ${feePolicy.maxToman.toLocaleString('fa-IR')} تومان.` : 'هزینه ارسال پیشنهاد هنگام ارسال نهایی محاسبه می‌شود.'}</small></div>
    {!created && <button className="button button-primary" disabled={busy || !organizationId}>{busy ? 'در حال ذخیره…' : 'ذخیره پیش‌نویس'}</button>}
    {created?.status === 'DRAFT' && <button type="button" className="button button-primary" disabled={busy} onClick={() => void submit()}>{busy ? 'در حال ارسال…' : 'ارسال نهایی پیشنهاد'}</button>}
    {created?.status === 'SUBMITTED' && <Link className="button button-secondary" href="/supplier">بازگشت به فرصت‌های فروش</Link>}
  </form>;
}
