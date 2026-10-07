'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type Supplier = {
  id: string;
  displayName: string;
  legalName: string;
  province: string | null;
  city: string | null;
  supplierProfile: { verificationStatus: string; description: string | null; nationwideCoverage: boolean; serviceProvinces: string[]; categories: Array<{ category: { nameFa: string } }> };
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

  return <div className="stack">
    {message && <div className="message">{message}</div>}
    {items.length === 0 && <div className="card">فروشنده‌ای در صف بررسی نیست.</div>}
    {items.map((supplier) => <article className="card" key={supplier.id}>
      <div className="eyebrow">{supplier.supplierProfile.verificationStatus}</div><h2>{supplier.displayName}</h2>
      <p>{supplier.legalName} · {supplier.province ?? '—'}، {supplier.city ?? '—'} · تماس مدیر: {supplier.members[0]?.user.mobile ?? '—'}</p>
      <p>{supplier.supplierProfile.description || 'بدون توضیح'}</p>
      <p>پوشش: {supplier.supplierProfile.nationwideCoverage ? 'کل ایران' : supplier.supplierProfile.serviceProvinces.join('، ')}</p>
      <p>دسته‌ها: {supplier.supplierProfile.categories.map((item) => item.category.nameFa).join('، ')}</p>
      <div className="actions"><button className="button button-primary" disabled={busyId === supplier.id} onClick={() => void decide(supplier.id, 'VERIFIED')}>تأیید و فعال‌سازی</button><button className="button button-secondary" disabled={busyId === supplier.id} onClick={() => void decide(supplier.id, 'NEEDS_CORRECTION')}>نیازمند اصلاح</button></div>
    </article>)}
  </div>;
}
