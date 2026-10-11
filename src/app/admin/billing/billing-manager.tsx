'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';

type BillingCycle = 'P1M' | 'P3M' | 'P6M' | 'P1Y' | 'CUSTOM';
type Plan = {
  id: string; code: string; nameFa: string; descriptionFa: string | null; billingCycle: BillingCycle; durationIso: string;
  priceRial: string; grantCredits: string; dailyProposalLimit: number; maxProposalLimit: number; taxIncluded: boolean;
  isPublic: boolean; isActive: boolean; version: number; entitlements: unknown;
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
};
type PaymentReceipt = {
  id: string; receiptNumber: string; amountRial: string; taxRial: string; providerReference: string | null; paidAt: string;
  organization: { displayName: string; legalName: string };
  subscription: null | { plan: { code: string; nameFa: string } };
  qualityControlRequest: null | { rfq: { code: string; title: string } };
};
type Overview = { summary: Record<string, number>; plans: Plan[]; subscriptions: Subscription[]; payments: Payment[]; receipts: PaymentReceipt[] };
type Tab = 'plans' | 'subscriptions' | 'payments' | 'receipts';
type ReconciliationResult = { payment: { reconciliationStatus: Payment['reconciliationStatus'] }; provider: { success: boolean; code: number; referenceId: string | null } };

type PlanDraft = {
  id?: string; code: string; nameFa: string; descriptionFa: string; billingCycle: BillingCycle; durationIso: string;
  priceToman: string; grantCredits: string; dailyProposalLimit: number; maxProposalLimit: number; taxIncluded: boolean;
  isPublic: boolean; isActive: boolean; canViewMatchedRfqs: boolean; version?: number; entitlements: Record<string, unknown>;
};

