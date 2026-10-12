'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Invoice = {
  invoiceNumber: string; status: 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED'; netAmountRial: string; taxRial: string; totalAmountRial: string;
  currency: string; descriptionFa: string; issuedAt: string; dueAt: string | null; paidAt: string | null;
  organization: { displayName: string; legalName: string; nationalId: string | null; province: string | null; city: string | null };
  subscription: null | { startsAt: string | null; expiresAt: string | null; plan: { code: string; nameFa: string; billingCycle: string } };
  paymentIntent: null | { provider: string; providerReference: string | null; verifiedAt: string | null };
  manualRenewal: null | { trackingNumber: string; paidAt: string };
};

function toman(value: string): string { return `${(BigInt(value) / BigInt(10)).toLocaleString('fa-IR')} تومان`; }

export function BillingInvoiceView({ invoiceId }: { invoiceId: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void apiRequest<Invoice>(`/subscriptions/invoices/${invoiceId}`)
      .then((data) => { if (active) setInvoice(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت صورتحساب انجام نشد.'); });
    return () => { active = false; };
  }, [invoiceId]);
  if (error) return <div className="message message-error">{error}</div>;
  if (!invoice) return <div className="card">در حال دریافت صورتحساب…</div>;
  const trackingNumber = invoice.paymentIntent?.providerReference ?? invoice.manualRenewal?.trackingNumber;
  return <article className="card stack receipt-sheet"><div className="admin-card-title"><div><div className="eyebrow">صورتحساب خدمات وازانو</div><h1>{invoice.invoiceNumber}</h1><p>تاریخ صدور: {new Date(invoice.issuedAt).toLocaleString('fa-IR')}</p></div><span className={`status-badge ${invoice.status === 'PAID' ? 'status-active' : 'severity-medium'}`}>{invoice.status === 'PAID' ? 'پرداخت‌شده' : invoice.status === 'ISSUED' ? 'در انتظار پرداخت' : invoice.status === 'OVERDUE' ? 'سررسیدگذشته' : 'لغوشده'}</span></div><hr /><div className="dashboard-grid"><div><span className="muted">خریدار خدمت</span><h3>{invoice.organization.displayName || invoice.organization.legalName}</h3><p>{invoice.organization.nationalId ? `شناسه ملی: ${invoice.organization.nationalId}` : 'شخص حقیقی یا شناسه ثبت‌نشده'}</p></div><div><span className="muted">شرح</span><h3>{invoice.descriptionFa}</h3><p>{invoice.subscription?.plan.nameFa ?? 'خدمت وازانو'}</p></div></div><div className="card"><div className="list-card"><span>مبلغ خدمات</span><strong>{toman(invoice.netAmountRial)}</strong></div><div className="list-card"><span>مالیات</span><strong>{toman(invoice.taxRial)}</strong></div><div className="list-card"><span>جمع قابل پرداخت</span><strong className="price">{toman(invoice.totalAmountRial)}</strong></div></div>{invoice.subscription?.startsAt && <p>دوره خدمت: {new Date(invoice.subscription.startsAt).toLocaleDateString('fa-IR')} تا {invoice.subscription.expiresAt ? new Date(invoice.subscription.expiresAt).toLocaleDateString('fa-IR') : '—'}</p>}{trackingNumber && <p>شماره پیگیری پرداخت: <strong>{trackingNumber}</strong></p>}<div className="message">این سند صورتحساب خدمات وازانو است. مبلغ مالیات مطابق سیاست فعلی صفر ثبت شده و رسید تسویه درگاه، در صورت وجود، سندی مستقل است.</div><div className="actions no-print"><button className="button button-primary" type="button" onClick={() => window.print()}>چاپ صورتحساب</button><Link className="button button-secondary" href="/supplier/subscription">بازگشت به اشتراک</Link></div></article>;
}
