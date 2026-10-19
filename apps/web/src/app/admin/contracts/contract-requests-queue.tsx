'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type ContractRequest = {
  id: string;
  code: string;
  status: 'REQUESTED' | 'UNDER_REVIEW' | 'TERMS_PREPARED' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  buyerNote: string | null;
  termsSummary: string | null;
  cancellationReason: string | null;
  requestedAt: string;
  rfq: { id: string; code: string; title: string };
  selectedQuotation: { id: string; code: string; finalAmountRial: string };
  buyerOrganization: { id: string; displayName: string };
  supplierOrganization: { id: string; displayName: string };
};

const statusLabels: Record<ContractRequest['status'], string> = {
  REQUESTED: 'جدید', UNDER_REVIEW: 'در حال بررسی', TERMS_PREPARED: 'در انتظار تأیید خریدار', ACCEPTED: 'تأیید خریدار', COMPLETED: 'تکمیل‌شده', CANCELLED: 'لغوشده',
};

function toman(value: string) {
  return `${(BigInt(value) / BigInt(10)).toLocaleString('fa-IR')} تومان`;
}

export function ContractRequestsQueue() {
  const [items, setItems] = useState<ContractRequest[]>([]);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => setItems(await apiRequest<ContractRequest[]>('/contracts/admin/requests')), []);

  useEffect(() => {
    let active = true;
    void apiRequest<ContractRequest[]>('/contracts/admin/requests')
      .then((data) => { if (active) setItems(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت صف درخواست‌های قرارداد انجام نشد.'); });
    return () => { active = false; };
  }, []);

  async function updateStatus(item: ContractRequest, status: 'UNDER_REVIEW' | 'TERMS_PREPARED' | 'COMPLETED' | 'CANCELLED') {
    const termsSummary = status === 'TERMS_PREPARED' ? window.prompt('خلاصه شرایط قابل مشاهده برای خریدار را وارد کنید:')?.trim() : undefined;
    const note = status === 'CANCELLED' ? window.prompt('دلیل لغو درخواست را وارد کنید:')?.trim() : undefined;
    if (status === 'TERMS_PREPARED' && !termsSummary) return;
    if (status === 'CANCELLED' && !note) return;
    setBusyId(item.id); setMessage(''); setError('');
    try {
      await apiRequest(`/contracts/admin/requests/${item.id}/status`, { method: 'PUT', body: JSON.stringify({ status, termsSummary, note }) });
      setMessage(status === 'UNDER_REVIEW' ? 'بررسی درخواست آغاز شد.' : status === 'TERMS_PREPARED' ? 'شرایط برای تأیید خریدار ارسال شد.' : status === 'COMPLETED' ? 'فرایند هماهنگی قرارداد تکمیل شد.' : 'درخواست لغو شد.');
      await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'تغییر وضعیت انجام نشد.'); }
    finally { setBusyId(''); }
  }

  return <div className="stack">
    {error && <div className="message message-error">{error}</div>}
    {message && <div className="message message-success">{message}</div>}
    {items.length === 0 && <div className="card">درخواست قراردادی وجود ندارد.</div>}
    {items.map((item) => <article className="card" key={item.id}>
      <div className="eyebrow">{statusLabels[item.status]} · {item.code}</div>
      <h2>{item.rfq.title}</h2>
      <p>استعلام: {item.rfq.code} · پیشنهاد: {item.selectedQuotation.code} · مبلغ: <strong>{toman(item.selectedQuotation.finalAmountRial)}</strong></p>
      <p>خریدار: {item.buyerOrganization.displayName} · فروشنده: {item.supplierOrganization.displayName}</p>
      {item.buyerNote && <p>یادداشت خریدار: {item.buyerNote}</p>}
      {item.termsSummary && <div className="message"><strong>خلاصه شرایط:</strong><br />{item.termsSummary}</div>}
      {item.cancellationReason && <p className="message message-error">دلیل لغو: {item.cancellationReason}</p>}
      <div className="actions">
        {item.status === 'REQUESTED' && <button className="button button-primary" disabled={busyId === item.id} onClick={() => void updateStatus(item, 'UNDER_REVIEW')}>شروع بررسی</button>}
        {item.status === 'UNDER_REVIEW' && <button className="button button-primary" disabled={busyId === item.id} onClick={() => void updateStatus(item, 'TERMS_PREPARED')}>ثبت و ارسال شرایط</button>}
        {item.status === 'ACCEPTED' && <button className="button button-primary" disabled={busyId === item.id} onClick={() => void updateStatus(item, 'COMPLETED')}>ثبت تکمیل هماهنگی</button>}
        {['REQUESTED', 'UNDER_REVIEW', 'TERMS_PREPARED'].includes(item.status) && <button className="button button-secondary" disabled={busyId === item.id} onClick={() => void updateStatus(item, 'CANCELLED')}>لغو با ثبت دلیل</button>}
      </div>
    </article>)}
  </div>;
}
