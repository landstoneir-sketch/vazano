'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import { ticketCategoryLabels, ticketStatusLabels, ticketTypeLabels } from '../support-labels';

type TicketComment = { id: string; body: string; isInternal: boolean; createdAt: string; author: { firstName: string | null; lastName: string | null } };
type Ticket = {
  id: string; code: string; type: string; category: string; priority: string; status: string;
  subject: string; description: string; resolution: string | null; createdAt: string; comments: TicketComment[];
};
type Attachment = { id: string; status: string; originalName: string; sizeBytes: number; uploadedAt: string | null };

const dateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' });

export function SupportTicketDetail({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [ticketData, attachmentData] = await Promise.all([
      apiRequest<Ticket>(`/support/tickets/${ticketId}`),
      apiRequest<Attachment[]>(`/attachments/support-tickets/${ticketId}`),
    ]);
    setTicket(ticketData); setAttachments(attachmentData);
  }, [ticketId]);
  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<Ticket>(`/support/tickets/${ticketId}`),
      apiRequest<Attachment[]>(`/attachments/support-tickets/${ticketId}`),
    ]).then(([ticketData, attachmentData]) => { if (active) { setTicket(ticketData); setAttachments(attachmentData); } }).catch((reason: unknown) => {
      if (active) setMessage(reason instanceof Error ? reason.message : 'دریافت تیکت انجام نشد.');
    });
    return () => { active = false; };
  }, [ticketId]);

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await apiRequest(`/support/tickets/${ticketId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
      setBody(''); setMessage('پاسخ شما ثبت شد.'); await load();
    } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : 'ثبت پاسخ انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function openAttachment(attachmentId: string) {
    setMessage('');
    try {
      const result = await apiRequest<{ url: string }>(`/attachments/${attachmentId}/download-url`);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : 'دریافت فایل انجام نشد.'); }
  }

  if (!ticket) return <div className="card">{message || 'در حال دریافت…'}</div>;
  const closed = ['CLOSED', 'REJECTED'].includes(ticket.status);
  return <div className="stack">
    <header><div className="eyebrow">{ticket.code}</div><h1>{ticket.subject}</h1><p className="muted">{ticketTypeLabels[ticket.type] ?? ticket.type} · {ticketCategoryLabels[ticket.category] ?? ticket.category} · اولویت {ticket.priority}</p></header>
    {message && <div className="message">{message}</div>}
    <article className="card"><strong>وضعیت: {ticketStatusLabels[ticket.status] ?? ticket.status}</strong><p>{ticket.description}</p>{ticket.resolution && <div className="message message-success"><strong>نتیجه رسیدگی:</strong> {ticket.resolution}</div>}</article>
    {attachments.length > 0 && <section><h2>پیوست‌های درخواست</h2><div className="stack">{attachments.map((attachment) => <article className="card list-card" key={attachment.id}><div><strong>{attachment.originalName}</strong><p className="muted">{attachment.status === 'READY' ? 'بررسی امنیتی شده' : 'در حال بررسی امنیتی'} · {Math.ceil(attachment.sizeBytes / 1024).toLocaleString('fa-IR')} کیلوبایت</p></div><button className="button button-secondary" type="button" disabled={attachment.status !== 'READY'} onClick={() => void openAttachment(attachment.id)}>مشاهده فایل</button></article>)}</div></section>}
    <section><h2>تاریخچه پاسخ‌ها</h2><div className="stack">{ticket.comments.length === 0 && <div className="card">هنوز پاسخی ثبت نشده است.</div>}{ticket.comments.map((comment) => <article className="card support-comment" key={comment.id}><strong>{[comment.author.firstName, comment.author.lastName].filter(Boolean).join(' ') || 'کاربر وازانو'}</strong><p>{comment.body}</p><time className="muted" dateTime={comment.createdAt}>{dateFormatter.format(new Date(comment.createdAt))}</time></article>)}</div></section>
    {!closed && <form className="card" onSubmit={reply}><label className="form-field"><span>پاسخ یا توضیح تکمیلی</span><textarea rows={4} maxLength={3000} value={body} onChange={(event) => setBody(event.target.value)} required /></label><button className="button button-primary" disabled={busy}>{busy ? 'در حال ثبت…' : 'ثبت پاسخ'}</button></form>}
  </div>;
}