const emptyPlan: PlanDraft = {
  code: '', nameFa: '', descriptionFa: '', billingCycle: 'P1M', durationIso: 'P1M', priceToman: '', grantCredits: '0',
  dailyProposalLimit: 2, maxProposalLimit: 6, taxIncluded: false, isPublic: true, isActive: true, canViewMatchedRfqs: true, entitlements: {},
};

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
    version: plan.version, entitlements,
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
      const priceToman = BigInt(draft.priceToman || '0');
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
          ...editable, code: draft.code, billingCycle: draft.billingCycle, durationIso: draft.durationIso,
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

  if (!overview && !error) return <div className="card">در حال دریافت اطلاعات اشتراک و پرداخت…</div>;

  return <div className="stack">
    {error && <div className="message message-error">{error}</div>}{message && <div className="message message-success">{message}</div>}
    <div className="dashboard-grid">{statusCards.map(([status, label]) => <article className="card billing-summary-card" key={status}><span>{label}</span><strong>{(overview?.summary[status] ?? 0).toLocaleString('fa-IR')}</strong></article>)}</div>
    <div className="tab-list" role="tablist" aria-label="بخش مالی"><button className={tab === 'plans' ? 'tab-active' : ''} type="button" onClick={() => setTab('plans')}>پلن‌ها</button><button className={tab === 'subscriptions' ? 'tab-active' : ''} type="button" onClick={() => setTab('subscriptions')}>اشتراک‌ها</button><button className={tab === 'payments' ? 'tab-active' : ''} type="button" onClick={() => setTab('payments')}>پرداخت‌ها</button><button className={tab === 'receipts' ? 'tab-active' : ''} type="button" onClick={() => setTab('receipts')}>رسیدها</button></div>
    {tab === 'plans' && overview && <section className="card stack"><div className="admin-card-title"><div><h2>مدیریت پلن‌ها</h2><p>قیمت را به تومان وارد کنید؛ مبلغ در دیتابیس با واحد ریال و به‌صورت عدد صحیح ذخیره می‌شود.</p></div><button className="button button-secondary" type="button" onClick={() => { setDraft(emptyPlan); setError(''); setMessage(''); }}>پلن جدید</button></div><div className="content-item-list">{overview.plans.map((plan) => <button className={draft.id === plan.id ? 'content-item-active' : ''} type="button" key={plan.id} onClick={() => { setDraft(fromPlan(plan)); setError(''); setMessage(''); }}><strong>{plan.nameFa}</strong><span>{formatToman(plan.priceRial)} · {plan.isActive ? 'فعال' : 'غیرفعال'}</span></button>)}</div><PlanForm draft={draft} setDraft={setDraft} busy={busy} onSubmit={savePlan} /></section>}
    {tab === 'subscriptions' && overview && <SubscriptionList items={overview.subscriptions} />}
    {tab === 'payments' && overview && <PaymentList items={overview.payments} busyId={reconcilingPaymentId} onReconcile={reconcilePayment} />}
    {tab === 'receipts' && overview && <ReceiptList items={overview.receipts} />}
  </div>;
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
    <label className="form-field"><span>دوره صورتحساب</span><select value={draft.billingCycle} disabled={Boolean(draft.id)} onChange={(event) => applyCycle(event.target.value as BillingCycle)}><option value="P1M">یک‌ماهه</option><option value="P3M">سه‌ماهه</option><option value="P6M">شش‌ماهه</option><option value="P1Y">سالانه</option></select></label>
    <label className="form-field"><span>مبلغ (تومان)</span><input type="number" min="1" value={draft.priceToman} onChange={(event) => setDraft({ ...draft, priceToman: event.target.value })} required /></label>
    <label className="form-field"><span>اعتبار قابل مصرف</span><input type="number" min="0" value={draft.grantCredits} onChange={(event) => setDraft({ ...draft, grantCredits: event.target.value })} required /></label>
    <label className="form-field"><span>سقف پایه پیشنهاد روزانه</span><input type="number" min="0" value={draft.dailyProposalLimit} onChange={(event) => setDraft({ ...draft, dailyProposalLimit: Number(event.target.value) })} required /></label>
    <label className="form-field"><span>حداکثر سقف در کمبود عرضه</span><input type="number" min="0" value={draft.maxProposalLimit} onChange={(event) => setDraft({ ...draft, maxProposalLimit: Number(event.target.value) })} required /></label>
    <div className="full check-grid"><label className="check-field"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /><span>قابل خرید باشد</span></label><label className="check-field"><input type="checkbox" checked={draft.isPublic} onChange={(event) => setDraft({ ...draft, isPublic: event.target.checked })} /><span>در صفحه عمومی نمایش داده شود</span></label><label className="check-field"><input type="checkbox" checked={draft.canViewMatchedRfqs} onChange={(event) => setDraft({ ...draft, canViewMatchedRfqs: event.target.checked })} /><span>مشاهده استعلام‌های مرتبط</span></label><label className="check-field"><input type="checkbox" checked={draft.taxIncluded} onChange={(event) => setDraft({ ...draft, taxIncluded: event.target.checked })} /><span>مبلغ شامل مالیات است</span></label></div>
    <button className="button button-primary" disabled={busy}>{busy ? 'در حال ذخیره…' : draft.id ? 'ذخیره تغییرات پلن' : 'ایجاد پلن'}</button>
  </form>;
}

function SubscriptionList({ items }: { items: Subscription[] }) {
  return <section className="stack"><h2>آخرین اشتراک‌ها</h2>{items.length === 0 && <div className="card">هنوز اشتراکی ثبت نشده است.</div>}{items.map((item) => <article className="card admin-card-title" key={item.id}><div><div className="eyebrow">{item.plan.nameFa}</div><h3>{item.organization.displayName || item.organization.legalName}</h3><p>{formatToman(item.priceRialSnapshot)} · ثبت {new Date(item.createdAt).toLocaleDateString('fa-IR')}</p></div><div><span className={`status-badge ${statusClass(item.status)}`}>{subscriptionStatusLabel(item.status)}</span><p>{item.expiresAt ? `پایان: ${new Date(item.expiresAt).toLocaleDateString('fa-IR')}` : 'هنوز فعال نشده'}</p></div></article>)}</section>;
}

