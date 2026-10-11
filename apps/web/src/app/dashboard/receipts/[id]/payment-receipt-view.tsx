'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Receipt = {
  id: string; receiptNumber: string; amountRial: string; taxRial: string; currency: string; paidAt: string; providerReference: string | null;
  organization: { displayName: string; legalName: string; nationalId: string | null };
  paymentIntent: { provider: string; purpose: string; providerReference: string | null };
  subscription: null | { plan: { code: string; nameFa: string; billingCycle: string } };
  qualityControlRequest: null | { rfq: { code: string; title: string } };
};

function toman(value: string): string {
  return `${(BigInt(value) / BigInt(10)).toLocaleString('fa-IR')} تومان`;
}

export function PaymentReceiptView({ receiptId }: { receiptId: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<Receipt>(`/payments/receipts/${receiptId}`).then((result) => { if (active) setReceipt(result); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت رسید انجام نشد.');
    });
    return () => { active = false; };
  }, [receiptId]);

  if (error) return <div className="message message-error">{error}</div>;
  if (!receipt) return <div className="card">در حال دریافت رسید پرداخت…</div>;
  const subject = receipt.subscription?.plan.nameFa ?? (receipt.qualityControlRequest ? `خدمت کنترل کیفیت استعلام ${receipt.qualityControlRequest.rfq.code}` : 'خدمت وازانو');

  return <div className="stack">
    <div className="receipt-actions"><button className="button button-primary" type="button" onClick={() => window.print()}>چاپ یا ذخیره PDF</button></div>
    <article className="card receipt-sheet">
      <div className="receipt-heading"><div><div className="eyebrow">رسید پرداخت وازانو</div><h1>{receipt.receiptNumber}</h1></div><span className="status-badge status-active">پرداخت‌شده</span></div>
      <div className="receipt-grid">
        <div><span>پرداخت‌کننده</span><strong>{receipt.organization.displayName || receipt.organization.legalName}</strong></div>
        <div><span>شناسه ملی</span><strong>{receipt.organization.nationalId ?? 'ثبت نشده'}</strong></div>
        <div><span>شرح</span><strong>{subject}</strong></div>
        <div><span>تاریخ پرداخت</span><strong>{new Date(receipt.paidAt).toLocaleString('fa-IR')}</strong></div>
        <div><span>مبلغ</span><strong>{toman(receipt.amountRial)}</strong></div>
        <div><span>مالیات</span><strong>{toman(receipt.taxRial)}</strong></div>
        <div><span>درگاه</span><strong>{receipt.paymentIntent.provider === 'ZARINPAL' ? 'زرین‌پال' : receipt.paymentIntent.provider}</strong></div>
        <div><span>شماره پیگیری درگاه</span><strong>{receipt.providerReference ?? receipt.paymentIntent.providerReference ?? '—'}</strong></div>
      </div>
      <p className="muted">مبالغ در سامانه با واحد ریال ذخیره و در این رسید به تومان نمایش داده شده‌اند. این رسید جایگزین صورتحساب رسمی مالیاتی نیست.</p>
    </article>
  </div>;
}
