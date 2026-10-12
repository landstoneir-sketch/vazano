'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';

type BillingCycle = 'P1M' | 'P3M' | 'P6M' | 'P1Y' | 'CUSTOM';
type Plan = {
  id: string; code: string; nameFa: string; descriptionFa: string | null; billingCycle: BillingCycle; durationIso: string;
  priceRial: string; grantCredits: string; dailyProposalLimit: number; maxProposalLimit: number; taxIncluded: boolean;
  isTrial: boolean; isPublic: boolean; isActive: boolean; version: number; entitlements: unknown;
};
type Subscription = {
  id: string; status: string; startsAt: string | null; expiresAt: string | null; graceEndsAt: string | null;
  priceRialSnapshot: string; createdAt: string; organization: { displayName: string; legalName: string }; plan: { code: string; nameFa: string };
};
type Payment = {
  id: string; provider: string; purpose: string; status: string; amountRial: string; authority: string | null;
  providerReference: string | null; createdAt: string; payerOrganization: { displayName: string; legalName: string } | null;
  reconciliationStatus: 'NOT_CHECKED' | 'MATCHED' | 'ACTION_REQUIRED' | 'PROVIDER_UNCONFIRMED';
  lastReconciledAt: string | null; lastProviderCode: number | null;
  reconciliationResolution: PaymentResolution | null; reconciliationResolutionNote: string | null;
  reconciliationResolvedAt: string | null;
};
type PaymentResolution = 'CUSTOMER_RETRY_REQUIRED' | 'PROVIDER_SUPPORT_REQUIRED' | 'REFUND_REVIEW_REQUIRED' | 'NO_FINANCIAL_ACTION';
type PaymentReceipt = {
  id: string; receiptNumber: string; amountRial: string; taxRial: string; providerReference: string | null; paidAt: string;
  organization: { displayName: string; legalName: string };
  subscription: null | { plan: { code: string; nameFa: string } };
  qualityControlRequest: null | { rfq: { code: string; title: string } };
};
type SubscriptionReminder = {
  id: string; offsetDays: number; channel: 'IN_APP' | 'SMS' | 'EMAIL'; status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  scheduledAt: string; sentAt: string | null; failureReason: string | null;
  subscription: { organization: { displayName: string; legalName: string }; plan: { code: string; nameFa: string } };
};
type SupplierOption = { id: string; displayName: string; legalName: string };
type ManualRenewal = {
  id: string; trackingNumber: string; amountRial: string; paidAt: string; note: string; createdAt: string;
  organization: SupplierOption;
  subscription: { startsAt: string; expiresAt: string; plan: { code: string; nameFa: string } };
  activatedBy: { firstName: string | null; lastName: string | null; mobile: string };
};
type BillingInvoice = {
  id: string; invoiceNumber: string; status: 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED'; netAmountRial: string; taxRial: string; totalAmountRial: string;
  descriptionFa: string; issuedAt: string; dueAt: string | null; paidAt: string | null;
  organization: SupplierOption; subscription: { plan: { code: string; nameFa: string } } | null;
  paymentIntent: { providerReference: string | null } | null; manualRenewal: { trackingNumber: string } | null;
};
type DiscountCode = {
  id: string; code: string; nameFa: string; descriptionFa: string | null; type: 'PERCENTAGE' | 'FIXED_RIAL';
  percentageBps: number | null; fixedAmountRial: string | null; minimumPurchaseRial: string; perOrganizationLimit: number;
  maxRedemptions: number | null; validFrom: string; validUntil: string; isActive: boolean;
  applicablePlan: { id: string; code: string; nameFa: string } | null; _count: { redemptions: number };
};
type Overview = {
  summary: Record<string, number>; reminderSummary: Record<string, number>; plans: Plan[]; subscriptions: Subscription[];
  payments: Payment[]; receipts: PaymentReceipt[]; reminders: SubscriptionReminder[];
  reminderDelivery: { enabled: boolean; provider: 'SMSIR' | 'DEBUG'; templatesConfigured: boolean; liveReady: boolean; deliveryWindow: string };
  suppliers: SupplierOption[]; manualRenewals: ManualRenewal[]; invoices: BillingInvoice[]; discountCodes: DiscountCode[];
};
type Tab = 'plans' | 'discounts' | 'subscriptions' | 'manual-renewals' | 'invoices' | 'payments' | 'receipts' | 'reminders';
type ReconciliationResult = { payment: { reconciliationStatus: Payment['reconciliationStatus'] }; provider: { success: boolean; code: number; referenceId: string | null } };

type PlanDraft = {
  id?: string; code: string; nameFa: string; descriptionFa: string; billingCycle: BillingCycle; durationIso: string;
  priceToman: string; grantCredits: string; dailyProposalLimit: number; maxProposalLimit: number; taxIncluded: boolean;
  isPublic: boolean; isActive: boolean; canViewMatchedRfqs: boolean; version?: number; entitlements: Record<string, unknown>;
  isTrial: boolean; trialDurationDays: number;
};
type DiscountDraft = {
  code: string; nameFa: string; descriptionFa: string; type: 'PERCENTAGE' | 'FIXED_RIAL'; percentage: string;
  fixedAmountToman: string; applicablePlanId: string; minimumPurchaseToman: string; perOrganizationLimit: number;
  maxRedemptions: string; validFrom: string; validUntil: string; isActive: boolean;
};

const emptyPlan: PlanDraft = {
  code: '', nameFa: '', descriptionFa: '', billingCycle: 'P1M', durationIso: 'P1M', priceToman: '', grantCredits: '0',
  dailyProposalLimit: 2, maxProposalLimit: 6, taxIncluded: false, isPublic: true, isActive: true, canViewMatchedRfqs: true, entitlements: {},
  isTrial: false, trialDurationDays: 14,
};

