'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Organization = { id: string; kind: string; displayName: string; legalName: string; status: string; subscriptionTrialRedeemedAt: string | null; members: Array<{ role: string; status: string }> };
type Plan = { id: string; code: string; nameFa: string; descriptionFa: string | null; billingCycle: string; durationIso: string; priceRial: string; grantCredits: string; dailyProposalLimit: number; maxProposalLimit: number; isTrial: boolean };
type Subscription = { id: string; status: string; startsAt: string | null; expiresAt: string | null; graceEndsAt: string | null; createdAt: string; priceRialSnapshot: string; listPriceRialSnapshot: string; discountRialSnapshot: string; discountCodeSnapshot: string | null; isTrialSnapshot: boolean; plan: Plan };
type PaymentReceipt = {
  id: string; receiptNumber: string; amountRial: string; taxRial: string; currency: string; providerReference: string | null; paidAt: string;
  subscription: { plan: { code: string; nameFa: string } };
};
type BillingInvoice = {
  id: string; invoiceNumber: string; status: 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED'; netAmountRial: string; taxRial: string; totalAmountRial: string;
  descriptionFa: string; issuedAt: string; dueAt: string | null; paidAt: string | null;
  subscription: { plan: { code: string; nameFa: string } } | null;
  paymentIntent: { providerReference: string | null } | null;
  manualRenewal: { trackingNumber: string } | null;
};
type CheckoutResult = { paymentIntentId: string; subscriptionId: string; authority: string; redirectUrl: string } | { trialActivated: true; subscriptionId: string; startsAt: string; expiresAt: string };
type DiscountPreview = { planId: string; code: string; listPriceRial: string; discountRial: string; payableRial: string };

function formatToman(rial: string): string {
  return `${(BigInt(rial) / BigInt(10)).toLocaleString('fa-IR')} تومان`;
}

