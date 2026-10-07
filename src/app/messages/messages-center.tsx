'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Organization = { id: string; displayName: string };
type Thread = {
  id: string;
  status: 'OPEN' | 'CLOSED' | 'ARCHIVED';
  buyerOrganizationId: string;
  supplierOrganizationId: string;
  lastMessageAt: string | null;
  rfq: { id: string; code: string; title: string };
  buyerOrganization: Organization;
  supplierOrganization: Organization;
  lastMessage: { id: string; body: string; senderUserId: string; createdAt: string } | null;
  unreadCount: number;
};
type Message = {
  id: string;
  kind: 'USER' | 'SYSTEM';
  body: string;
  senderUserId: string;
  senderOrganizationId: string;
  createdAt: string;
  sender: { firstName: string | null; lastName: string | null };
  senderOrganization: Organization;
};

const dateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});

export function MessagesCenter({
  initialThreadId,
  rfqId,
  supplierOrganizationId,
}: {
  initialThreadId?: string;
  rfqId?: string;
  supplierOrganizationId?: string;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState(initialThreadId ?? '');
  const [senderOrganizationId, setSenderOrganizationId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const participantOrganizations = useMemo(() => {
    if (!selectedThread) return [];
    return organizations.filter((organization) => (
      organization.id === selectedThread.buyerOrganizationId
      || organization.id === selectedThread.supplierOrganizationId
    ));
  }, [organizations, selectedThread]);
  const effectiveSenderOrganizationId = participantOrganizations.some((organization) => organization.id === senderOrganizationId)
    ? senderOrganizationId
    : (participantOrganizations[0]?.id ?? '');

  const loadThreads = useCallback(async (preferredThreadId?: string) => {
    const data = await apiRequest<Thread[]>('/messages/threads');
    setThreads(data);
    setSelectedThreadId((current) => {
      const preferred = preferredThreadId ?? current;
      return data.some((thread) => thread.id === preferred) ? preferred : (data[0]?.id ?? '');
    });
    return data;
  }, []);

  const loadMessages = useCallback(async (threadId: string) => {
    const data = await apiRequest<Message[]>(`/messages/threads/${threadId}/messages`);
    setMessages(data);
    await apiRequest(`/messages/threads/${threadId}/read`, { method: 'PUT' });
    setThreads((current) => current.map((thread) => (
      thread.id === threadId ? { ...thread, unreadCount: 0 } : thread
    )));
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const organizationData = await apiRequest<Organization[]>('/organizations/mine');
        if (!active) return;
        setOrganizations(organizationData);
        let preferredThreadId = initialThreadId;
        if (rfqId && supplierOrganizationId) {
          const thread = await apiRequest<Thread>('/messages/threads', {
            method: 'POST',
            body: JSON.stringify({ rfqId, supplierOrganizationId }),
          });
          preferredThreadId = thread.id;
        }
        const threadData = await loadThreads(preferredThreadId);
        const selectedId = threadData.some((thread) => thread.id === preferredThreadId)
          ? preferredThreadId
          : threadData[0]?.id;
        if (selectedId) await loadMessages(selectedId);
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : 'دریافت گفت‌وگوها انجام نشد.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialize();
    return () => { active = false; };
  }, [initialThreadId, loadMessages, loadThreads, rfqId, supplierOrganizationId]);

  function selectThread(threadId: string) {
    setSelectedThreadId(threadId);
    setError('');
    void loadMessages(threadId).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'دریافت پیام‌ها انجام نشد.');
    });
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedThread || !effectiveSenderOrganizationId || !body.trim()) return;
    setSending(true); setError('');
    try {
      await apiRequest(`/messages/threads/${selectedThread.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ senderOrganizationId: effectiveSenderOrganizationId, body }),
      });
      setBody('');
      await Promise.all([loadMessages(selectedThread.id), loadThreads(selectedThread.id)]);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'ارسال پیام انجام نشد.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="message-center">
      <aside className="message-thread-list" aria-label="فهرست گفت‌وگوها">
        <div className="message-panel-header">
          <strong>گفت‌وگوها</strong>
          <button className="button button-secondary" type="button" onClick={() => void loadThreads()} disabled={loading}>به‌روزرسانی</button>
        </div>
        {loading && <p className="muted">در حال دریافت…</p>}
        {!loading && threads.length === 0 && <p className="muted">هنوز گفت‌وگویی آغاز نشده است.</p>}
        {threads.map((thread) => (
          <button
            className={`thread-button${thread.id === selectedThreadId ? ' thread-button-active' : ''}`}
            key={thread.id}
            type="button"
            onClick={() => selectThread(thread.id)}
          >
            <span><strong>{thread.rfq.code}</strong>{thread.unreadCount > 0 && <b className="count-badge">{thread.unreadCount.toLocaleString('fa-IR')}</b>}</span>
            <span>{thread.rfq.title}</span>
            <small>{thread.supplierOrganization.displayName}</small>
          </button>
        ))}
      </aside>

      <section className="message-conversation" aria-label="متن گفت‌وگو">
        {error && <div className="message message-error">{error}</div>}
        {!selectedThread && !loading && <div className="empty-conversation">از صفحه استعلام یا فرصت فروش، گفت‌وگو با طرف مقابل را آغاز کنید.</div>}
        {selectedThread && <>
          <div className="conversation-header">
            <div><div className="eyebrow">{selectedThread.rfq.code}</div><h2>{selectedThread.rfq.title}</h2></div>
            <span className="muted">{selectedThread.buyerOrganization.displayName} ↔ {selectedThread.supplierOrganization.displayName}</span>
          </div>
          <div className="message-stream" aria-live="polite">
            {messages.length === 0 && <p className="muted">اولین پیام را درباره این استعلام ارسال کنید.</p>}
            {messages.map((item) => {
              const sameSide = item.senderOrganizationId === effectiveSenderOrganizationId;
              const senderName = [item.sender.firstName, item.sender.lastName].filter(Boolean).join(' ') || item.senderOrganization.displayName;
              return <article className={`message-bubble${sameSide ? ' message-bubble-own' : ''}`} key={item.id}>
                <strong>{senderName}</strong>
                <p>{item.body}</p>
                <time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time>
              </article>;
            })}
          </div>
          <form className="message-composer" onSubmit={send}>
            {participantOrganizations.length > 1 && <label className="form-field"><span>ارسال از طرف</span><select value={effectiveSenderOrganizationId} onChange={(event) => setSenderOrganizationId(event.target.value)}>{participantOrganizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.displayName}</option>)}</select></label>}
            <label className="form-field"><span>متن پیام</span><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={3} required /></label>
            <div className="composer-actions"><span className="muted">{body.length.toLocaleString('fa-IR')} از ۲۰۰۰ نویسه</span><button className="button button-primary" disabled={sending || !effectiveSenderOrganizationId}>{sending ? 'در حال ارسال…' : 'ارسال پیام'}</button></div>
          </form>
        </>}
      </section>
    </div>
  );
}