function currentLocalDateTime(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function futureLocalDateTime(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function fromPlan(plan: Plan): PlanDraft {
  const entitlements = asObject(plan.entitlements);
  return {
    id: plan.id, code: plan.code, nameFa: plan.nameFa, descriptionFa: plan.descriptionFa ?? '', billingCycle: plan.billingCycle,
    durationIso: plan.durationIso, priceToman: (BigInt(plan.priceRial) / BigInt(10)).toString(), grantCredits: plan.grantCredits,
    dailyProposalLimit: plan.dailyProposalLimit, maxProposalLimit: plan.maxProposalLimit, taxIncluded: plan.taxIncluded,
    isPublic: plan.isPublic, isActive: plan.isActive, canViewMatchedRfqs: entitlements.canViewMatchedRfqs !== false,
    version: plan.version, entitlements, isTrial: plan.isTrial,
    trialDurationDays: Number(plan.durationIso.match(/^P(\d+)D$/)?.[1] ?? 14),
  };
}

function formatToman(rial: string): string {
  return `${(BigInt(rial) / BigInt(10)).toLocaleString('fa-IR')} تومان`;
}

export function BillingManager() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tab, setTab] = useState<Tab>('plans');
  const [draft, setDraft] = useState<PlanDraft>(emptyPlan);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reconcilingPaymentId, setReconcilingPaymentId] = useState('');
  const [resolvingPaymentId, setResolvingPaymentId] = useState('');
  const [retryingReminderId, setRetryingReminderId] = useState('');
  const [manualRenewal, setManualRenewal] = useState({ organizationId: '', planId: '', amountToman: '', trackingNumber: '', paidAt: currentLocalDateTime(), note: '' });
  const [discount, setDiscount] = useState<DiscountDraft>({ code: '', nameFa: '', descriptionFa: '', type: 'PERCENTAGE', percentage: '10', fixedAmountToman: '', applicablePlanId: '', minimumPurchaseToman: '0', perOrganizationLimit: 1, maxRedemptions: '', validFrom: currentLocalDateTime(), validUntil: futureLocalDateTime(30), isActive: true });

  const load = useCallback(async () => {
    setError('');
    try { setOverview(await apiRequest<Overview>('/admin/billing/overview')); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'دریافت اطلاعات مالی انجام نشد.'); }
  }, []);

  useEffect(() => {
    let active = true;
    void apiRequest<Overview>('/admin/billing/overview').then((data) => { if (active) setOverview(data); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت اطلاعات مالی انجام نشد.');
    });
    return () => { active = false; };
  }, []);

  const statusCards = useMemo(() => [
    ['ACTIVE', 'اشتراک فعال'], ['GRACE', 'دوره تنفس'], ['EXPIRED', 'منقضی'], ['SUSPENDED', 'تعلیق‌شده'],
  ] as const, []);

  async function savePlan(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const priceToman = draft.isTrial ? BigInt(0) : BigInt(draft.priceToman || '0');
      const entitlements = {
        ...draft.entitlements,
        canViewMatchedRfqs: draft.canViewMatchedRfqs,
        dailyProposalLimit: draft.dailyProposalLimit,
        shortageOverrideMax: draft.maxProposalLimit,
      };
      const editable = {
        nameFa: draft.nameFa, descriptionFa: draft.descriptionFa || undefined, priceRial: (priceToman * BigInt(10)).toString(),
        grantCredits: draft.grantCredits, dailyProposalLimit: draft.dailyProposalLimit, maxProposalLimit: draft.maxProposalLimit,
        taxIncluded: draft.taxIncluded, isPublic: draft.isPublic, isActive: draft.isActive, entitlements,
      };
      if (draft.id) {
        await apiRequest(`/admin/billing/plans/${draft.id}`, { method: 'PUT', body: JSON.stringify({ ...editable, expectedVersion: draft.version }) });
        setMessage('پلن اشتراک به‌روزرسانی شد. تغییر قیمت فقط برای خریدهای بعدی اعمال می‌شود.');
      } else {
        await apiRequest('/admin/billing/plans', { method: 'POST', body: JSON.stringify({
          ...editable, code: draft.code, isTrial: draft.isTrial,
          billingCycle: draft.isTrial ? 'CUSTOM' : draft.billingCycle,
          durationIso: draft.isTrial ? `P${draft.trialDurationDays}D` : draft.durationIso,
        }) });
        setMessage('پلن اشتراک جدید ایجاد شد.');
      }
      await load(); setDraft(emptyPlan);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'ذخیره پلن انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function reconcilePayment(payment: Payment) {
    setReconcilingPaymentId(payment.id); setError(''); setMessage('');
    try {
      const result = await apiRequest<ReconciliationResult>(`/admin/billing/payments/${payment.id}/reconcile`, { method: 'POST' });
      setMessage(result.payment.reconciliationStatus === 'MATCHED' ? 'تراکنش با اطلاعات زرین‌پال منطبق است.' : result.payment.reconciliationStatus === 'ACTION_REQUIRED' ? 'مغایرت مالی شناسایی شد و نیازمند بررسی مسئول مالی است.' : 'پرداخت هنوز توسط زرین‌پال تأیید نشده است.');
      await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'تطبیق تراکنش انجام نشد.'); }
    finally { setReconcilingPaymentId(''); }
  }

  async function resolvePayment(payment: Payment, resolution: PaymentResolution, note: string) {
    setResolvingPaymentId(payment.id); setError(''); setMessage('');
    try {
      await apiRequest(`/admin/billing/payments/${payment.id}/resolve-reconciliation`, {
        method: 'POST', body: JSON.stringify({ resolution, note }),
      });
      setMessage('نتیجه رسیدگی مالی ثبت شد؛ وضعیت پرداخت یا خدمت به‌صورت خودکار تغییر نکرد.');
      await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'ثبت نتیجه رسیدگی انجام نشد.'); }
    finally { setResolvingPaymentId(''); }
  }

  async function retryReminder(reminder: SubscriptionReminder) {
    setRetryingReminderId(reminder.id); setError(''); setMessage('');
    try {
      await apiRequest(`/admin/billing/reminders/${reminder.id}/retry`, { method: 'POST' });
      setMessage('پیامک ناموفق دوباره در صف قرار گرفت و در ساعت مجاز پردازش می‌شود.');
      await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'قرار دادن مجدد پیامک در صف انجام نشد.'); }
    finally { setRetryingReminderId(''); }
  }

  async function createManualRenewal(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await apiRequest('/admin/billing/manual-renewals', { method: 'POST', body: JSON.stringify({
        organizationId: manualRenewal.organizationId,
        planId: manualRenewal.planId,
        amountRial: (BigInt(manualRenewal.amountToman || '0') * BigInt(10)).toString(),
        trackingNumber: manualRenewal.trackingNumber,
        paidAt: new Date(manualRenewal.paidAt).toISOString(),
        note: manualRenewal.note,
      }) });
      setMessage('تمدید دستی ثبت و اشتراک فعال شد. اعتبار، اخطارهای تمدید و سابقه حساب نیز به‌روزرسانی شدند.');
      setManualRenewal({ organizationId: '', planId: '', amountToman: '', trackingNumber: '', paidAt: currentLocalDateTime(), note: '' });
      await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'ثبت تمدید دستی انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function createDiscount(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await apiRequest('/admin/billing/discounts', { method: 'POST', body: JSON.stringify({
        code: discount.code.trim().toUpperCase(), nameFa: discount.nameFa, descriptionFa: discount.descriptionFa || undefined,
        type: discount.type,
        percentageBps: discount.type === 'PERCENTAGE' ? Math.round(Number(discount.percentage) * 100) : undefined,
        fixedAmountRial: discount.type === 'FIXED_RIAL' ? (BigInt(discount.fixedAmountToman || '0') * BigInt(10)).toString() : undefined,
        applicablePlanId: discount.applicablePlanId || undefined,
        minimumPurchaseRial: (BigInt(discount.minimumPurchaseToman || '0') * BigInt(10)).toString(),
        perOrganizationLimit: discount.perOrganizationLimit,
        maxRedemptions: discount.maxRedemptions ? Number(discount.maxRedemptions) : undefined,
        validFrom: new Date(discount.validFrom).toISOString(), validUntil: new Date(discount.validUntil).toISOString(), isActive: discount.isActive,
      }) });
      setMessage('کد تخفیف ایجاد شد و از زمان شروع اعتبار قابل استفاده است.');
      setDiscount({ code: '', nameFa: '', descriptionFa: '', type: 'PERCENTAGE', percentage: '10', fixedAmountToman: '', applicablePlanId: '', minimumPurchaseToman: '0', perOrganizationLimit: 1, maxRedemptions: '', validFrom: currentLocalDateTime(), validUntil: futureLocalDateTime(30), isActive: true });
      await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'ایجاد کد تخفیف انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function toggleDiscount(item: DiscountCode) {
    setBusy(true); setError(''); setMessage('');
    try {
      await apiRequest(`/admin/billing/discounts/${item.id}/status`, { method: 'PUT', body: JSON.stringify({ isActive: !item.isActive }) });
      setMessage(item.isActive ? 'کد تخفیف غیرفعال شد.' : 'کد تخفیف فعال شد.');
      await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'تغییر وضعیت کد تخفیف انجام نشد.'); }
    finally { setBusy(false); }
  }

  if (!overview && !error) return <div className="card">در حال دریافت اطلاعات اشتراک و پرداخت…</div>;

  return <div className="stack">
    {error && <div className="message message-error">{error}</div>}{message && <div className="message message-success">{message}</div>}
    <div className="dashboard-grid">{statusCards.map(([status, label]) => <article className="card billing-summary-card" key={status}><span>{label}</span><strong>{(overview?.summary[status] ?? 0).toLocaleString('fa-IR')}</strong></article>)}</div>
    <div className="tab-list" role="tablist" aria-label="بخش مالی"><button className={tab === 'plans' ? 'tab-active' : ''} type="button" onClick={() => setTab('plans')}>پلن‌ها</button><button className={tab === 'discounts' ? 'tab-active' : ''} type="button" onClick={() => setTab('discounts')}>کدهای تخفیف</button><button className={tab === 'subscriptions' ? 'tab-active' : ''} type="button" onClick={() => setTab('subscriptions')}>اشتراک‌ها</button><button className={tab === 'manual-renewals' ? 'tab-active' : ''} type="button" onClick={() => setTab('manual-renewals')}>تمدید دستی</button><button className={tab === 'invoices' ? 'tab-active' : ''} type="button" onClick={() => setTab('invoices')}>صورتحساب‌ها</button><button className={tab === 'payments' ? 'tab-active' : ''} type="button" onClick={() => setTab('payments')}>پرداخت‌ها</button><button className={tab === 'receipts' ? 'tab-active' : ''} type="button" onClick={() => setTab('receipts')}>رسیدها</button><button className={tab === 'reminders' ? 'tab-active' : ''} type="button" onClick={() => setTab('reminders')}>اخطارهای تمدید</button></div>
    {tab === 'plans' && overview && <section className="card stack"><div className="admin-card-title"><div><h2>مدیریت پلن‌ها</h2><p>قیمت را به تومان وارد کنید؛ مبلغ در دیتابیس با واحد ریال و به‌صورت عدد صحیح ذخیره می‌شود.</p></div><button className="button button-secondary" type="button" onClick={() => { setDraft(emptyPlan); setError(''); setMessage(''); }}>پلن جدید</button></div><div className="content-item-list">{overview.plans.map((plan) => <button className={draft.id === plan.id ? 'content-item-active' : ''} type="button" key={plan.id} onClick={() => { setDraft(fromPlan(plan)); setError(''); setMessage(''); }}><strong>{plan.nameFa}</strong><span>{plan.isTrial ? 'آزمایشی رایگان' : formatToman(plan.priceRial)} · {plan.isActive ? 'فعال' : 'غیرفعال'}</span></button>)}</div><PlanForm draft={draft} setDraft={setDraft} busy={busy} onSubmit={savePlan} /></section>}
    {tab === 'discounts' && overview && <DiscountManager items={overview.discountCodes} plans={overview.plans} draft={discount} setDraft={setDiscount} busy={busy} onSubmit={createDiscount} onToggle={toggleDiscount} />}
    {tab === 'subscriptions' && overview && <SubscriptionList items={overview.subscriptions} />}
    {tab === 'manual-renewals' && overview && <ManualRenewalManager suppliers={overview.suppliers} plans={overview.plans} items={overview.manualRenewals} draft={manualRenewal} setDraft={setManualRenewal} busy={busy} onSubmit={createManualRenewal} />}
    {tab === 'invoices' && overview && <InvoiceList items={overview.invoices} />}
    {tab === 'payments' && overview && <PaymentList items={overview.payments} reconcilingId={reconcilingPaymentId} resolvingId={resolvingPaymentId} onReconcile={reconcilePayment} onResolve={resolvePayment} />}
    {tab === 'receipts' && overview && <ReceiptList items={overview.receipts} />}
    {tab === 'reminders' && overview && <ReminderList items={overview.reminders} summary={overview.reminderSummary} delivery={overview.reminderDelivery} retryingId={retryingReminderId} onRetry={retryReminder} />}
  </div>;
}

