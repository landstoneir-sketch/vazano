'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type Supplier = {
  id: string;
  displayName: string;
  legalName: string;
  province: string | null;
  city: string | null;
  supplierProfile: { verificationStatus: string; description: string | null; productionCapacityDescription: string | null; minimumOrderDescription: string | null; leadTimeDescription: string | null; officialInvoiceAvailable: boolean; sampleAvailable: boolean; installationAvailable: boolean; nationwideCoverage: boolean; serviceProvinces: string[]; categories: Array<{ category: { nameFa: string } }>; verificationDocuments: Array<{ id: string; originalName: string; status: string }> };
  members: Array<{ user: { mobile: string; firstName: string | null; lastName: string | null } }>;
};

export function SupplierVerificationQueue() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  async function load() {
    try { setItems(await apiRequest<Supplier[]>('/suppliers/admin/verification-queue')); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'دریافت صف فروشندگان انجام نشد.'); }
  }
  useEffect(() => {
    let active = true;
    void apiRequest<Supplier[]>('/suppliers/admin/verification-queue').then((data) => { if (active) setItems(data); }).catch((reason: unknown) => {
      if (active) setMessage(reason instanceof Error ? reason.message : 'دریافت صف فروشندگان انجام نشد.');
    });
    return () => { active = false; };
  }, []);

  async function decide(id: string, status: 'VERIFIED' | 'NEEDS_CORRECTION') {
    setBusyId(id); setMessage('');
    try {
      await apiRequest(`/suppliers/organizations/${id}/verification`, { method: 'PUT', body: JSON.stringify({ status, ...(status === 'NEEDS_CORRECTION' ? { reason: 'اطلاعات توانمندی یا محدوده تأمین نیازمند تکمیل است.' } : {}) }) });
      setMessage(status === 'VERIFIED' ? 'فروشنده تأیید و فعال شد.' : 'پروفایل برای اصلاح بازگردانده شد.'); await load();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'ثبت تصمیم انجام نشد.'); }
    finally { setBusyId(''); }
  }

  async function downloadDocument(documentId: string) {
    setMessage('');
    try {
      const result = await apiRequest<{ url: string }>(`/attachments/${documentId}/download-url`);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'دریافت مدرک انجام نشد.'); }
  }

  return <div className="stack">
    {message && <div className="message">{message}</div>}
    {items.length === 0 && <div className="card">فروشنده‌ای در صف بررسی نیست.</div>}
    {items.map((supplier) => <article className="card" key={supplier.id}>
      <div className="eyebrow">{supplier.supplierProfile.verificationStatus}</div><h2>{supplier.displayName}</h2>
      <p>{supplier.legalName} · {supplier.province ?? '—'}، {supplier.city ?? '—'} · تماس مدیر: {supplier.members[0]?.user.mobile ?? '—'}</p>
      <p>{supplier.supplierProfile.description || 'بدون توضیح'}</p>
      <p><strong>ظرفیت:</strong> {supplier.supplierProfile.productionCapacityDescription || 'ثبت نشده'}</p>
      <p><strong>حداقل سفارش:</strong> {supplier.supplierProfile.minimumOrderDescription || 'ثبت نشده'} · <strong>زمان آماده‌سازی:</strong> {supplier.supplierProfile.leadTimeDescription || 'ثبت نشده'}</p>
      <p><strong>توانمندی‌ها:</strong> {[supplier.supplierProfile.officialInvoiceAvailable ? 'فاکتور رسمی' : null, supplier.supplierProfile.sampleAvailable ? 'نمونه محصول' : null, supplier.supplierProfile.installationAvailable ? 'نصب' : null].filter(Boolean).join('، ') || 'ثبت نشده'}</p>
      <p>پوشش: {supplier.supplierProfile.nationwideCoverage ? 'کل ایران' : supplier.supplierProfile.serviceProvinces.join('، ')}</p>
      <p>دسته‌ها: {supplier.supplierProfile.categories.map((item) => item.category.nameFa).join('، ')}</p>
      <div><strong>مدارک احراز:</strong>{supplier.supplierProfile.verificationDocuments.length === 0 ? <p className="muted">مدرکی بارگذاری نشده است.</p> : <ul>{supplier.supplierProfile.verificationDocuments.map((document) => <li key={document.id}>{document.originalName} — {document.status}{document.status === 'READY' && <button className="button button-ghost" type="button" onClick={() => void downloadDocument(document.id)}>مشاهده</button>}</li>)}</ul>}</div>
      <div className="actions"><button className="button button-primary" disabled={busyId === supplier.id || !supplier.supplierProfile.verificationDocuments.some((document) => document.status === 'READY')} onClick={() => void decide(supplier.id, 'VERIFIED')}>تأیید و فعال‌سازی</button><button className="button button-secondary" disabled={busyId === supplier.id} onClick={() => void decide(supplier.id, 'NEEDS_CORRECTION')}>نیازمند اصلاح</button></div>
    </article>)}
  </div>;
}
