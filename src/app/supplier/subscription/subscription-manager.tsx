'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Organization = { id: string; kind: string; displayName: string; legalName: string; status: string; members: Array<{ role: string; status: string }> };
type Plan = { id: string; code: string; nameFa: string; descriptionFa: string | null; billingCycle: string; priceRial: string; grantCredits: string; dailyProposalLimit: number; maxProposalLimit: number };
type Subscription = { id: string; status: string; startsAt: string | null; expiresAt: string | null; graceEndsAt: string | null; createdAt: string; priceRialSnapshot: string; plan: Plan };
type PaymentReceipt = {
  id: string; receiptNumber: string; amountRial: string; taxRial: string; currency: string; providerReference: string | null; paidAt: string;
  subscription: { plan: { code: string; nameFa: string } };
};
type CheckoutResult = { paymentIntentId: string; subscriptionId: string; authority: string; redirectUrl: string };

function formatToman(rial: string): string {
  return `${(BigInt(rial) / BigInt(10)).toLocaleString('fa-IR')} تومان`;
}

export function SubscriptionManager({ paymentResult }: { paymentResult?: string }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [error, setError] = useState('');
  const [busyPlanId, setBusyPlanId] = useState('');

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
    ]).then(([subscriptionItems, receiptItems]) => {
      if (!active) return;
      setSubscriptions(subscriptionItems); setReceipts(receiptItems);
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت سوابق مالی انجام نشد.'); });
    return () => { active = false; };
  }, [organizationId]);

  useEffect(() => {
    if (paymentResult !== 'success') return;
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith('vazano:subscription-checkout:')) sessionStorage.removeItem(key);
    }
  }, [paymentResult]);

  const organization = organizations.find((item) => item.id === organizationId);
  const canPurchase = organization?.members.some((member) => member.status === 'ACTIVE' && member.role === 'SUPPLIER_OWNER') ?? false;
  const current = subscriptions.find((item) => ['ACTIVE', 'GRACE'].includes(item.status));

  async function checkout(plan: Plan) {
    if (!organizationId) return;
    setBusyPlanId(plan.id); setError('');
    try {
      const storageKey = `vazano:subscription-checkout:${organizationId}:${plan.id}`;
      let idempotencyKey = sessionStorage.getItem(storageKey);
      if (!idempotencyKey) {
        idempotencyKey = `subscription:${organizationId}:${plan.id}:${crypto.randomUUID()}`;
        sessionStorage.setItem(storageKey, idempotencyKey);
      }
      const result = await apiRequest<CheckoutResult>(`/subscriptions/organizations/${organizationId}/checkout`, {
        method: 'POST', body: JSON.stringify({ planId: plan.id, idempotencyKey }),
      });
      window.location.assign(result.redirectUrl);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'شروع پرداخت انجام نشد.'); setBusyPlanId('');
    }
  }

  return <div className="stack">
    {paymentResult === 'success' && <div className="message message-success">پرداخت با موفقیت تأیید شد و اشتراک شما فعال است.</div>}
    {paymentResult === 'cancelled' && <div className="message message-error">پرداخت لغو شد و مبلغی از حساب شما کسر نشده است.</div>}
    {paymentResult === 'failed' && <div className="message message-error">تأیید پرداخت انجام نشد. در صورت کسر وجه، وضعیت تراکنش را با پشتیبانی پیگیری کنید.</div>}
    {error && <div className="message message-error">{error}</div>}
    {organizations.length === 0 && !error && <div className="card">برای خرید اشتراک، ابتدا یک حساب فروشنده ایجاد و تأیید کنید.</div>}
    {organizations.length > 0 && <label className="form-field card"><span>حساب فروشنده</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.map((item) => <option value={item.id} key={item.id}>{item.displayName} · {item.status}</option>)}</select></label>}
    {organization && <section className="card"><h2>وضعیت فعلی</h2>{current ? <div className="subscription-status"><span className={`status-badge ${current.status === 'ACTIVE' ? 'status-active' : 'severity-medium'}`}>{current.status === 'ACTIVE' ? 'فعال' : 'مهلت تنفس'}</span><strong>{current.plan.nameFa}</strong><span>{current.expiresAt ? `تا ${new Date(current.expiresAt).toLocaleDateString('fa-IR')}` : ''}</span></div> : <p className="muted">اشتراک فعال وجود ندارد. سوابق حساب حذف نشده و با خرید پلن دوباره فعال می‌شود.</p>}{!canPurchase && <div className="message">فقط مالک حساب فروشنده می‌تواند خرید یا تمدید اشتراک را انجام دهد.</div>}</section>}
    {organization && <section><h2>انتخاب پلن</h2><div className="plan-grid">{plans.map((plan) => <article className="card plan-card" key={plan.id}><h3>{plan.nameFa}</h3><strong>{formatToman(plan.priceRial)}</strong><p>{plan.descriptionFa || `${BigInt(plan.grantCredits).toLocaleString('fa-IR')} اعتبار قابل مصرف`}</p><p>سقف پایه روزانه: {plan.dailyProposalLimit.toLocaleString('fa-IR')} پیشنهاد</p><button className="button button-primary" type="button" disabled={!canPurchase || Boolean(busyPlanId)} onClick={() => void checkout(plan)}>{busyPlanId === plan.id ? 'در حال اتصال به زرین‌پال…' : current ? 'تمدید با این پلن' : 'خرید این پلن'}</button></article>)}</div></section>}
    {receipts.length > 0 && <section className="stack"><h2>رسیدهای پرداخت</h2>{receipts.map((receipt) => <article className="card admin-card-title" key={receipt.id}><div><div className="eyebrow">رسید {receipt.receiptNumber}</div><h3>{receipt.subscription.plan.nameFa}</h3><p>{formatToman(receipt.amountRial)} · بدون مالیات · {new Date(receipt.paidAt).toLocaleString('fa-IR')}</p></div><div><span className="status-badge status-active">پرداخت‌شده</span>{receipt.providerReference && <p>پیگیری درگاه: {receipt.providerReference}</p>}<Link className="button button-secondary" href={`/dashboard/receipts/${receipt.id}` as Route}>مشاهده و چاپ</Link></div></article>)}</section>}
    {subscriptions.length > 0 && <section className="stack"><h2>سوابق اشتراک</h2>{subscriptions.map((item) => <article className="card list-card" key={item.id}><div><strong>{item.plan.nameFa}</strong><p>{formatToman(item.priceRialSnapshot)} · ثبت {new Date(item.createdAt).toLocaleDateString('fa-IR')}</p></div><span className={`status-badge ${item.status === 'ACTIVE' ? 'status-active' : item.status === 'EXPIRED' ? 'status-suspended' : 'severity-medium'}`}>{subscriptionLabel(item.status)}</span></article>)}</section>}
  </div>;
}

function subscriptionLabel(status: string): string {
  return ({ DRAFT: 'در انتظار پرداخت', ACTIVE: 'فعال', GRACE: 'مهلت تنفس', EXPIRED: 'منقضی', SUSPENDED: 'تعلیق‌شده', CANCELLED: 'لغوشده' } as Record<string, string>)[status] ?? status;
}
