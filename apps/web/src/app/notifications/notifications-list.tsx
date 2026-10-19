'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type NotificationItem = {
  id: string;
  eventType: string;
  title: string;
  body: string;
  actionPath: string | null;
  readAt: string | null;
  createdAt: string;
};

const dateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});

export function NotificationsList() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<NotificationItem[]>('/notifications')
      .then((data) => { if (active) setItems(data); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'دریافت اعلان‌ها انجام نشد.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function markRead(notificationId: string): Promise<void> {
    const current = items.find((item) => item.id === notificationId);
    if (!current || current.readAt) return;
    setItems((existing) => existing.map((item) => item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item));
    try {
      await apiRequest(`/notifications/${notificationId}/read`, { method: 'PUT' });
    } catch (reason: unknown) {
      setItems((existing) => existing.map((item) => item.id === notificationId ? { ...item, readAt: null } : item));
      setError(reason instanceof Error ? reason.message : 'ثبت وضعیت اعلان انجام نشد.');
    }
  }

  async function markAllRead(): Promise<void> {
    const previous = items;
    const readAt = new Date().toISOString();
    setItems((existing) => existing.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
    try {
      await apiRequest('/notifications/read-all', { method: 'PUT' });
    } catch (reason: unknown) {
      setItems(previous);
      setError(reason instanceof Error ? reason.message : 'ثبت وضعیت اعلان‌ها انجام نشد.');
    }
  }

  const unreadCount = items.filter((item) => !item.readAt).length;

  return (
    <div className="stack">
      {error && <div className="message message-error">{error}</div>}
      <div className="notification-toolbar">
        <span>{unreadCount.toLocaleString('fa-IR')} اعلان خوانده‌نشده</span>
        <button className="button button-secondary" type="button" onClick={() => void markAllRead()} disabled={unreadCount === 0}>خواندن همه</button>
      </div>
      {loading && <div className="card">در حال دریافت اعلان‌ها…</div>}
      {!loading && items.length === 0 && !error && <div className="card">هنوز اعلانی برای شما ثبت نشده است.</div>}
      {items.map((item) => (
        <article className={`card notification-card${item.readAt ? '' : ' notification-unread'}`} key={item.id}>
          <div>
            <div className="notification-meta">
              {!item.readAt && <span className="unread-dot" aria-label="خوانده‌نشده" />}
              <time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time>
            </div>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </div>
          <div className="list-card-actions">
            {!item.readAt && <button className="button button-secondary" type="button" onClick={() => void markRead(item.id)}>خواندم</button>}
            {item.actionPath && <Link className="button button-primary" href={item.actionPath as Route} onClick={() => void markRead(item.id)}>مشاهده</Link>}
          </div>
        </article>
      ))}
    </div>
  );
}