export function SubscriptionManager({ paymentResult, trialResult }: { paymentResult?: string; trialResult?: string }) {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [error, setError] = useState('');
  const [busyPlanId, setBusyPlanId] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [previewingPlanId, setPreviewingPlanId] = useState('');
  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([apiRequest<Organization[]>('/organizations/mine'), apiRequest<Plan[]>('/subscriptions/plans')]).then(([organizationItems, planItems]) => {
      if (!active) return;
      const suppliers = organizationItems.filter((item) => item.kind === 'SUPPLIER');
      setOrganizations(suppliers); setPlans(planItems); setOrganizationId(suppliers[0]?.id ?? '');
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت اطلاعات اشتراک انجام نشد.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    void Promise.all([
      apiRequest<Subscription[]>(`/subscriptions/organizations/${organizationId}`),
      apiRequest<PaymentReceipt[]>(`/subscriptions/organizations/${organizationId}/receipts`),
      apiRequest<BillingInvoice[]>(`/subscriptions/organizations/${organizationId}/invoices`),
    ]).then(([subscriptionItems, receiptItems, invoiceItems]) => {
      if (!active) return;
      setSubscriptions(subscriptionItems); setReceipts(receiptItems); setInvoices(invoiceItems);
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت سوابق مالی انجام نشد.'); });
    return () => { active = false; };
  }, [organizationId, trialResult]);

  useEffect(() => {
    if (!paymentResult && trialResult !== 'success') return;
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith('vazano:subscription-checkout:')) sessionStorage.removeItem(key);
    }
  }, [paymentResult, trialResult]);

  const organization = organizations.find((item) => item.id === organizationId);
  const canPurchase = organization?.members.some((member) => member.status === 'ACTIVE' && member.role === 'SUPPLIER_OWNER') ?? false;
  const current = subscriptions.find((item) => ['ACTIVE', 'GRACE'].includes(item.status));
  const latest = subscriptions[0];

  async function checkout(plan: Plan) {
    if (!organizationId) return;
    setBusyPlanId(plan.id); setError('');
    try {
      const normalizedDiscountCode = plan.isTrial ? '' : discountCode.trim().toUpperCase();
      const storageKey = `vazano:subscription-checkout:${organizationId}:${plan.id}:${normalizedDiscountCode || 'NO_DISCOUNT'}`;
      let idempotencyKey = sessionStorage.getItem(storageKey);
      if (!idempotencyKey) {
        idempotencyKey = `subscription:${organizationId}:${plan.id}:${crypto.randomUUID()}`;
        sessionStorage.setItem(storageKey, idempotencyKey);
      }
      const result = await apiRequest<CheckoutResult>(`/subscriptions/organizations/${organizationId}/checkout`, {
        method: 'POST', body: JSON.stringify({ planId: plan.id, idempotencyKey, discountCode: normalizedDiscountCode || undefined }),
      });
      if ('redirectUrl' in result) window.location.assign(result.redirectUrl);
      else {
        router.replace('/supplier/subscription?trial=success');
        router.refresh();
      }
    } catch (reason: unknown) {
      sessionStorage.removeItem(`vazano:subscription-checkout:${organizationId}:${plan.id}:${plan.isTrial ? 'NO_DISCOUNT' : discountCode.trim().toUpperCase() || 'NO_DISCOUNT'}`);
      setError(reason instanceof Error ? reason.message : 'شروع پرداخت انجام نشد.'); setBusyPlanId('');
    }
  }

  async function previewDiscount(plan: Plan) {
    if (!organizationId || !discountCode.trim()) return;
    setPreviewingPlanId(plan.id); setError(''); setDiscountPreview(null);
    try {
      const preview = await apiRequest<Omit<DiscountPreview, 'planId'>>(`/subscriptions/organizations/${organizationId}/discount-preview`, {
        method: 'POST', body: JSON.stringify({ planId: plan.id, discountCode: discountCode.trim().toUpperCase() }),
      });
      setDiscountPreview({ ...preview, planId: plan.id });
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'بررسی کد تخفیف انجام نشد.'); }
    finally { setPreviewingPlanId(''); }
  }

  return <div className="stack">
    {paymentResult === 'success' && <div className="message message-success">پرداخت با موفقیت تأیید شد و اشتراک شما فعال است.</div>}
    {trialResult === 'success' && <div className="message message-success">دوره آزمایشی با موفقیت فعال شد و نیازی به پرداخت ندارد.</div>}
    {paymentResult === 'cancelled' && <div className="message message-error">پرداخت لغو شد و مبلغی از حساب شما کسر نشده است.</div>}
    {paymentResult === 'failed' && <div className="message message-error">تأیید پرداخت انجام نشد. در صورت کسر وجه، وضعیت تراکنش را با پشتیبانی پیگیری کنید.</div>}
    {paymentResult === 'processing' && <div className="message">نتیجه پرداخت در حال پردازش است؛ چند لحظه بعد این صفحه را تازه‌سازی کنید.</div>}
    {error && <div className="message message-error">{error}</div>}
    {organizations.length === 0 && !error && <div className="card">برای خرید اشتراک، ابتدا یک حساب فروشنده ایجاد و تأیید کنید.</div>}
    {organizations.length > 0 && <label className="form-field card"><span>حساب فروشنده</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.map((item) => <option value={item.id} key={item.id}>{item.displayName} · {item.status}</option>)}</select></label>}
    {organization && <section className="card stack"><h2>وضعیت فعلی</h2>{current ? <SubscriptionStatusSummary subscription={current} /> : <div><p className="muted">اشتراک فعال وجود ندارد. سوابق حساب حذف نشده و با خرید پلن دوباره فعال می‌شود.</p>{latest?.expiresAt && <p><strong>تاریخ پایان آخرین اشتراک:</strong> {new Date(latest.expiresAt).toLocaleDateString('fa-IR')}</p>}</div>}<p className="muted">تمدید خودکار غیرفعال است و هیچ مبلغی بدون تأیید شما برداشت نمی‌شود.</p>{!canPurchase && <div className="message">فقط مالک حساب فروشنده می‌تواند خرید یا تمدید اشتراک را انجام دهد.</div>}</section>}
    {organization && <section className="stack"><div><h2>انتخاب پلن</h2><p className="muted">قیمت‌های نمایش‌داده‌شده بدون مالیات هستند. کد تخفیف در سرور اعتبارسنجی و مبلغ نهایی پیش از انتقال به درگاه ثبت می‌شود.</p></div><label className="form-field card"><span>کد تخفیف (اختیاری)</span><input dir="ltr" maxLength={32} pattern="[A-Za-z0-9_-]{3,32}" value={discountCode} onChange={(event) => { setDiscountCode(event.target.value.toUpperCase()); setDiscountPreview(null); }} placeholder="VAZANO2026" /><small>برای پلن‌های پولی استفاده می‌شود؛ پلن آزمایشی نیازی به کد ندارد.</small></label><div className="plan-grid">{plans.map((plan) => { const preview = discountPreview?.planId === plan.id ? discountPreview : null; return <article className="card plan-card" key={plan.id}><h3>{plan.nameFa}</h3><strong>{plan.isTrial ? 'رایگان' : preview ? formatToman(preview.payableRial) : formatToman(plan.priceRial)}</strong>{preview && <div className="message message-success">قیمت اصلی {formatToman(preview.listPriceRial)} · تخفیف {formatToman(preview.discountRial)} · کد {preview.code}</div>}<p>{plan.descriptionFa || `${BigInt(plan.grantCredits).toLocaleString('fa-IR')} اعتبار قابل مصرف`}</p><p>{plan.isTrial ? `مدت آزمایش: ${Number(plan.durationIso.match(/^P(\d+)D$/)?.[1] ?? 0).toLocaleString('fa-IR')} روز` : `سقف پایه روزانه: ${plan.dailyProposalLimit.toLocaleString('fa-IR')} پیشنهاد`}</p>{!plan.isTrial && discountCode.trim() && <button className="button button-secondary" type="button" disabled={!canPurchase || Boolean(previewingPlanId || busyPlanId)} onClick={() => void previewDiscount(plan)}>{previewingPlanId === plan.id ? 'در حال بررسی…' : 'محاسبه قیمت با کد'}</button>}<button className="button button-primary" type="button" disabled={!canPurchase || Boolean(busyPlanId) || (plan.isTrial && (Boolean(current) || Boolean(organization.subscriptionTrialRedeemedAt)))} onClick={() => void checkout(plan)}>{busyPlanId === plan.id ? plan.isTrial ? 'در حال فعال‌سازی…' : 'در حال اتصال به زرین‌پال…' : plan.isTrial && organization.subscriptionTrialRedeemedAt ? 'قبلاً استفاده شده' : plan.isTrial ? 'فعال‌سازی دوره آزمایشی' : current ? 'تمدید با این پلن' : 'خرید این پلن'}</button></article>; })}</div></section>}
    {invoices.length > 0 && <section className="stack"><h2>صورتحساب‌ها</h2>{invoices.map((invoice) => <article className="card admin-card-title" key={invoice.id}><div><div className="eyebrow">صورتحساب {invoice.invoiceNumber}</div><h3>{invoice.descriptionFa}</h3><p>{formatToman(invoice.netAmountRial)} + مالیات {formatToman(invoice.taxRial)} · صدور {new Date(invoice.issuedAt).toLocaleDateString('fa-IR')}</p></div><div><span className={`status-badge ${invoice.status === 'PAID' ? 'status-active' : invoice.status === 'CANCELLED' ? 'status-suspended' : 'severity-medium'}`}>{invoiceStatusLabel(invoice.status)}</span>{invoice.manualRenewal?.trackingNumber && <p>پیگیری دستی: {invoice.manualRenewal.trackingNumber}</p>}{invoice.paymentIntent?.providerReference && <p>پیگیری درگاه: {invoice.paymentIntent.providerReference}</p>}<Link className="button button-secondary" href={`/dashboard/invoices/${invoice.id}` as Route}>مشاهده و چاپ</Link></div></article>)}</section>}
    {receipts.length > 0 && <section className="stack"><h2>رسیدهای پرداخت</h2>{receipts.map((receipt) => <article className="card admin-card-title" key={receipt.id}><div><div className="eyebrow">رسید {receipt.receiptNumber}</div><h3>{receipt.subscription.plan.nameFa}</h3><p>{formatToman(receipt.amountRial)} · بدون مالیات · {new Date(receipt.paidAt).toLocaleString('fa-IR')}</p></div><div><span className="status-badge status-active">پرداخت‌شده</span>{receipt.providerReference && <p>پیگیری درگاه: {receipt.providerReference}</p>}<Link className="button button-secondary" href={`/dashboard/receipts/${receipt.id}` as Route}>مشاهده و چاپ</Link></div></article>)}</section>}
    {subscriptions.length > 0 && <section className="stack"><h2>سوابق اشتراک</h2>{subscriptions.map((item) => <article className="card list-card" key={item.id}><div><strong>{item.plan.nameFa}</strong><p>{item.isTrialSnapshot ? 'آزمایشی رایگان' : formatToman(item.priceRialSnapshot)} · ثبت {new Date(item.createdAt).toLocaleDateString('fa-IR')}</p>{BigInt(item.discountRialSnapshot) > BigInt(0) && <p className="muted">قیمت اصلی {formatToman(item.listPriceRialSnapshot)} · تخفیف {formatToman(item.discountRialSnapshot)} با کد {item.discountCodeSnapshot}</p>}</div><span className={`status-badge ${item.status === 'ACTIVE' ? 'status-active' : item.status === 'EXPIRED' ? 'status-suspended' : 'severity-medium'}`}>{subscriptionLabel(item.status)}</span></article>)}</section>}
  </div>;
}

