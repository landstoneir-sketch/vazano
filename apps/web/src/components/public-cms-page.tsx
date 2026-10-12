'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type CmsPage = { slug: string; titleFa: string; excerptFa: string | null; bodyFa: string; updatedAt: string };

export function PublicCmsPage({ slug, sectionLabel = 'وازانو' }: { slug: string; sectionLabel?: string }) {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest<CmsPage>(`/content/pages/${slug}`)
      .then((value) => { if (active) setPage(value); })
      .catch(() => { if (active) setUnavailable(true); });
    return () => { active = false; };
  }, [slug]);

  if (unavailable) return <section className="container dashboard"><div className="card stack"><div className="eyebrow">{sectionLabel}</div><h1>این صفحه هنوز منتشر نشده است</h1><p className="muted">محتوا پس از بررسی و تأیید مدیریت وازانو در دسترس قرار می‌گیرد.</p></div></section>;
  if (!page) return <section className="container dashboard"><div className="card" role="status">در حال دریافت محتوا…</div></section>;
  return <article className="container dashboard public-content"><div className="eyebrow">{sectionLabel}</div><h1>{page.titleFa}</h1>{page.excerptFa && <p className="public-content-lead">{page.excerptFa}</p>}<div className="card public-content-body">{page.bodyFa}</div><small className="muted">آخرین به‌روزرسانی: {new Date(page.updatedAt).toLocaleDateString('fa-IR')}</small></article>;
}