function DiscountManager({ items, plans, draft, setDraft, busy, onSubmit, onToggle }: {
  items: DiscountCode[]; plans: Plan[]; draft: DiscountDraft; setDraft: (value: DiscountDraft) => void; busy: boolean;
  onSubmit: (event: FormEvent) => Promise<void>; onToggle: (item: DiscountCode) => Promise<void>;
}) {
  const paidPlans = plans.filter((plan) => !plan.isTrial);
  return <section className="stack"><form className="card form-grid" onSubmit={(event) => void onSubmit(event)}><div className="full"><h2>ایجاد کد تخفیف اشتراک</h2><p className="muted">مبلغ نهایی فقط در سرور محاسبه می‌شود. کدهای استفاده‌شده حذف نمی‌شوند و فقط می‌توان آن‌ها را غیرفعال کرد.</p></div><label className="form-field"><span>کد</span><input dir="ltr" minLength={3} maxLength={32} pattern="[A-Z0-9_-]{3,32}" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} required /></label><label className="form-field"><span>نام فارسی</span><input minLength={2} maxLength={120} value={draft.nameFa} onChange={(event) => setDraft({ ...draft, nameFa: event.target.value })} required /></label><label className="form-field full"><span>توضیح</span><textarea maxLength={500} rows={2} value={draft.descriptionFa} onChange={(event) => setDraft({ ...draft, descriptionFa: event.target.value })} /></label><label className="form-field"><span>نوع تخفیف</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as DiscountDraft['type'] })}><option value="PERCENTAGE">درصدی</option><option value="FIXED_RIAL">مبلغ ثابت</option></select></label>{draft.type === 'PERCENTAGE' ? <label className="form-field"><span>درصد تخفیف</span><input type="number" min="0.01" max="90" step="0.01" value={draft.percentage} onChange={(event) => setDraft({ ...draft, percentage: event.target.value })} required /></label> : <label className="form-field"><span>مبلغ ثابت (تومان)</span><input type="number" min="1" value={draft.fixedAmountToman} onChange={(event) => setDraft({ ...draft, fixedAmountToman: event.target.value })} required /></label>}<label className="form-field"><span>محدود به پلن</span><select value={draft.applicablePlanId} onChange={(event) => setDraft({ ...draft, applicablePlanId: event.target.value })}><option value="">همه پلن‌های پولی</option>{paidPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.nameFa}</option>)}</select></label><label className="form-field"><span>حداقل خرید (تومان)</span><input type="number" min="0" value={draft.minimumPurchaseToman} onChange={(event) => setDraft({ ...draft, minimumPurchaseToman: event.target.value })} required /></label><label className="form-field"><span>سقف هر سازمان</span><input type="number" min="1" max="1000" value={draft.perOrganizationLimit} onChange={(event) => setDraft({ ...draft, perOrganizationLimit: Number(event.target.value) })} required /></label><label className="form-field"><span>سقف کل استفاده (اختیاری)</span><input type="number" min={draft.perOrganizationLimit} value={draft.maxRedemptions} onChange={(event) => setDraft({ ...draft, maxRedemptions: event.target.value })} /></label><label className="form-field"><span>شروع اعتبار</span><input type="datetime-local" value={draft.validFrom} onChange={(event) => setDraft({ ...draft, validFrom: event.target.value })} required /></label><label className="form-field"><span>پایان اعتبار</span><input type="datetime-local" value={draft.validUntil} onChange={(event) => setDraft({ ...draft, validUntil: event.target.value })} required /></label><label className="check-field full"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /><span>بلافاصله فعال باشد</span></label><button className="button button-primary" disabled={busy}>{busy ? 'در حال ذخیره…' : 'ایجاد کد تخفیف'}</button></form><div><h2>کدهای ثبت‌شده</h2><p className="muted">تعداد مصرف شامل رزروهای در انتظار پرداخت و پرداخت‌های قطعی است.</p></div>{items.length === 0 && <div className="card">هنوز کد تخفیفی ثبت نشده است.</div>}{items.map((item) => <article className="card admin-card-title" key={item.id}><div><div className="eyebrow">{item.code}</div><h3>{item.nameFa}</h3><p>{item.type === 'PERCENTAGE' ? `${((item.percentageBps ?? 0) / 100).toLocaleString('fa-IR')} درصد` : formatToman(item.fixedAmountRial ?? '0')} · {item.applicablePlan?.nameFa ?? 'همه پلن‌های پولی'}</p><p className="muted">اعتبار تا {new Date(item.validUntil).toLocaleString('fa-IR')} · {item._count.redemptions.toLocaleString('fa-IR')} استفاده/رزرو</p></div><div><span className={`status-badge ${item.isActive ? 'status-active' : 'status-suspended'}`}>{item.isActive ? 'فعال' : 'غیرفعال'}</span><button className="button button-secondary" type="button" disabled={busy} onClick={() => void onToggle(item)}>{item.isActive ? 'غیرفعال‌کردن' : 'فعال‌کردن'}</button></div></article>)}</section>;
}

