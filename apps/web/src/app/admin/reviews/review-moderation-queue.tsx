'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Review = {
  id: string; rating: number; comment: string | null; status: 'PUBLISHED' | 'HIDDEN'; moderationReason: string | null; createdAt: string;
  rfq: { code: string; title: string };
  buyerOrganization: { displayName: string };
  supplierOrganization: { displayName: string };
  createdBy: { firstName: string | null; lastName: string | null; mobile: string };
};

export function ReviewModerationQueue() {
  const [items, setItems] = useState<Review[]>([]);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setItems(await apiRequest<Review[]>('/reviews/admin/moderation')); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'دریافت امتیازها انجام نشد.'); }
  }, []);

  useEffect(() => {
    let active = true;
    void apiRequest<Review[]>('/reviews/admin/moderation')
      .then((data) => { if (active) setItems(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت امتیازها انجام نشد.'); });
    return () => { active = false; };
  }, []);

  async function moderate(event: FormEvent, review: Review, status: Review['status'], reason?: string) {
    event.preventDefault(); setBusyId(review.id); setError(''); setMessage('');
    try {
      await apiRequest(`/reviews/admin/${review.id}`, { method: 'PUT', body: JSON.stringify({ status, ...(reason?.trim() ? { reason: reason.trim() } : {}) }) });
      setMessage(status === 'HIDDEN' ? 'امتیاز با ثبت دلیل پنهان شد.' : 'امتیاز دوباره منتشر شد.');
      await load();
    } catch (reasonValue: unknown) { setError(reasonValue instanceof Error ? reasonValue.message : 'تغییر وضعیت امتیاز انجام نشد.'); }
    finally { setBusyId(''); }
  }

  return <div className="stack">{error && <div className="message message-error">{error}</div>}{message && <div className="message message-success">{message}</div>}{items.length === 0 && !error && <div className="card">هنوز امتیازی ثبت نشده است.</div>}{items.map((review) => <ReviewCard key={review.id} review={review} busy={busyId === review.id} onModerate={moderate} />)}</div>;
}

function ReviewCard({ review, busy, onModerate }: { review: Review; busy: boolean; onModerate: (event: FormEvent, review: Review, status: Review['status'], reason?: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const author = [review.createdBy.firstName, review.createdBy.lastName].filter(Boolean).join(' ') || review.createdBy.mobile;
  return <article className="card stack"><div className="admin-card-title"><div><div className="eyebrow">{review.rfq.code} · {new Date(review.createdAt).toLocaleDateString('fa-IR')}</div><h2>{review.supplierOrganization.displayName}</h2><p>خریدار: {review.buyerOrganization.displayName} · ثبت‌کننده: {author}</p></div><div><div className="price" aria-label={`${review.rating} از ۵`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div><span className={`status-badge ${review.status === 'PUBLISHED' ? 'status-active' : 'status-suspended'}`}>{review.status === 'PUBLISHED' ? 'منتشرشده' : 'پنهان'}</span></div></div><p><strong>{review.rfq.title}</strong></p><p>{review.comment ?? 'بدون توضیح متنی'}</p>{review.moderationReason && <div className="message">دلیل آخرین تعدیل: {review.moderationReason}</div>}{review.status === 'PUBLISHED' ? <form className="payment-resolution-form" onSubmit={(event) => void onModerate(event, review, 'HIDDEN', reason)}><label className="form-field"><span>دلیل پنهان‌سازی</span><textarea minLength={10} maxLength={1000} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} required /></label><button className="button button-secondary" disabled={busy}>{busy ? 'در حال ثبت…' : 'پنهان‌کردن امتیاز'}</button></form> : <form onSubmit={(event) => void onModerate(event, review, 'PUBLISHED')}><button className="button button-primary" disabled={busy}>{busy ? 'در حال ثبت…' : 'انتشار دوباره'}</button></form>}</article>;
}
