'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type PageStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type CmsPage = { id: string; slug: string; titleFa: string; excerptFa: string | null; bodyFa: string; seoTitleFa: string | null; seoDescriptionFa: string | null; status: PageStatus; version: number; updatedAt: string };
type Faq = { id: string; questionFa: string; answerFa: string; category: string | null; sortOrder: number; isPublished: boolean; version: number };
type PageDraft = Omit<CmsPage, 'id' | 'updatedAt'> & { id?: string };

const emptyPage: PageDraft = { slug: '', titleFa: '', excerptFa: null, bodyFa: '', seoTitleFa: null, seoDescriptionFa: null, status: 'DRAFT', version: 1 };

export function ContentManager() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [pageDraft, setPageDraft] = useState<PageDraft>(emptyPage);
  const [newFaq, setNewFaq] = useState({ questionFa: '', answerFa: '', category: '', sortOrder: 0, isPublished: false });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [pageItems, faqItems] = await Promise.all([apiRequest<CmsPage[]>('/admin/content/pages'), apiRequest<Faq[]>('/admin/content/faqs')]);
      setPages(pageItems); setFaqs(faqItems);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'دریافت محتوای مدیریتی انجام نشد.'); }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([apiRequest<CmsPage[]>('/admin/content/pages'), apiRequest<Faq[]>('/admin/content/faqs')]).then(([pageItems, faqItems]) => {
      if (active) { setPages(pageItems); setFaqs(faqItems); }
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت محتوای مدیریتی انجام نشد.'); });
    return () => { active = false; };
  }, []);

  async function savePage(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const body = { slug: pageDraft.slug, titleFa: pageDraft.titleFa, excerptFa: pageDraft.excerptFa || undefined, bodyFa: pageDraft.bodyFa, seoTitleFa: pageDraft.seoTitleFa || undefined, seoDescriptionFa: pageDraft.seoDescriptionFa || undefined, status: pageDraft.status, ...(pageDraft.id ? { expectedVersion: pageDraft.version } : {}) };
    try {
      await apiRequest(pageDraft.id ? `/admin/content/pages/${pageDraft.id}` : '/admin/content/pages', { method: pageDraft.id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setMessage('صفحه با موفقیت ذخیره شد.'); setPageDraft(emptyPage); await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'ذخیره صفحه انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function createFaq(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await apiRequest('/admin/content/faqs', { method: 'POST', body: JSON.stringify({ ...newFaq, category: newFaq.category || undefined }) });
      setNewFaq({ questionFa: '', answerFa: '', category: '', sortOrder: 0, isPublished: false });
      setMessage('پرسش متداول ایجاد شد.'); await load();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'ایجاد پرسش انجام نشد.'); }
    finally { setBusy(false); }
  }

  return <div className="stack">
    {error && <div className="message message-error">{error}</div>}{message && <div className="message message-success">{message}</div>}
    <section className="card stack"><div className="admin-card-title"><div><h2>صفحات عمومی</h2><p>ابتدا پیش‌نویس ذخیره کنید و پس از بازبینی وضعیت را «منتشرشده» قرار دهید.</p></div><button className="button button-secondary" type="button" onClick={() => setPageDraft(emptyPage)}>صفحه جدید</button></div><div className="content-item-list">{pages.map((page) => <button className={pageDraft.id === page.id ? 'content-item-active' : ''} type="button" key={page.id} onClick={() => setPageDraft(page)}><strong>{page.titleFa}</strong><span>/{page.slug} · {statusLabel(page.status)}</span></button>)}</div>
      <form className="form-grid" onSubmit={savePage}>
        <label className="form-field"><span>عنوان صفحه</span><input value={pageDraft.titleFa} onChange={(event) => setPageDraft({ ...pageDraft, titleFa: event.target.value })} required /></label>
        <label className="form-field"><span>نشانی لاتین</span><input dir="ltr" value={pageDraft.slug} onChange={(event) => setPageDraft({ ...pageDraft, slug: event.target.value.toLowerCase() })} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label>
        <label className="form-field full"><span>خلاصه</span><textarea rows={2} value={pageDraft.excerptFa ?? ''} onChange={(event) => setPageDraft({ ...pageDraft, excerptFa: event.target.value })} /></label>
        <label className="form-field full"><span>متن صفحه</span><textarea rows={10} value={pageDraft.bodyFa} onChange={(event) => setPageDraft({ ...pageDraft, bodyFa: event.target.value })} required /></label>
        <label className="form-field"><span>عنوان موتور جست‌وجو</span><input value={pageDraft.seoTitleFa ?? ''} onChange={(event) => setPageDraft({ ...pageDraft, seoTitleFa: event.target.value })} /></label>
        <label className="form-field"><span>وضعیت</span><select value={pageDraft.status} onChange={(event) => setPageDraft({ ...pageDraft, status: event.target.value as PageStatus })}><option value="DRAFT">پیش‌نویس</option><option value="PUBLISHED">منتشرشده</option><option value="ARCHIVED">بایگانی</option></select></label>
        <label className="form-field full"><span>توضیح موتور جست‌وجو</span><textarea rows={2} value={pageDraft.seoDescriptionFa ?? ''} onChange={(event) => setPageDraft({ ...pageDraft, seoDescriptionFa: event.target.value })} /></label>
        <button className="button button-primary" disabled={busy}>{busy ? 'در حال ذخیره…' : 'ذخیره صفحه'}</button>
      </form>
    </section>
    <section className="card stack"><div><h2>پرسش‌های متداول</h2><p>تنها موارد دارای وضعیت انتشار در صفحه عمومی نمایش داده می‌شوند.</p></div>{faqs.map((faq) => <FaqEditor item={faq} key={faq.id} onSaved={load} />)}
      <form className="form-grid cms-new-faq" onSubmit={createFaq}><h3>پرسش جدید</h3><label className="form-field full"><span>پرسش</span><input value={newFaq.questionFa} onChange={(event) => setNewFaq({ ...newFaq, questionFa: event.target.value })} required /></label><label className="form-field full"><span>پاسخ</span><textarea rows={4} value={newFaq.answerFa} onChange={(event) => setNewFaq({ ...newFaq, answerFa: event.target.value })} required /></label><label className="form-field"><span>گروه</span><input value={newFaq.category} onChange={(event) => setNewFaq({ ...newFaq, category: event.target.value })} /></label><label className="form-field"><span>ترتیب نمایش</span><input type="number" min="0" value={newFaq.sortOrder} onChange={(event) => setNewFaq({ ...newFaq, sortOrder: Number(event.target.value) })} /></label><label className="check-field full"><input type="checkbox" checked={newFaq.isPublished} onChange={(event) => setNewFaq({ ...newFaq, isPublished: event.target.checked })} /><span>هم‌اکنون منتشر شود</span></label><button className="button button-primary" disabled={busy}>ایجاد پرسش</button></form>
    </section>
  </div>;
}

