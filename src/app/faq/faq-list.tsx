'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Faq = { id: string; questionFa: string; answerFa: string; category: string | null };

export function FaqList() {
  const [items, setItems] = useState<Faq[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void apiRequest<Faq[]>('/content/faqs').then((value) => { if (active) setItems(value); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت پرسش‌های متداول انجام نشد.');
    });
    return () => { active = false; };
  }, []);
  return <div className="stack">{error && <div className="message message-error">{error}</div>}{items.length === 0 && !error && <div className="card">هنوز پرسشی منتشر نشده است.</div>}{items.map((item) => <details className="card faq-card" key={item.id}><summary>{item.questionFa}</summary>{item.category && <div className="eyebrow">{item.category}</div>}<p>{item.answerFa}</p></details>)}</div>;
}