function SubscriptionStatusSummary({ subscription }: { subscription: Subscription }) {
  const [referenceTime] = useState(() => Date.now());
  const expiresAt = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
  const remainingDays = expiresAt ? Math.ceil((expiresAt.getTime() - referenceTime) / 86_400_000) : null;
  const renewalAmount = subscription.isTrialSnapshot ? 'پس از انتخاب پلن پولی نمایش داده می‌شود' : formatToman(subscription.plan.priceRial);
  return <div className="stack">
    <div className="subscription-status"><span className={`status-badge ${subscription.status === 'ACTIVE' ? 'status-active' : 'severity-medium'}`}>{subscription.isTrialSnapshot ? 'آزمایشی' : subscription.status === 'ACTIVE' ? 'فعال' : 'مهلت تنفس'}</span><strong>{subscription.plan.nameFa}</strong></div>
    <p><strong>تاریخ پایان:</strong> {expiresAt ? expiresAt.toLocaleDateString('fa-IR') : 'تعیین نشده'}</p>
    <p><strong>مبلغ تمدید با همین پلن:</strong> {renewalAmount} <span className="muted">(بدون مالیات)</span></p>
    {subscription.status === 'GRACE' && subscription.graceEndsAt && <div className="message message-error">مهلت تنفس تا {new Date(subscription.graceEndsAt).toLocaleDateString('fa-IR')} ادامه دارد؛ دریافت استعلام جدید و ارسال پیشنهاد متوقف است.</div>}
    {subscription.status === 'ACTIVE' && remainingDays !== null && remainingDays >= 0 && remainingDays <= 14 && <div className={remainingDays <= 3 ? 'message message-error' : 'message'}>{remainingDays === 0 ? 'اشتراک امروز پایان می‌یابد.' : `${remainingDays.toLocaleString('fa-IR')} روز تا پایان اشتراک باقی مانده است.`}</div>}
  </div>;
}

function subscriptionLabel(status: string): string {
  return ({ DRAFT: 'در انتظار پرداخت', ACTIVE: 'فعال', GRACE: 'مهلت تنفس', EXPIRED: 'منقضی', SUSPENDED: 'تعلیق‌شده', CANCELLED: 'لغوشده' } as Record<string, string>)[status] ?? status;
}

function invoiceStatusLabel(status: BillingInvoice['status']): string {
  return ({ ISSUED: 'صادرشده', PAID: 'پرداخت‌شده', OVERDUE: 'سررسیدگذشته', CANCELLED: 'لغوشده' } as const)[status];
}