function InvoiceList({ items }: { items: BillingInvoice[] }) {
  return <section className="stack"><div><h2>صورتحساب‌های اشتراک</h2><p className="muted">صورتحساب با شروع خرید صادر می‌شود و فقط پس از تأیید قطعی پرداخت یا تمدید دستی به وضعیت پرداخت‌شده می‌رود.</p></div>{items.length === 0 && <div className="card">هنوز صورتحسابی صادر نشده است.</div>}{items.map((invoice) => <article className="card admin-card-title" key={invoice.id}><div><div className="eyebrow">{invoice.invoiceNumber}</div><h3>{invoice.organization.displayName || invoice.organization.legalName}</h3><p>{invoice.descriptionFa} · {formatToman(invoice.netAmountRial)} · مالیات {formatToman(invoice.taxRial)}</p><p className="muted">صدور: {new Date(invoice.issuedAt).toLocaleString('fa-IR')}</p></div><div><span className={`status-badge ${invoice.status === 'PAID' ? 'status-active' : invoice.status === 'CANCELLED' ? 'status-suspended' : 'severity-medium'}`}>{invoiceStatusLabel(invoice.status)}</span>{invoice.manualRenewal?.trackingNumber && <p>پیگیری دستی: {invoice.manualRenewal.trackingNumber}</p>}{invoice.paymentIntent?.providerReference && <p>پیگیری درگاه: {invoice.paymentIntent.providerReference}</p>}<Link className="button button-secondary" href={`/dashboard/invoices/${invoice.id}` as Route}>مشاهده و چاپ</Link></div></article>)}</section>;
}