function PaymentList({ items, busyId, onReconcile }: { items: Payment[]; busyId: string; onReconcile: (payment: Payment) => Promise<void> }) {
  return <section className="stack"><h2>آخرین پرداخت‌ها</h2>{items.length === 0 && <div className="card">هنوز پرداختی ثبت نشده است.</div>}{items.map((item) => <article className="card admin-card-title" key={item.id}><div><div className="eyebrow">{item.provider} · {item.purpose}</div><h3>{item.payerOrganization?.displayName ?? item.payerOrganization?.legalName ?? 'پرداخت‌کننده بدون سازمان'}</h3><p>{formatToman(item.amountRial)} · {new Date(item.createdAt).toLocaleString('fa-IR')}</p><p className="muted">تطبیق: {reconciliationStatusLabel(item.reconciliationStatus)}{item.lastReconciledAt ? ` · ${new Date(item.lastReconciledAt).toLocaleString('fa-IR')}` : ''}</p></div><div><span className={`status-badge ${statusClass(item.status)}`}>{paymentStatusLabel(item.status)}</span>{item.providerReference && <p>پیگیری: {item.providerReference}</p>}{item.authority && <button className="button button-secondary" type="button" disabled={Boolean(busyId)} onClick={() => void onReconcile(item)}>{busyId === item.id ? 'در حال استعلام…' : 'تطبیق با زرین‌پال'}</button>}</div></article>)}</section>;
}

function ReceiptList({ items }: { items: PaymentReceipt[] }) {
  return <section className="stack"><h2>رسیدهای قطعی پرداخت</h2>{items.length === 0 && <div className="card">هنوز رسید پرداختی صادر نشده است.</div>}{items.map((item) => <article className="card admin-card-title" key={item.id}><div><div className="eyebrow">{item.receiptNumber}</div><h3>{item.organization.displayName || item.organization.legalName}</h3><p>{item.subscription?.plan.nameFa ?? (item.qualityControlRequest ? `کنترل کیفیت ${item.qualityControlRequest.rfq.code}` : 'خدمت وازانو')} · {formatToman(item.amountRial)} · بدون مالیات</p></div><div><span className="status-badge status-active">پرداخت‌شده</span><p>{new Date(item.paidAt).toLocaleString('fa-IR')}</p>{item.providerReference && <p>پیگیری: {item.providerReference}</p>}<Link className="button button-secondary" href={`/dashboard/receipts/${item.id}` as Route}>مشاهده و چاپ</Link></div></article>)}</section>;
}

function statusClass(status: string): string { return ['ACTIVE', 'SUCCEEDED', 'VERIFIED'].includes(status) ? 'status-active' : ['FAILED', 'SUSPENDED', 'EXPIRED'].includes(status) ? 'status-suspended' : 'severity-medium'; }
function subscriptionStatusLabel(status: string): string { return ({ DRAFT: 'پیش‌نویس', ACTIVE: 'فعال', GRACE: 'مهلت تنفس', EXPIRED: 'منقضی', SUSPENDED: 'تعلیق‌شده', CANCELLED: 'لغوشده' } as Record<string, string>)[status] ?? status; }
function paymentStatusLabel(status: string): string { return ({ CREATED: 'ایجادشده', REDIRECT_PENDING: 'در انتظار بازگشت از درگاه', VERIFY_PENDING: 'در حال تأیید', SUCCEEDED: 'موفق', FAILED: 'ناموفق', CANCELLED: 'لغوشده' } as Record<string, string>)[status] ?? status; }
function reconciliationStatusLabel(status: Payment['reconciliationStatus']): string { return ({ NOT_CHECKED: 'بررسی‌نشده', MATCHED: 'منطبق', ACTION_REQUIRED: 'نیازمند اقدام', PROVIDER_UNCONFIRMED: 'تأییدنشده در درگاه' } as const)[status]; }
