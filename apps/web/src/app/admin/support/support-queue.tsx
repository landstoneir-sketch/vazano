'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import { ticketStatusLabels, ticketTypeLabels } from '../../support/support-labels';

type Ticket = {
  id: string; code: string; type: string; priority: string; status: string; subject: string; description: string;
  resolution: string | null; requester: { firstName: string | null; lastName: string | null; mobile: string };
  organization: { displayName: string } | null; subjectOrganization: { displayName: string } | null; _count: { comments: number };
};

const statusOptions = Object.keys(ticketStatusLabels);
const priorityOptions = ['P1', 'P2', 'P3', 'P4'];

export function SupportQueue() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => setTickets(await apiRequest<Ticket[]>('/support/tickets/admin/queue')), []);

  useEffect(() => {
    let active = true;
    void apiRequest<Ticket[]>('/support/tickets/admin/queue').then((data) => { if (active) setTickets(data); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت صف پشتیبانی انجام نشد.');
    });
    return () => { active = false; };
  }, []);

  return <div className="stack">{error && <div className="message message-error">{error}</div>}{tickets.length === 0 && !error && <div className="card">صف رسیدگی خالی است.</div>}{tickets.map((ticket) => <TicketEditor ticket={ticket} key={ticket.id} onSaved={load} />)}</div>;
}

function TicketEditor({ ticket, onSaved }: { ticket: Ticket; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [resolution, setResolution] = useState(ticket.resolution ?? '');
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMessage('');
    try {
      await apiRequest(`/support/tickets/admin/${ticket.id}`, { method: 'PUT', body: JSON.stringify({
        status, priority, resolution: resolution || undefined, comment: comment || undefined, isInternalComment: internal,
      }) });
      setComment(''); setMessage('تغییرات ذخیره شد.'); await onSaved();
    } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : 'ذخیره تغییرات انجام نشد.'); }
    finally { setBusy(false); }
  }

  const requesterName = [ticket.requester.firstName, ticket.requester.lastName].filter(Boolean).join(' ') || ticket.requester.mobile;
  return <article className="card support-admin-card">
    <div className="support-ticket-heading"><div><div className="eyebrow">{ticket.code} · {ticketTypeLabels[ticket.type] ?? ticket.type}</div><h2>{ticket.subject}</h2><p>{requesterName}{ticket.organization ? ` · ${ticket.organization.displayName}` : ''} · {ticket._count.comments.toLocaleString('fa-IR')} پاسخ</p></div><span className={`priority-badge priority-${ticket.priority.toLowerCase()}`}>{ticket.priority}</span></div>
    <p>{ticket.description}</p>{ticket.subjectOrganization && <p><strong>سازمان موضوع گزارش:</strong> {ticket.subjectOrganization.displayName}</p>}
    <div className="form-columns"><label className="form-field"><span>وضعیت</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{statusOptions.map((value) => <option value={value} key={value}>{ticketStatusLabels[value]}</option>)}</select></label><label className="form-field"><span>اولویت</span><select value={priority} onChange={(event) => setPriority(event.target.value)}>{priorityOptions.map((value) => <option value={value} key={value}>{value}</option>)}</select></label></div>
    <label className="form-field"><span>نتیجه رسیدگی</span><textarea rows={3} value={resolution} onChange={(event) => setResolution(event.target.value)} /></label>
    <label className="form-field"><span>پاسخ یا یادداشت این مرحله</span><textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
    <label className="check-field"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /><span>یادداشت فقط برای تیم وازانو باشد</span></label>
    <button className="button button-primary" type="button" onClick={() => void save()} disabled={busy}>{busy ? 'در حال ذخیره…' : 'ثبت رسیدگی'}</button>
    {message && <div className="message">{message}</div>}
  </article>;
}
