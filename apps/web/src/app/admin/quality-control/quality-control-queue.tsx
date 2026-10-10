'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type QualityControlRequest = {
  id: string;
  status: 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  purchaseAmountRial: string | null;
  feeBps: number;
  feeAmountRial: string | null;
  requestedAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  rfq: { id: string; code: string; title: string; buyerOrganization: { id: string; displayName: string } };
  selectedQuotation: null | { id: string; code: string; supplierOrganization: { id: string; displayName: string } };
};

const statusLabels: Record<QualityControlRequest['status'], string> = {
  ACCEPTED: 'آماده شروع', IN_PROGRESS: 'در حال انجام', COMPLETED: 'تکمیل‌شده', CANCELLED: 'لغوشده',
};

function toman(value: string | null) {
  return value ? `${(BigInt(value) / BigInt(10)).toLocaleString('fa-IR')} تومان` : '—';
}

export function QualityControlQueue() {
  const [items, setItems] = useState<QualityControlRequest[]>([]);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setItems(await apiRequest<QualityControlRequest[]>('/quality-control/admin/requests'));
  }, []);

  useEffect(() => {
    let active = true;
    void apiRequest<QualityControlRequest[]>('/quality-control/admin/requests').then((data) => { if (active) setItems(data); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت صف کنترل کیفیت انجام نشد.'); });
    return () => { active = false; };
  }, []);

  async function updateStatus(item: QualityControlRequest, status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') {
    const note = status === 'CANCELLED' ? window.prompt('دلیل لغو درخواست را وارد کنید:')?.trim() : undefined;
    if (status === 'CANCELLED' && !note) return;
    setBusyId(item.id); setMessage(''); setError('');
    try {
      await apiRequest(`/quality-control/admin/requests/${item.id}/status`, { method: 'PUT', body: JSON.stringify({ status, note }) });
      setMessage(status === 'IN_PROGRESS' ? 'عملیات کنترل کیفیت آغاز شد.' : status === 'COMPLETED' ? 'عملیات کنترل کیفیت تکمیل شد.' : 'درخواست کنترل کیفیت لغو شد.');
      await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'تغییر وضعیت انجام نشد.'); }
    finally { setBusyId(''); }
  }

  return <div className="stack">{error && <div className="message message-error">{error}</div>}{message && <div className="message message-success">{message}</div>}{items.length === 0 && <div className="card">درخواست کنترل کیفیت عملیاتی وجود ندارد.</div>}{items.map((item) => <article className="card" key={item.id}><div className="eyebrow">{statusLabels[item.status]} · {item.rfq.code}</div><h2>{item.rfq.title}</h2><p>خریدار: {item.rfq.buyerOrganization.displayName} · فروشنده: {item.selectedQuotation?.supplierOrganization.displayName ?? '—'}</p><p>مبلغ خرید: <strong>{toman(item.purchaseAmountRial)}</strong> · کارمزد {(item.feeBps / 100).toLocaleString('fa-IR')}٪: <strong>{toman(item.feeAmountRial)}</strong></p><p className="muted">پیشنهاد منتخب: {item.selectedQuotation?.code ?? '—'} · تأیید خریدار: {item.acceptedAt ? new Date(item.acceptedAt).toLocaleDateString('fa-IR') : '—'}</p><div className="actions">{item.status === 'ACCEPTED' && <button className="button button-primary" disabled={busyId === item.id} onClick={() => void updateStatus(item, 'IN_PROGRESS')}>شروع کنترل کیفیت</button>}{item.status === 'IN_PROGRESS' && <button className="button button-primary" disabled={busyId === item.id} onClick={() => void updateStatus(item, 'COMPLETED')}>ثبت تکمیل خدمت</button>}{['ACCEPTED', 'IN_PROGRESS'].includes(item.status) && <button className="button button-secondary" disabled={busyId === item.id} onClick={() => void updateStatus(item, 'CANCELLED')}>لغو با ثبت دلیل</button>}</div></article>)}</div>;
}