function ManualRenewalManager({ suppliers, plans, items, draft, setDraft, busy, onSubmit }: {
  suppliers: SupplierOption[]; plans: Plan[]; items: ManualRenewal[];
  draft: { organizationId: string; planId: string; amountToman: string; trackingNumber: string; paidAt: string; note: string };
  setDraft: (value: { organizationId: string; planId: string; amountToman: string; trackingNumber: string; paidAt: string; note: string }) => void;
  busy: boolean; onSubmit: (event: FormEvent) => Promise<void>;
}) {
  const paidPlans = plans.filter((plan) => plan.isActive && !plan.isTrial);
  function selectPlan(planId: string) {
    const plan = paidPlans.find((item) => item.id === planId);
    setDraft({ ...draft, planId, amountToman: plan ? (BigInt(plan.priceRial) / BigInt(10)).toString() : '' });
  }
  return <section className="stack"><form className="card form-grid" onSubmit={(event) => void onSubmit(event)}><div className="full"><h2>ثبت تمدید دستی</h2><p className="muted">فقط پس از مشاهده سند پرداخت ثبت کنید. این عملیات بلافاصله اشتراک و اعتبار فروشنده را فعال می‌کند و قابل حذف نیست.</p></div><label className="form-field"><span>سازمان فروشنده</span><select value={draft.organizationId} onChange={(event) => setDraft({ ...draft, organizationId: event.target.value })} required><option value="">انتخاب کنید</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.displayName || supplier.legalName}</option>)}</select></label><label className="form-field"><span>پلن پولی</span><select value={draft.planId} onChange={(event) => selectPlan(event.target.value)} required><option value="">انتخاب کنید</option>{paidPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.nameFa} — {formatToman(plan.priceRial)}</option>)}</select></label><label className="form-field"><span>مبلغ پرداخت‌شده (تومان)</span><input type="number" min="1" value={draft.amountToman} onChange={(event) => setDraft({ ...draft, amountToman: event.target.value })} required /></label><label className="form-field"><span>شماره پیگیری یکتا</span><input dir="ltr" minLength={3} maxLength={100} pattern="[A-Za-z0-9_\-/]+" value={draft.trackingNumber} onChange={(event) => setDraft({ ...draft, trackingNumber: event.target.value })} required /></label><label className="form-field"><span>زمان پرداخت</span><input type="datetime-local" max={currentLocalDateTime()} value={draft.paidAt} onChange={(event) => setDraft({ ...draft, paidAt: event.target.value })} required /></label><label className="form-field full"><span>توضیح و مستند ثبت</span><textarea minLength={10} maxLength={1000} rows={3} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} required /></label><button className="button button-primary" disabled={busy}>{busy ? 'در حال ثبت…' : 'ثبت قطعی و فعال‌سازی اشتراک'}</button></form><div><h2>سوابق تمدید دستی</h2><p className="muted">شماره پیگیری تکراری پذیرفته نمی‌شود و تمام عملیات در گزارش حسابرسی ثبت شده‌اند.</p></div>{items.length === 0 && <div className="card">هنوز تمدید دستی ثبت نشده است.</div>}{items.map((item) => <article className="card admin-card-title" key={item.id}><div><div className="eyebrow">پیگیری {item.trackingNumber}</div><h3>{item.organization.displayName || item.organization.legalName}</h3><p>{item.subscription.plan.nameFa} · {formatToman(item.amountRial)} · پرداخت {new Date(item.paidAt).toLocaleString('fa-IR')}</p><p className="muted">{item.note}</p></div><div><span className="status-badge status-active">فعال‌شده</span><p>پایان: {new Date(item.subscription.expiresAt).toLocaleDateString('fa-IR')}</p><p>اپراتور: {[item.activatedBy.firstName, item.activatedBy.lastName].filter(Boolean).join(' ') || item.activatedBy.mobile}</p></div></article>)}</section>;
}