function FaqEditor({ item, onSaved }: { item: Faq; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState(item);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save() { setBusy(true); setMessage(''); try { await apiRequest(`/admin/content/faqs/${item.id}`, { method: 'PUT', body: JSON.stringify({ questionFa: draft.questionFa, answerFa: draft.answerFa, category: draft.category || undefined, sortOrder: draft.sortOrder, isPublished: draft.isPublished, expectedVersion: item.version }) }); setMessage('ذخیره شد.'); await onSaved(); } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : 'ذخیره انجام نشد.'); } finally { setBusy(false); } }
  async function remove() { if (!window.confirm('این پرسش حذف شود؟')) return; setBusy(true); try { await apiRequest(`/admin/content/faqs/${item.id}`, { method: 'DELETE' }); await onSaved(); } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : 'حذف انجام نشد.'); } finally { setBusy(false); } }
  return <article className="cms-faq-editor"><label className="form-field"><span>پرسش</span><input value={draft.questionFa} onChange={(event) => setDraft({ ...draft, questionFa: event.target.value })} /></label><label className="form-field"><span>پاسخ</span><textarea rows={3} value={draft.answerFa} onChange={(event) => setDraft({ ...draft, answerFa: event.target.value })} /></label><div className="form-columns"><label className="form-field"><span>گروه</span><input value={draft.category ?? ''} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label><label className="form-field"><span>ترتیب</span><input type="number" min="0" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label></div><label className="check-field"><input type="checkbox" checked={draft.isPublished} onChange={(event) => setDraft({ ...draft, isPublished: event.target.checked })} /><span>منتشرشده</span></label><div className="list-card-actions"><button className="button button-primary" type="button" disabled={busy} onClick={() => void save()}>ذخیره</button><button className="button button-danger" type="button" disabled={busy} onClick={() => void remove()}>حذف</button>{message && <span>{message}</span>}</div></article>;
}

function statusLabel(status: PageStatus) { return ({ DRAFT: 'پیش‌نویس', PUBLISHED: 'منتشرشده', ARCHIVED: 'بایگانی' } as const)[status]; }
