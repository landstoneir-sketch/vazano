'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type CmsPage = { slug: string; titleFa: string; excerptFa: string | null; bodyFa: string; updatedAt: string };

export function PublicCmsPage({ slug }: { slug: string }) {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void apiRequest<CmsPage>(`/content/pages/${slug}`).then((value) => { if (active) setPage(value); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت محتوای صفحه انجام نشد.');
    });
    return () => { active = false; };
  }, [slug]);
  if (error) return <section className="container dashboard"><div className="message message-error">{error}</div></section>;
  if (!page) return <section className="container dashboard"><div className="card">در حال دریافت محتوا…</div></section>;
  return <article className="container dashboard public-content"><div className="eyebrow">راهنمای وازانو</div><h1>{page.titleFa}</h1>{page.excerptFa && <p className="public-content-lead">{page.excerptFa}</p>}<div className="card public-content-body">{page.bodyFa}</div><small className="muted">آخرین به‌روزرسانی: {new Date(page.updatedAt).toLocaleDateString('fa-IR')}</small></article>;
}