function PlanForm({ draft, setDraft, busy, onSubmit }: { draft: PlanDraft; setDraft: (value: PlanDraft) => void; busy: boolean; onSubmit: (event: FormEvent) => Promise<void> }) {
  function applyCycle(cycle: BillingCycle) {
    const duration = cycle === 'P1M' || cycle === 'P3M' || cycle === 'P6M' || cycle === 'P1Y' ? cycle : draft.durationIso;
    setDraft({ ...draft, billingCycle: cycle, durationIso: duration });
  }
  return <form className="form-grid" onSubmit={(event) => void onSubmit(event)}>
    <label className="form-field"><span>نام پلن</span><input dir="rtl" value={draft.nameFa} onChange={(event) => setDraft({ ...draft, nameFa: event.target.value })} required /></label>
    <label className="form-field"><span>کد پایدار</span><input value={draft.code} disabled={Boolean(draft.id)} pattern="[A-Z0-9]+(?:_[A-Z0-9]+)*" onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} required /></label>
    <label className="form-field full"><span>توضیح پلن</span><textarea rows={3} dir="rtl" value={draft.descriptionFa} onChange={(event) => setDraft({ ...draft, descriptionFa: event.target.value })} /></label>
    <label className="check-field full"><input type="checkbox" checked={draft.isTrial} disabled={Boolean(draft.id)} onChange={(event) => setDraft({ ...draft, isTrial: event.target.checked, billingCycle: event.target.checked ? 'CUSTOM' : 'P1M', durationIso: event.target.checked ? 'P14D' : 'P1M', priceToman: event.target.checked ? '0' : '', taxIncluded: false })} /><span>پلن آزمایشی رایگان؛ هر سازمان فقط یک‌بار</span></label>
    {draft.isTrial ? <label className="form-field"><span>مدت دوره آزمایشی (روز)</span><input type="number" min="1" max="90" value={draft.trialDurationDays} disabled={Boolean(draft.id)} onChange={(event) => setDraft({ ...draft, trialDurationDays: Number(event.target.value) })} required /></label> : <label className="form-field"><span>دوره صورتحساب</span><select value={draft.billingCycle} disabled={Boolean(draft.id)} onChange={(event) => applyCycle(event.target.value as BillingCycle)}><option value="P1M">یک‌ماهه</option><option value="P3M">سه‌ماهه</option><option value="P6M">شش‌ماهه</option><option value="P1Y">سالانه</option></select></label>}
    <label className="form-field"><span>مبلغ (تومان)</span><input type="number" min={draft.isTrial ? '0' : '1'} value={draft.isTrial ? '0' : draft.priceToman} disabled={draft.isTrial} onChange={(event) => setDraft({ ...draft, priceToman: event.target.value })} required /></label>
    <label className="form-field"><span>اعتبار قابل مصرف</span><input type="number" min="0" value={draft.grantCredits} onChange={(event) => setDraft({ ...draft, grantCredits: event.target.value })} required /></label>
    <label className="form-field"><span>سقف پایه پیشنهاد روزانه</span><input type="number" min="0" value={draft.dailyProposalLimit} onChange={(event) => setDraft({ ...draft, dailyProposalLimit: Number(event.target.value) })} required /></label>
    <label className="form-field"><span>حداکثر سقف در کمبود عرضه</span><input type="number" min="0" value={draft.maxProposalLimit} onChange={(event) => setDraft({ ...draft, maxProposalLimit: Number(event.target.value) })} required /></label>
    <div className="full check-grid"><label className="check-field"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /><span>قابل خرید باشد</span></label><label className="check-field"><input type="checkbox" checked={draft.isPublic} onChange={(event) => setDraft({ ...draft, isPublic: event.target.checked })} /><span>در صفحه عمومی نمایش داده شود</span></label><label className="check-field"><input type="checkbox" checked={draft.canViewMatchedRfqs} onChange={(event) => setDraft({ ...draft, canViewMatchedRfqs: event.target.checked })} /><span>مشاهده استعلام‌های مرتبط</span></label><label className="check-field"><input type="checkbox" checked={draft.taxIncluded} disabled={draft.isTrial} onChange={(event) => setDraft({ ...draft, taxIncluded: event.target.checked })} /><span>مبلغ شامل مالیات است</span></label></div>
    <button className="button button-primary" disabled={busy}>{busy ? 'در حال ذخیره…' : draft.id ? 'ذخیره تغییرات پلن' : 'ایجاد پلن'}</button>
  </form>;
}

