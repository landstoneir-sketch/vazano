'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/api';
import { formatProductSpecifications, type ProductAttributeBinding, type ProductSpecifications } from '../../../../lib/product-specifications';
import { displayedQuotationAmountRial } from '../../../../lib/quotation-display';

type RfqItem = { id: string; title: string; quantity: string; specifications: ProductSpecifications; category: { nameFa: string; attributeBindings: ProductAttributeBinding[] }; unit: { symbolFa: string } };
type QualityControlRequest = { status: string; purchaseAmountRial: string | null; feeBps: number; feeAmountRial: string | null; acceptedAt: string | null; paymentReceipt: null | { id: string; receiptNumber: string; providerReference: string | null; paidAt: string } };
type PaymentReceiptSummary = { id: string; receiptNumber: string; providerReference: string | null; paidAt: string };
type ContractRequest = { id: string; code: string; status: 'REQUESTED' | 'UNDER_REVIEW' | 'TERMS_PREPARED' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED'; termsSummary: string | null; cancellationReason: string | null; acceptedAt: string | null };
type Rfq = { id: string; code: string; title: string; description: string | null; lifecycleState: string; operationalStatus: string; commitmentStatus: string; commitmentAmountRial: string | null; commitmentReceipt: PaymentReceiptSummary | null; deliveryProvince: string | null; deliveryCity: string | null; requiredAt: string | null; responseDeadline: string | null; installationRequired: boolean; displayPricesTaxInclusive: boolean; qualityControlRequested: boolean; qualityControlRequest: QualityControlRequest | null; contractRequest: ContractRequest | null; items: RfqItem[] };
type QuotationItem = { id: string; quantity: string; unitPriceRial: string; lineNetRial: string; isAlternative: boolean; offeredDescription: string | null; rfqItem: RfqItem };
type Quotation = { id: string; code: string; status: string; finalAmountRial: string; subtotalRial: string; discountRial: string; taxRial: string; packagingRial: string; loadingRial: string; shippingRial: string; otherCostsRial: string; paymentTerms: string | null; preparationDays: number | null; deliveryDate: string | null; validUntil: string | null; supplierOrganization: { id: string; displayName: string; province: string | null; city: string | null }; items: QuotationItem[] };
type Attachment = { id: string; originalName: string; status: string; sizeBytes: number };
type CheckoutResult = { paymentIntentId: string; authority?: string; redirectUrl: string; alreadyPaid?: boolean };
type SupplierReview = { id: string; rating: number; comment: string | null; status: 'PUBLISHED' | 'HIDDEN'; moderationReason: string | null; createdAt: string };

function toman(value: string | bigint) { return `${(BigInt(value) / BigInt(10)).toLocaleString('fa-IR')} تومان`; }

const contractStatusLabels: Record<ContractRequest['status'], string> = {
  REQUESTED: 'ثبت‌شده', UNDER_REVIEW: 'در حال بررسی', TERMS_PREPARED: 'شرایط آماده تأیید', ACCEPTED: 'تأییدشده', COMPLETED: 'تکمیل‌شده', CANCELLED: 'لغوشده',
};

export function RfqDetail({ rfqId, qualityPaymentResult, qualityReceiptId, commitmentPaymentResult, commitmentReceiptId }: { rfqId: string; qualityPaymentResult?: string; qualityReceiptId?: string; commitmentPaymentResult?: string; commitmentReceiptId?: string }) {
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [quotationAttachments, setQuotationAttachments] = useState<Record<string, Attachment[]>>({});
  const [review, setReview] = useState<SupplierReview | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      const [data, reviewData] = await Promise.all([
        apiRequest<{ rfq: Rfq; quotations: Quotation[] }>(`/quotations/rfqs/${rfqId}/comparison`),
        apiRequest<SupplierReview | null>(`/reviews/rfqs/${rfqId}`),
      ]);
      const attachmentEntries = await Promise.all(data.quotations.map(async (quotation) => [quotation.id, await apiRequest<Attachment[]>(`/attachments/quotations/${quotation.id}`)] as const));
      setRfq(data.rfq); setQuotations(data.quotations); setQuotationAttachments(Object.fromEntries(attachmentEntries)); setReview(reviewData);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'دریافت اطلاعات انجام نشد.'); }
  }, [rfqId]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<{ rfq: Rfq; quotations: Quotation[] }>(`/quotations/rfqs/${rfqId}/comparison`),
      apiRequest<Attachment[]>(`/attachments/rfqs/${rfqId}`),
      apiRequest<SupplierReview | null>(`/reviews/rfqs/${rfqId}`),
    ])
      .then(async ([data, attachmentData, reviewData]) => {
        const quoteAttachmentEntries = await Promise.all(data.quotations.map(async (quotation) => [quotation.id, await apiRequest<Attachment[]>(`/attachments/quotations/${quotation.id}`)] as const));
        if (active) { setRfq(data.rfq); setQuotations(data.quotations); setAttachments(attachmentData); setQuotationAttachments(Object.fromEntries(quoteAttachmentEntries)); setReview(reviewData); }
      })
      .catch((reason: unknown) => { if (active) setMessage(reason instanceof Error ? reason.message : 'دریافت اطلاعات انجام نشد.'); });
    return () => { active = false; };
  }, [rfqId]);

  useEffect(() => {
    if (!qualityPaymentResult || qualityPaymentResult === 'processing') return;
    sessionStorage.removeItem(`vazano:quality-control-checkout:${rfqId}`);
  }, [qualityPaymentResult, rfqId]);

  useEffect(() => {
    if (!commitmentPaymentResult || commitmentPaymentResult === 'processing') return;
    sessionStorage.removeItem(`vazano:buyer-commitment-checkout:${rfqId}`);
  }, [commitmentPaymentResult, rfqId]);

  async function accept(id: string) {
    if (!window.confirm('انتخاب این فروشنده را تأیید می‌کنید؟')) return;
    setBusyId(id); setMessage('');
    try { await apiRequest(`/quotations/${id}/accept`, { method: 'POST' }); setMessage('فروشنده منتخب ثبت شد.'); await load(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'ثبت انتخاب انجام نشد.'); }
    finally { setBusyId(''); }
  }

  async function payQualityControl() {
    if (!window.confirm('برای پرداخت کارمزد نمایش‌داده‌شده به درگاه امن زرین‌پال منتقل می‌شوید. ادامه می‌دهید؟')) return;
    setBusyId('quality-control'); setMessage('');
    try {
      const storageKey = `vazano:quality-control-checkout:${rfqId}`;
      let idempotencyKey = sessionStorage.getItem(storageKey);
      if (!idempotencyKey) {
        idempotencyKey = `quality-control:${rfqId}:${crypto.randomUUID()}`;
        sessionStorage.setItem(storageKey, idempotencyKey);
      }
      const result = await apiRequest<CheckoutResult>(`/quality-control/rfqs/${rfqId}/checkout`, { method: 'POST', body: JSON.stringify({ idempotencyKey }) });
      window.location.assign(result.redirectUrl);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'شروع پرداخت کنترل کیفیت انجام نشد.'); setBusyId(''); }
  }

  async function payBuyerCommitment() {
    if (!window.confirm('برای پرداخت مبلغ تعهد استعلام به درگاه امن زرین‌پال منتقل می‌شوید. ادامه می‌دهید؟')) return;
    setBusyId('buyer-commitment'); setMessage('');
    try {
      const storageKey = `vazano:buyer-commitment-checkout:${rfqId}`;
      let idempotencyKey = sessionStorage.getItem(storageKey);
      if (!idempotencyKey) {
        idempotencyKey = `buyer-commitment:${rfqId}:${crypto.randomUUID()}`;
        sessionStorage.setItem(storageKey, idempotencyKey);
      }
      const result = await apiRequest<CheckoutResult>(`/rfqs/${rfqId}/commitment/payment`, { method: 'POST', body: JSON.stringify({ idempotencyKey }) });
      window.location.assign(result.redirectUrl);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'شروع پرداخت تعهد انجام نشد.'); setBusyId(''); }
  }

  async function requestContract() {
    if (!window.confirm('درخواست هماهنگی قرارداد برای پیشنهاد منتخب ثبت شود؟')) return;
    setBusyId('contract'); setMessage('');
    try {
      await apiRequest(`/contracts/rfqs/${rfqId}`, { method: 'POST', body: JSON.stringify({}) });
      setMessage('درخواست هماهنگی قرارداد ثبت شد.'); await load();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'ثبت درخواست قرارداد انجام نشد.'); }
    finally { setBusyId(''); }
  }

  async function submitReview() {
    if (!window.confirm('این امتیاز پس از ثبت به‌عنوان تجربه خرید معتبر منتشر می‌شود. ادامه می‌دهید؟')) return;
    setBusyId('review'); setMessage('');
    try {
      const created = await apiRequest<SupplierReview>(`/reviews/rfqs/${rfqId}`, {
        method: 'POST', body: JSON.stringify({ rating: reviewRating, ...(reviewComment.trim() ? { comment: reviewComment.trim() } : {}) }),
      });
      setReview(created); setMessage('امتیاز شما برای فروشنده ثبت شد.');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'ثبت امتیاز انجام نشد.'); }
    finally { setBusyId(''); }
  }

  async function acceptContractTerms() {
    if (!window.confirm('شرایط خلاصه‌شده را بررسی کرده‌اید و تأیید می‌کنید؟')) return;
    setBusyId('contract-terms'); setMessage('');
    try {
      await apiRequest(`/contracts/rfqs/${rfqId}/accept-terms`, { method: 'POST' });
      setMessage('تأیید شرایط قرارداد ثبت شد.'); await load();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'تأیید شرایط قرارداد انجام نشد.'); }
    finally { setBusyId(''); }
  }

  async function downloadAttachment(id: string) {
    try {
      const data = await apiRequest<{ url: string }>(`/attachments/${id}/download-url`);
      window.location.assign(data.url);
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'دریافت فایل انجام نشد.');
    }
  }

  async function cancelRfq() {
    const reason = window.prompt('دلیل لغو استعلام را وارد کنید. اگر پیشنهادی ثبت شده باشد، اعتبار مصرف‌شده فروشنده به‌طور کامل بازمی‌گردد.')?.trim();
    if (!reason) return;
    if (reason.length < 5) { setMessage('دلیل لغو باید حداقل ۵ نویسه باشد.'); return; }
    setBusyId('cancel-rfq'); setMessage('');
    try {
      const result = await apiRequest<{ refundedCredits: string }>(`/rfqs/${rfqId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
      const refund = BigInt(result.refundedCredits);
      setMessage(refund > BigInt(0) ? `استعلام لغو شد و ${refund.toLocaleString('fa-IR')} اعتبار به فروشندگان بازگشت.` : 'استعلام لغو شد.');
      await load();
    }
    catch (reasonValue: unknown) { setMessage(reasonValue instanceof Error ? reasonValue.message : 'لغو استعلام انجام نشد.'); }
    finally { setBusyId(''); }
  }

  if (!rfq) return <div className="card">{message || 'در حال دریافت اطلاعات…'}</div>;
  return <div className="stack">
    <div><div className="eyebrow">{rfq.code}</div><h1>{rfq.title}</h1><p className="muted">{rfq.deliveryProvince ?? 'استان نامشخص'}، {rfq.deliveryCity ?? 'شهر نامشخص'} · {rfq.operationalStatus}</p>{['DRAFT', 'SUBMITTED', 'PUBLISHED'].includes(rfq.lifecycleState) && !['PAYMENT_PENDING', 'HELD', 'REFUND_PENDING'].includes(rfq.commitmentStatus) && <button className="button button-danger" type="button" disabled={busyId === 'cancel-rfq'} onClick={() => void cancelRfq()}>{busyId === 'cancel-rfq' ? 'در حال لغو…' : 'لغو استعلام'}</button>}</div>
    {qualityPaymentResult === 'success' && <div className="message message-success">پرداخت کنترل کیفیت تأیید شد و درخواست وارد صف عملیات وازانو شده است.{qualityReceiptId && <> <Link href={`/dashboard/receipts/${qualityReceiptId}` as Route}>مشاهده رسید</Link></>}</div>}
    {qualityPaymentResult === 'cancelled' && <div className="message message-error">پرداخت کنترل کیفیت لغو شد و درخواست هنوز فعال نشده است.</div>}
    {qualityPaymentResult === 'failed' && <div className="message message-error">تأیید پرداخت کنترل کیفیت انجام نشد. در صورت کسر وجه، شماره پیگیری را برای پشتیبانی ارسال کنید.</div>}
    {qualityPaymentResult === 'processing' && <div className="message">نتیجه پرداخت کنترل کیفیت در حال پردازش است؛ چند لحظه بعد وضعیت صفحه را بررسی کنید.</div>}
    {commitmentPaymentResult === 'success' && <div className="message message-success">پرداخت تعهد خریدار تأیید شد. استعلام اکنون آماده انتشار توسط وازانو است.{commitmentReceiptId && <> <Link href={`/dashboard/receipts/${commitmentReceiptId}` as Route}>مشاهده رسید</Link></>}</div>}
    {commitmentPaymentResult === 'cancelled' && <div className="message message-error">پرداخت تعهد لغو شد؛ می‌توانید با یک تلاش تازه دوباره اقدام کنید.</div>}
    {commitmentPaymentResult === 'failed' && <div className="message message-error">تأیید پرداخت تعهد انجام نشد. در صورت کسر وجه، شماره پیگیری را برای پشتیبانی ارسال کنید.</div>}
    {commitmentPaymentResult === 'processing' && <div className="message">نتیجه پرداخت در حال پردازش است؛ چند لحظه بعد وضعیت صفحه را بررسی کنید.</div>}
    {message && <div className="message message-success">{message}</div>}
    <article className="card"><h2>شرایط و برنامه زمانی</h2>{rfq.description && <p>{rfq.description}</p>}<div className="specification-summary"><span>محل تحویل: {rfq.deliveryProvince ?? 'نامشخص'}، {rfq.deliveryCity ?? 'نامشخص'}</span><span>مهلت پیشنهاد: {rfq.responseDeadline ? new Date(rfq.responseDeadline).toLocaleString('fa-IR') : 'تعیین نشده'}</span><span>زمان موردنیاز: {rfq.requiredAt ? new Date(rfq.requiredAt).toLocaleString('fa-IR') : 'تعیین نشده'}</span><span>نصب: {rfq.installationRequired ? 'موردنیاز است' : 'موردنیاز نیست'}</span></div></article>
    <article className="card"><h2>اقلام درخواستی</h2><ul>{rfq.items.map((item) => {
      const details = formatProductSpecifications(item.specifications, item.category.attributeBindings);
      return <li key={item.id}>{item.category.nameFa} — {item.title} — {item.quantity} {item.unit.symbolFa}{details.length > 0 && <div className="specification-summary">{details.map((detail) => <span key={detail.code}>{detail.label}: {detail.value}</span>)}</div>}</li>;
    })}</ul></article>
    {rfq.commitmentStatus !== 'NOT_REQUIRED' && <article className="card stack"><div><h2>تعهد خریدار</h2><p className="muted">این مبلغ برای تکمیل گیت انتشار استعلام ثبت می‌شود و وضعیت آن در سوابق مالی قابل پیگیری است.</p></div>{rfq.commitmentAmountRial && <p className="price">مبلغ تعهد: {toman(rfq.commitmentAmountRial)}</p>}{rfq.commitmentStatus === 'REQUIRED' && <button className="button button-primary" type="button" disabled={busyId === 'buyer-commitment'} onClick={() => void payBuyerCommitment()}>{busyId === 'buyer-commitment' ? 'در حال اتصال به زرین‌پال…' : 'پرداخت تعهد و ادامه فرایند'}</button>}{rfq.commitmentStatus === 'PAYMENT_PENDING' && <div className="message">پرداخت ایجاد شده و در انتظار تأیید درگاه است.</div>}{rfq.commitmentStatus === 'HELD' && <div className="message message-success">تعهد پرداخت و تأیید شده است.</div>}{rfq.commitmentReceipt && <div className="list-card"><span>رسید: <strong>{rfq.commitmentReceipt.receiptNumber}</strong>{rfq.commitmentReceipt.providerReference ? ` · پیگیری درگاه: ${rfq.commitmentReceipt.providerReference}` : ''}</span><Link className="button button-secondary" href={`/dashboard/receipts/${rfq.commitmentReceipt.id}` as Route}>مشاهده و چاپ</Link></div>}</article>}
    <article className="card"><h2>پیوست‌ها</h2>
      {attachments.length === 0 && <p>فایلی به این استعلام پیوست نشده است.</p>}
      <div className="stack">{attachments.map((attachment) => <div className="list-card" key={attachment.id}>
        <span>{attachment.originalName} · {(attachment.sizeBytes / 1024 / 1024).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} مگابایت</span>
        {attachment.status === 'READY' ? <button type="button" className="button button-secondary" onClick={() => void downloadAttachment(attachment.id)}>دریافت امن</button> : <span className="muted">{attachmentStatusLabel(attachment.status)}</span>}
      </div>)}</div>
    </article>
    {rfq.qualityControlRequested && <article className="card"><h2>کنترل کیفیت توسط وازانو</h2>
      {rfq.qualityControlRequest?.status === 'REQUESTED' && <p>درخواست ثبت شده است؛ مبلغ خدمت پس از انتخاب فروشنده محاسبه می‌شود.</p>}
      {rfq.qualityControlRequest?.purchaseAmountRial && <p>مبلغ خرید: <strong>{toman(rfq.qualityControlRequest.purchaseAmountRial)}</strong> · نرخ خدمت: {(rfq.qualityControlRequest.feeBps / 100).toLocaleString('fa-IR')}٪</p>}
      {rfq.qualityControlRequest?.feeAmountRial && <p className="price">کارمزد کنترل کیفیت: {toman(rfq.qualityControlRequest.feeAmountRial)}</p>}
      {rfq.qualityControlRequest?.status === 'QUOTED' && <button className="button button-primary" type="button" disabled={busyId === 'quality-control'} onClick={() => void payQualityControl()}>{busyId === 'quality-control' ? 'در حال اتصال به زرین‌پال…' : 'پرداخت کارمزد و فعال‌سازی خدمت'}</button>}
      {['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(rfq.qualityControlRequest?.status ?? '') && <div className="message message-success">هزینه خدمت پرداخت و درخواست کنترل کیفیت فعال شده است.</div>}
      {rfq.qualityControlRequest?.paymentReceipt && <div className="list-card"><span>رسید: <strong>{rfq.qualityControlRequest.paymentReceipt.receiptNumber}</strong>{rfq.qualityControlRequest.paymentReceipt.providerReference ? ` · پیگیری درگاه: ${rfq.qualityControlRequest.paymentReceipt.providerReference}` : ''}</span><Link className="button button-secondary" href={`/dashboard/receipts/${rfq.qualityControlRequest.paymentReceipt.id}` as Route}>مشاهده و چاپ</Link></div>}
      <p className="muted">فعال‌سازی خدمت فقط پس از تأیید قطعی پرداخت توسط زرین‌پال انجام می‌شود.</p>
    </article>}
    {rfq.operationalStatus === 'SELLER_SELECTED' && <article className="card"><h2>هماهنگی قرارداد</h2>
      {!rfq.contractRequest && <><p>در صورت نیاز می‌توانید از وازانو بخواهید هماهنگی تهیه شرایط قرارداد با فروشنده منتخب را آغاز کند.</p><button className="button button-primary" type="button" disabled={busyId === 'contract'} onClick={() => void requestContract()}>درخواست قرارداد</button></>}
      {rfq.contractRequest && <><p>کد درخواست: <strong>{rfq.contractRequest.code}</strong> · وضعیت: <strong>{contractStatusLabels[rfq.contractRequest.status]}</strong></p>
        {rfq.contractRequest.termsSummary && <div className="message"><strong>خلاصه شرایط:</strong><br />{rfq.contractRequest.termsSummary}</div>}
        {rfq.contractRequest.status === 'TERMS_PREPARED' && <button className="button button-primary" type="button" disabled={busyId === 'contract-terms'} onClick={() => void acceptContractTerms()}>تأیید شرایط قرارداد</button>}
        {rfq.contractRequest.status === 'CANCELLED' && <p className="message message-error">دلیل لغو: {rfq.contractRequest.cancellationReason ?? 'ثبت نشده'}</p>}
      </>}
      <p className="muted">این بخش خدمت هماهنگی است و به‌تنهایی امضای الکترونیکی یا قرارداد حقوقی لازم‌الاجرا ایجاد نمی‌کند.</p>
    </article>}
    {rfq.operationalStatus === 'SELLER_SELECTED' && <article className="card stack"><div><h2>ارزیابی فروشنده منتخب</h2><p className="muted">هر خرید فقط یک ارزیابی معتبر دارد و امتیاز به پیشنهاد منتخب همین استعلام متصل می‌شود.</p></div>{review ? <div><div className="price" aria-label={`${review.rating} از ۵`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>{review.comment && <p>{review.comment}</p>}<p className="muted">ثبت‌شده در {new Date(review.createdAt).toLocaleDateString('fa-IR')}{review.status === 'HIDDEN' ? ' · توسط پشتیبانی پنهان شده است' : ' · منتشرشده'}</p>{review.status === 'HIDDEN' && review.moderationReason && <div className="message message-error">دلیل پنهان‌سازی: {review.moderationReason}</div>}</div> : <form className="form-grid" onSubmit={(event) => { event.preventDefault(); void submitReview(); }}><label className="form-field"><span>امتیاز کلی</span><select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}><option value={5}>۵ — عالی</option><option value={4}>۴ — خوب</option><option value={3}>۳ — متوسط</option><option value={2}>۲ — ضعیف</option><option value={1}>۱ — بسیار ضعیف</option></select></label><label className="form-field full"><span>توضیح تجربه خرید (اختیاری)</span><textarea minLength={3} maxLength={1000} rows={3} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} /></label><button className="button button-primary" disabled={busyId === 'review'}>{busyId === 'review' ? 'در حال ثبت…' : 'ثبت قطعی امتیاز'}</button></form>}</article>}
    <h2>مقایسه پیشنهادها</h2>
    {quotations.length === 0 && <div className="card">هنوز پیشنهاد قیمتی دریافت نشده است.</div>}
    <div className="comparison-grid">{quotations.map((quote) => <article className={`card quote-card ${quote.status === 'ACCEPTED' ? 'selected-card' : ''}`} key={quote.id}>
      <div className="eyebrow">{quote.code} · نسخه {quote.status}</div><h3>{quote.supplierOrganization.displayName}</h3>
      <strong className="price">{toman(displayedQuotationAmountRial(quote.finalAmountRial, quote.taxRial, rfq.displayPricesTaxInclusive))}</strong><p>پوشش پیشنهاد: {quote.items.length.toLocaleString('fa-IR')} از {rfq.items.length.toLocaleString('fa-IR')} ردیف{quote.items.length < rfq.items.length ? ' · پیشنهاد جزئی' : ' · کامل'}</p>
      <div className="specification-summary"><span>جمع اقلام: {toman(quote.subtotalRial)}</span><span>تخفیف کل: {toman(quote.discountRial)}</span><span>بسته‌بندی: {toman(quote.packagingRial)}</span><span>بارگیری: {toman(quote.loadingRial)}</span><span>حمل: {toman(quote.shippingRial)}</span><span>سایر هزینه‌ها: {toman(quote.otherCostsRial)}</span><span>مالیات: {toman(quote.taxRial)}{rfq.displayPricesTaxInclusive ? ' (در مبلغ اصلی)' : ' (جداگانه)'}</span></div>
      <p>آماده‌سازی: {quote.preparationDays ?? '—'} روز · تحویل: {quote.deliveryDate ? new Date(quote.deliveryDate).toLocaleDateString('fa-IR') : '—'} · اعتبار تا: {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('fa-IR') : '—'}</p>
      {quote.paymentTerms && <div className="message"><strong>شرایط پرداخت:</strong> {quote.paymentTerms}</div>}
      <ul>{quote.items.map((item) => <li key={item.id}><strong>{item.rfqItem.title}</strong>: {item.quantity} {item.rfqItem.unit.symbolFa} × {toman(item.unitPriceRial)} / واحد · جمع ردیف {toman(item.lineNetRial)}{item.isAlternative ? ' · محصول جایگزین' : ''}{item.offeredDescription ? ` · ${item.offeredDescription}` : ''}</li>)}</ul>
      {(quotationAttachments[quote.id]?.length ?? 0) > 0 && <div className="stack"><strong>پیوست‌های فروشنده</strong>{quotationAttachments[quote.id]!.map((attachment) => <div className="list-card" key={attachment.id}><span>{attachment.originalName}</span><button type="button" className="button button-secondary" onClick={() => void downloadAttachment(attachment.id)}>دریافت امن</button></div>)}</div>}
      <div className="list-card-actions"><Link className="button button-secondary" href={`/messages?rfq=${rfq.id}&supplier=${quote.supplierOrganization.id}` as Route}>پیام به فروشنده</Link>
      {quote.status === 'SUBMITTED' && <button className="button button-primary" disabled={busyId === quote.id} onClick={() => void accept(quote.id)}>انتخاب فروشنده</button>}</div>
      {quote.status === 'ACCEPTED' && <div className="message message-success">فروشنده منتخب</div>}
    </article>)}</div>
    <p className="muted">قیمت اصلی {rfq.displayPricesTaxInclusive ? 'با مالیات' : 'بدون مالیات'} نمایش داده می‌شود؛ مالیات و هزینه‌های جانبی به‌صورت شفاف آمده‌اند.</p>
  </div>;
}

function attachmentStatusLabel(status: string): string {
  if (status === 'QUARANTINED') return 'قرنطینه‌شده؛ امکان دریافت وجود ندارد';
  if (status === 'REJECTED') return 'ردشده';
  return 'در انتظار بررسی امنیتی';
}
