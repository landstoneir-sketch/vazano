'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type Rfq = {
  id: string;
  code: string;
  title: string;
  lifecycleState: string;
  operationalStatus: string;
  approvalStatus: string;
  createdAt: string;
  _count: { quotations: number };
};

const operationalStatusLabels: Record<string, string> = {
  DRAFT_INCOMPLETE: 'پیش‌نویس ناقص',
  NEEDS_CHANGES: 'نیازمند اصلاح',
  UNDER_REVIEW: 'در حال بررسی',
  WAITING_COMMITMENT: 'در انتظار تکمیل تعهد',
  READY_TO_PUBLISH: 'آماده انتشار',
  PUBLISHED: 'منتشرشده',
  RECEIVING_QUOTES: 'در حال دریافت پیشنهاد',
  COMPLETED: 'تکمیل‌شده',
  CLOSED: 'بسته‌شده',
  CANCELLED: 'لغوشده',
  EXPIRED: 'منقضی‌شده',
};

const approvalStatusLabels: Record<string, string> = {
  NOT_SUBMITTED: 'هنوز ارسال نشده',
  NOT_REQUIRED: 'بدون نیاز به تأیید',
  PENDING: 'در انتظار تأیید',
  NEEDS_CHANGES: 'نیازمند اصلاح',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
};

const ACTION_STATUSES = ['DRAFT_INCOMPLETE', 'NEEDS_CHANGES'];
const ACTIVE_STATUSES = ['UNDER_REVIEW', 'WAITING_COMMITMENT', 'READY_TO_PUBLISH', 'PUBLISHED', 'RECEIVING_QUOTES'];

export function RfqList() {
  const [items, setItems] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void apiRequest<Rfq[]>('/rfqs/mine').then((data) => { if (active) setItems(data); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت استعلام‌ها انجام نشد.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const actionCount = items.filter((item) => ACTION_STATUSES.includes(item.operationalStatus)).length;
  const quoteCount = items.filter((item) => item._count.quotations > 0).length;
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fa-IR');
    return items.filter((item) => {
      const matchesQuery = !normalizedQuery || `${item.title} ${item.code}`.toLocaleLowerCase('fa-IR').includes(normalizedQuery);
      const matchesFilter = filter === 'ALL'
        || (filter === 'ACTION' && ACTION_STATUSES.includes(item.operationalStatus))
        || (filter === 'ACTIVE' && ACTIVE_STATUSES.includes(item.operationalStatus))
        || (filter === 'QUOTES' && item._count.quotations > 0)
        || (filter === 'CLOSED' && ['CLOSED', 'CANCELLED', 'EXPIRED'].includes(item.operationalStatus));
      return matchesQuery && matchesFilter;
    });
  }, [filter, items, query]);

  return <div className="stack rfq-list-workspace">
    {error && <div className="message message-error" role="alert">{error}</div>}
    {!loading && items.length > 0 && <div className="rfq-list-summary" aria-label="خلاصه استعلام‌ها">
      <div><span>کل استعلام‌ها</span><strong>{items.length.toLocaleString('fa-IR')}</strong></div>
      <div className={actionCount > 0 ? 'needs-attention' : ''}><span>نیازمند اقدام شما</span><strong>{actionCount.toLocaleString('fa-IR')}</strong></div>
      <div><span>دارای پیشنهاد قیمت</span><strong>{quoteCount.toLocaleString('fa-IR')}</strong></div>
    </div>}
    {!loading && items.length > 0 && <div className="rfq-list-toolbar" role="search">
      <label className="form-field"><span>جست‌وجو</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="عنوان یا کد استعلام" /></label>
      <label className="form-field"><span>نمایش</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">همه استعلام‌ها</option><option value="ACTION">نیازمند اقدام من</option><option value="ACTIVE">در جریان</option><option value="QUOTES">دارای پیشنهاد قیمت</option><option value="CLOSED">پایان‌یافته</option></select></label>
      <span className="rfq-filter-result">{filteredItems.length.toLocaleString('fa-IR')} نتیجه</span>
    </div>}
    {loading && <div className="card dashboard-loading" role="status">در حال دریافت استعلام‌های شما…</div>}
    {!loading && items.length === 0 && !error && <div className="card empty-state rfq-empty-state"><div><strong>هنوز استعلامی ثبت نکرده‌اید</strong><p>برای دریافت چند پیشنهاد قابل مقایسه، نیاز خرید خود را ثبت کنید.</p><Link className="button button-primary" href="/dashboard/rfqs/new">ثبت اولین استعلام</Link></div></div>}
    {!loading && items.length > 0 && filteredItems.length === 0 && <div className="card empty-state">استعلامی با این جست‌وجو یا فیلتر پیدا نشد.</div>}
    {filteredItems.map((rfq) => {
      const needsAction = ACTION_STATUSES.includes(rfq.operationalStatus);
      const hasQuotes = rfq._count.quotations > 0;
      const primaryLabel = needsAction ? 'ادامه و تکمیل' : hasQuotes ? 'مشاهده پیشنهادها' : 'مشاهده جزئیات';
      const primaryHref = (needsAction ? `/dashboard/rfqs/new?edit=${rfq.id}` : `/dashboard/rfqs/${rfq.id}`) as Route;
      return <article className={`card list-card rfq-list-card ${needsAction ? 'rfq-needs-action' : ''}`} key={rfq.id}>
      <div><div className="eyebrow">{rfq.code}</div><h2>{rfq.title}</h2><div className="rfq-list-meta"><span className="status-badge">{operationalStatusLabels[rfq.operationalStatus] ?? rfq.operationalStatus}</span><span className="status-badge status-approval">{approvalStatusLabels[rfq.approvalStatus] ?? rfq.approvalStatus}</span><time dateTime={rfq.createdAt}>{new Date(rfq.createdAt).toLocaleDateString('fa-IR')}</time></div></div>
      <div className="list-card-actions"><span className={`count-badge ${hasQuotes ? 'has-quotes' : ''}`}>{rfq._count.quotations.toLocaleString('fa-IR')} پیشنهاد</span><Link className={`button ${needsAction || hasQuotes ? 'button-primary' : 'button-secondary'}`} href={primaryHref}>{primaryLabel}</Link>{needsAction && <Link className="text-link" href={`/dashboard/rfqs/${rfq.id}`}>مشاهده جزئیات</Link>}</div>
    </article>;
    })}
  </div>;
}