function SubscriptionList({ items }: { items: Subscription[] }) {
  return <section className="stack"><h2>آخرین اشتراک‌ها</h2>{items.length === 0 && <div className="card">هنوز اشتراکی ثبت نشده است.</div>}{items.map((item) => <article className="card admin-card-title" key={item.id}><div><div className="eyebrow">{item.plan.nameFa}</div><h3>{item.organization.displayName || item.organization.legalName}</h3><p>{formatToman(item.priceRialSnapshot)} · ثبت {new Date(item.createdAt).toLocaleDateString('fa-IR')}</p></div><div><span className={`status-badge ${statusClass(item.status)}`}>{subscriptionStatusLabel(item.status)}</span><p>{item.expiresAt ? `پایان: ${new Date(item.expiresAt).toLocaleDateString('fa-IR')}` : 'هنوز فعال نشده'}</p></div></article>)}</section>;
}

function PaymentList({ items, reconcilingId, resolvingId, onReconcile, onResolve }: { items: Payment[]; reconcilingId: string; resolvingId: string; onReconcile: (payment: Payment) => Promise<void>; onResolve: (payment: Payment, resolution: PaymentResolution, note: string) => Promise<void> }) {
  const openCount = items.filter((item) => ['ACTION_REQUIRED', 'PROVIDER_UNCONFIRMED'].includes(item.reconciliationStatus) && !item.reconciliationResolvedAt).length;
  return <section className="stack"><div><h2>آخرین پرداخت‌ها</h2><p className="muted">{openCount.toLocaleString('fa-IR')} تراکنش در صف رسیدگی مالی است.</p></div>{items.length === 0 && <div className="card">هنوز پرداختی ثبت نشده است.</div>}{items.map((item) => <article className="card stack" key={item.id}><div className="admin-card-title"><div><div className="eyebrow">{item.provider} · {item.purpose}</div><h3>{item.payerOrganization?.displayName ?? item.payerOrganization?.legalName ?? 'پرداخت‌کننده بدون سازمان'}</h3><p>{formatToman(item.amountRial)} · {new Date(item.createdAt).toLocaleString('fa-IR')}</p><p className="muted">تطبیق: {reconciliationStatusLabel(item.reconciliationStatus)}{item.lastReconciledAt ? ` · ${new Date(item.lastReconciledAt).toLocaleString('fa-IR')}` : ''}</p>{item.reconciliationResolvedAt && <p className="muted">نتیجه رسیدگی: {resolutionLabel(item.reconciliationResolution)} · {new Date(item.reconciliationResolvedAt).toLocaleString('fa-IR')}</p>}</div><div><span className={`status-badge ${statusClass(item.status)}`}>{paymentStatusLabel(item.status)}</span>{item.providerReference && <p>پیگیری: {item.providerReference}</p>}{item.authority && <button className="button button-secondary" type="button" disabled={Boolean(reconcilingId || resolvingId)} onClick={() => void onReconcile(item)}>{reconcilingId === item.id ? 'در حال استعلام…' : 'تطبیق با زرین‌پال'}</button>}</div></div>{['ACTION_REQUIRED', 'PROVIDER_UNCONFIRMED'].includes(item.reconciliationStatus) && !item.reconciliationResolvedAt && <PaymentResolutionForm payment={item} busy={resolvingId === item.id} disabled={Boolean(reconcilingId || resolvingId)} onResolve={onResolve} />}{item.reconciliationResolutionNote && <div className="message">یادداشت مالی: {item.reconciliationResolutionNote}</div>}</article>)}</section>;
}

function PaymentResolutionForm({ payment, busy, disabled, onResolve }: { payment: Payment; busy: boolean; disabled: boolean; onResolve: (payment: Payment, resolution: PaymentResolution, note: string) => Promise<void> }) {
  const [resolution, setResolution] = useState<PaymentResolution>('CUSTOMER_RETRY_REQUIRED');
  const [note, setNote] = useState('');
  return <form className="payment-resolution-form" onSubmit={(event) => { event.preventDefault(); void onResolve(payment, resolution, note); }}><label className="form-field"><span>اقدام پیشنهادی مالی</span><select value={resolution} onChange={(event) => setResolution(event.target.value as PaymentResolution)}><option value="CUSTOMER_RETRY_REQUIRED">ارسال لینک پرداخت مجدد به مشتری</option><option value="PROVIDER_SUPPORT_REQUIRED">پیگیری با پشتیبانی درگاه</option><option value="REFUND_REVIEW_REQUIRED">ارجاع برای بررسی استرداد</option><option value="NO_FINANCIAL_ACTION">بدون اقدام مالی</option></select></label><label className="form-field"><span>شرح مستند رسیدگی</span><textarea minLength={10} maxLength={1000} rows={2} value={note} onChange={(event) => setNote(event.target.value)} required /></label><button className="button button-primary" disabled={disabled}>{busy ? 'در حال ثبت…' : 'ثبت نتیجه رسیدگی'}</button></form>;
}

function ReceiptList({ items }: { items: PaymentReceipt[] }) {
  return <section className="stack"><h2>رسیدهای قطعی پرداخت</h2>{items.length === 0 && <div className="card">هنوز رسید پرداختی صادر نشده است.</div>}{items.map((item) => <article className="card admin-card-title" key={item.id}><div><div className="eyebrow">{item.receiptNumber}</div><h3>{item.organization.displayName || item.organization.legalName}</h3><p>{item.subscription?.plan.nameFa ?? (item.qualityControlRequest ? `کنترل کیفیت ${item.qualityControlRequest.rfq.code}` : 'خدمت وازانو')} · {formatToman(item.amountRial)} · بدون مالیات</p></div><div><span className="status-badge status-active">پرداخت‌شده</span><p>{new Date(item.paidAt).toLocaleString('fa-IR')}</p>{item.providerReference && <p>پیگیری: {item.providerReference}</p>}<Link className="button button-secondary" href={`/dashboard/receipts/${item.id}` as Route}>مشاهده و چاپ</Link></div></article>)}</section>;
}

function ReminderList({ items, summary, delivery, retryingId, onRetry }: { items: SubscriptionReminder[]; summary: Record<string, number>; delivery: Overview['reminderDelivery']; retryingId: string; onRetry: (reminder: SubscriptionReminder) => Promise<void> }) {
  const cards = [
    ['SMS:PENDING', 'پیامک در انتظار'],
    ['SMS:SENT', 'پیامک ارسال‌شده'],
    ['SMS:FAILED', 'پیامک ناموفق'],
    ['IN_APP:SENT', 'اعلان داخل پنل'],
  ] as const;
  return <section className="stack"><div><h2>اخطارهای تمدید اشتراک</h2><p className="muted">وضعیت اجرای سیاست تمدید پلن‌های پولی و پایان دوره‌های آزمایشی.</p></div><div className={`message ${delivery.liveReady ? 'message-success' : 'message-error'}`}>{delivery.liveReady ? `ارسال واقعی پیامک فعال است؛ بازه ارسال ${delivery.deliveryWindow}.` : !delivery.enabled ? 'ارسال پیامک تمدید غیرفعال است؛ اعلان‌های داخل پنل همچنان اجرا می‌شوند.' : delivery.provider !== 'SMSIR' ? 'ارسال پیامک در حالت آزمایشی است و پیام واقعی ارسال نمی‌شود.' : 'برای فعال‌شدن ارسال واقعی، همه شناسه‌های قالب تمدید و دوره آزمایشی SMS.ir را تکمیل کنید.'}</div><div className="dashboard-grid">{cards.map(([key, label]) => <article className="card billing-summary-card" key={key}><span>{label}</span><strong>{(summary[key] ?? 0).toLocaleString('fa-IR')}</strong></article>)}</div>{items.length === 0 && <div className="card">هنوز اخطار تمدیدی ایجاد نشده است.</div>}{items.map((item) => <article className="card admin-card-title" key={item.id}><div><div className="eyebrow">{item.channel === 'SMS' ? 'پیامک' : item.channel === 'IN_APP' ? 'اعلان داخل پنل' : 'ایمیل'} · {reminderOffsetLabel(item.offsetDays)}</div><h3>{item.subscription.organization.displayName || item.subscription.organization.legalName}</h3><p>{item.subscription.plan.nameFa} · زمان برنامه‌ریزی: {new Date(item.scheduledAt).toLocaleString('fa-IR')}</p>{item.failureReason && <p className="message message-error">علت ناموفق: {item.failureReason}</p>}</div><div><span className={`status-badge ${statusClass(item.status)}`}>{reminderStatusLabel(item.status)}</span>{item.sentAt && <p>ارسال: {new Date(item.sentAt).toLocaleString('fa-IR')}</p>}{item.channel === 'SMS' && item.status === 'FAILED' && <button className="button button-secondary" type="button" disabled={Boolean(retryingId)} onClick={() => void onRetry(item)}>{retryingId === item.id ? 'در حال ثبت…' : 'ارسال مجدد در ساعت مجاز'}</button>}</div></article>)}</section>;
}

function statusClass(status: string): string { return ['ACTIVE', 'SUCCEEDED', 'VERIFIED'].includes(status) ? 'status-active' : ['FAILED', 'SUSPENDED', 'EXPIRED'].includes(status) ? 'status-suspended' : 'severity-medium'; }
function subscriptionStatusLabel(status: string): string { return ({ DRAFT: 'پیش‌نویس', ACTIVE: 'فعال', GRACE: 'مهلت تنفس', EXPIRED: 'منقضی', SUSPENDED: 'تعلیق‌شده', CANCELLED: 'لغوشده' } as Record<string, string>)[status] ?? status; }
function paymentStatusLabel(status: string): string { return ({ CREATED: 'ایجادشده', REDIRECT_PENDING: 'در انتظار بازگشت از درگاه', VERIFY_PENDING: 'در حال تأیید', SUCCEEDED: 'موفق', FAILED: 'ناموفق', CANCELLED: 'لغوشده' } as Record<string, string>)[status] ?? status; }
function reconciliationStatusLabel(status: Payment['reconciliationStatus']): string { return ({ NOT_CHECKED: 'بررسی‌نشده', MATCHED: 'منطبق', ACTION_REQUIRED: 'نیازمند اقدام', PROVIDER_UNCONFIRMED: 'تأییدنشده در درگاه' } as const)[status]; }
function resolutionLabel(resolution: PaymentResolution | null): string { return resolution ? ({ CUSTOMER_RETRY_REQUIRED: 'پرداخت مجدد مشتری', PROVIDER_SUPPORT_REQUIRED: 'پیگیری با درگاه', REFUND_REVIEW_REQUIRED: 'بررسی استرداد', NO_FINANCIAL_ACTION: 'بدون اقدام مالی' } as const)[resolution] : 'ثبت‌نشده'; }
function reminderStatusLabel(status: SubscriptionReminder['status']): string { return ({ PENDING: 'در انتظار', SENT: 'ارسال‌شده', FAILED: 'ناموفق', CANCELLED: 'لغوشده' } as const)[status]; }
function reminderOffsetLabel(offsetDays: number): string { return offsetDays < 0 ? `${Math.abs(offsetDays).toLocaleString('fa-IR')} روز پیش از انقضا` : offsetDays === 0 ? 'روز انقضا' : `${offsetDays.toLocaleString('fa-IR')} روز پس از انقضا`; }
function invoiceStatusLabel(status: BillingInvoice['status']): string { return ({ ISSUED: 'صادرشده', PAID: 'پرداخت‌شده', OVERDUE: 'سررسیدگذشته', CANCELLED: 'لغوشده' } as const)[status]; }
