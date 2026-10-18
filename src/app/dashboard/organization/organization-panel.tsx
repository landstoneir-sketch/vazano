'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type MemberRole = 'BUYER_OWNER' | 'BUYER_MEMBER' | 'SUPPLIER_OWNER' | 'SUPPLIER_MANAGER' | 'SUPPLIER_SALES';
type Organization = {
  id: string; displayName: string; legalName: string; kind: 'BUYER' | 'SUPPLIER'; status: string;
  members: Array<{ role: MemberRole; status: string }>;
};
type Invitation = { id: string; role: MemberRole; createdAt: string; organization: { id: string; displayName: string; kind: 'BUYER' | 'SUPPLIER'; province: string | null; city: string | null } };
type OrganizationMember = {
  id: string; role: MemberRole; status: 'ACTIVE' | 'INVITED'; createdAt: string;
  user: { id: string; mobileMasked: string; firstName: string | null; lastName: string | null; email: string | null };
};
type Province = { id: string; code: string; nameFa: string };
type City = { id: string; provinceId: string; code: string; nameFa: string; isProvinceCapital: boolean };

const roleLabels: Record<MemberRole, string> = {
  BUYER_OWNER: 'مالک حساب خریدار', BUYER_MEMBER: 'عضو خریدار', SUPPLIER_OWNER: 'مالک حساب فروشنده',
  SUPPLIER_MANAGER: 'مدیر فروش', SUPPLIER_SALES: 'کارشناس فروش',
};
const statusLabels: Record<string, string> = { ACTIVE: 'فعال', PENDING: 'در انتظار بررسی', SUSPENDED: 'تعلیق‌شده', INVITED: 'دعوت‌شده' };

export function OrganizationPanel() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [kind, setKind] = useState<'BUYER' | 'SUPPLIER'>('BUYER');
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [cityId, setCityId] = useState('');
  const [inviteMobile, setInviteMobile] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('BUYER_MEMBER');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<Organization[]>('/organizations/mine'),
      apiRequest<Invitation[]>('/organizations/invitations/mine'),
      apiRequest<Province[]>('/locations/provinces'),
    ]).then(([organizationItems, invitationItems, provinceItems]) => {
      if (active) { setOrganizations(organizationItems); setInvitations(invitationItems); setProvinces(provinceItems); }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت حساب‌های سازمانی انجام نشد.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!provinceId) return () => { active = false; };
    void apiRequest<City[]>(`/locations/provinces/${provinceId}/cities`)
      .then((items) => { if (active) setCities(items); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'دریافت شهرهای استان انجام نشد.');
      });
    return () => { active = false; };
  }, [provinceId]);

  async function loadOrganizations() {
    const [organizationItems, invitationItems] = await Promise.all([
      apiRequest<Organization[]>('/organizations/mine'),
      apiRequest<Invitation[]>('/organizations/invitations/mine'),
    ]);
    setOrganizations(organizationItems); setInvitations(invitationItems);
  }

  async function loadMembers(organizationId: string) {
    const organization = organizations.find((item) => item.id === organizationId);
    const roles = allowedRoles(organization?.members[0]?.role);
    if (roles[0]) setInviteRole(roles[0]);
    setSelectedId(organizationId); setError('');
    try { setMembers(await apiRequest<OrganizationMember[]>(`/organizations/${organizationId}/members`)); }
    catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'دریافت اعضای سازمان انجام نشد.'); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('');
    try {
      await apiRequest('/organizations', {
        method: 'POST',
        body: JSON.stringify({ kind, type: nationalId ? 'COMPANY' : 'INDIVIDUAL', legalName: displayName, displayName, nationalId: nationalId || undefined, provinceId, cityId }),
      });
      setDisplayName(''); setNationalId(''); setProvinceId(''); setCityId(''); setCities([]);
      setMessage(kind === 'BUYER' ? 'حساب خریدار با موفقیت ایجاد شد.' : 'حساب فروشنده ایجاد شد؛ اکنون توانمندی‌های آن را تکمیل کنید.');
      await loadOrganizations();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'ایجاد حساب انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function respondToInvitation(invitationId: string, accepted: boolean) {
    setBusy(true); setMessage(''); setError('');
    try {
      await apiRequest(`/organizations/invitations/${invitationId}/${accepted ? 'accept' : 'reject'}`, { method: 'POST' });
      setMessage(accepted ? 'عضویت سازمانی فعال شد.' : 'دعوت‌نامه رد شد.');
      await loadOrganizations();
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'ثبت پاسخ دعوت انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true); setMessage(''); setError('');
    try {
      await apiRequest(`/organizations/${selectedId}/members/invite`, { method: 'POST', body: JSON.stringify({ mobile: inviteMobile, role: inviteRole }) });
      setInviteMobile(''); setMessage('دعوت عضو ثبت شد و پس از ورود کاربر قابل پذیرش است.');
      await loadMembers(selectedId);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'دعوت عضو انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function changeRole(memberId: string, role: MemberRole) {
    if (!selectedId) return;
    setBusy(true); setMessage(''); setError('');
    try {
      await apiRequest(`/organizations/${selectedId}/members/${memberId}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
      setMessage('نقش عضو به‌روزرسانی شد.'); await loadMembers(selectedId);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'تغییر نقش انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function removeMember(memberId: string) {
    if (!selectedId || !window.confirm('این عضو از سازمان حذف شود؟')) return;
    setBusy(true); setMessage(''); setError('');
    try {
      await apiRequest(`/organizations/${selectedId}/members/${memberId}`, { method: 'DELETE' });
      setMessage('عضو از سازمان حذف شد.'); await loadMembers(selectedId);
    } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : 'حذف عضو انجام نشد.'); }
    finally { setBusy(false); }
  }

  const selectedOrganization = organizations.find((item) => item.id === selectedId);
  const currentRole = selectedOrganization?.members[0]?.role;
  const assignableRoles = allowedRoles(currentRole);

  return <div className="stack">
    {error && <div className="message message-error">{error}</div>}
    {message && <div className="message message-success">{message}</div>}

    {invitations.length > 0 && <section className="card stack"><div><div className="eyebrow">نیازمند پاسخ شما</div><h2>دعوت‌نامه‌های سازمانی</h2></div>{invitations.map((invitation) => <div className="invitation-row" key={invitation.id}><div><strong>{invitation.organization.displayName}</strong><p>{roleLabels[invitation.role]}{invitation.organization.city ? ` · ${invitation.organization.city}` : ''}</p></div><div className="list-card-actions"><button className="button button-primary" disabled={busy} onClick={() => void respondToInvitation(invitation.id, true)}>پذیرش</button><button className="button button-secondary" disabled={busy} onClick={() => void respondToInvitation(invitation.id, false)}>رد کردن</button></div></div>)}</section>}

    {organizations.map((organization) => <article className={`card list-card ${selectedId === organization.id ? 'selected-card' : ''}`} key={organization.id}><div><h2>{organization.displayName}</h2><p>{organization.kind === 'BUYER' ? 'خریدار' : 'فروشنده'} · {statusLabels[organization.status] ?? organization.status} · {roleLabels[organization.members[0]?.role] ?? 'عضو'}</p></div><div className="list-card-actions">{organization.kind === 'SUPPLIER' && <Link className="button button-secondary" href={`/supplier/profile/${organization.id}`}>تکمیل توانمندی‌ها</Link>}<button className="button button-secondary" type="button" onClick={() => void loadMembers(organization.id)}>اعضا</button></div></article>)}

    {selectedOrganization && <section className="card stack"><div><div className="eyebrow">{selectedOrganization.displayName}</div><h2>اعضای سازمان</h2></div>{members.map((member) => {
      const memberName = [member.user.firstName, member.user.lastName].filter(Boolean).join(' ') || member.user.mobileMasked;
      const memberAssignableRoles = assignableRoles.filter((role) => role !== member.role);
      const canEdit = !['BUYER_OWNER', 'SUPPLIER_OWNER'].includes(member.role) && assignableRoles.includes(member.role);
      return <div className="organization-member-row" key={member.id}><div><strong>{memberName}</strong><p>{roleLabels[member.role]} · {statusLabels[member.status] ?? member.status}{member.user.email ? ` · ${member.user.email}` : ''}</p></div>{canEdit && <div className="list-card-actions">{memberAssignableRoles.length > 0 && <select aria-label="تغییر نقش عضو" value={member.role} disabled={busy} onChange={(event) => void changeRole(member.id, event.target.value as MemberRole)}><option value={member.role}>{roleLabels[member.role]}</option>{memberAssignableRoles.map((role) => <option value={role} key={role}>{roleLabels[role]}</option>)}</select>}<button className="button button-danger" type="button" disabled={busy} onClick={() => void removeMember(member.id)}>حذف</button></div>}</div>;
    })}{assignableRoles.length > 0 && <form className="organization-invite-form" onSubmit={invite}><label className="form-field"><span>شماره موبایل عضو جدید</span><input value={inviteMobile} onChange={(event) => setInviteMobile(event.target.value)} inputMode="tel" placeholder="09121234567" required /></label><label className="form-field"><span>نقش</span><select value={assignableRoles.includes(inviteRole) ? inviteRole : assignableRoles[0]} onChange={(event) => setInviteRole(event.target.value as MemberRole)}>{assignableRoles.map((role) => <option value={role} key={role}>{roleLabels[role]}</option>)}</select></label><button className="button button-primary" disabled={busy}>دعوت عضو</button></form>}</section>}

    <form className="card form-grid" onSubmit={submit}>
      <h2>ایجاد حساب خریدار یا فروشنده</h2>
      <label className="form-field"><span>نوع حساب</span><select value={kind} onChange={(event) => setKind(event.target.value as 'BUYER' | 'SUPPLIER')}><option value="BUYER">خریدار</option><option value="SUPPLIER">فروشنده / تولیدکننده</option></select></label>
      <label className="form-field"><span>نام شخص یا مجموعه</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} /></label>
      <label className="form-field"><span>شناسه ملی شرکت (اختیاری)</span><input value={nationalId} onChange={(event) => setNationalId(event.target.value)} inputMode="numeric" /></label>
      <label className="form-field"><span>استان</span><select value={provinceId} onChange={(event) => { setProvinceId(event.target.value); setCityId(''); setCities([]); }} required><option value="">انتخاب استان</option>{provinces.map((province) => <option value={province.id} key={province.id}>{province.nameFa}</option>)}</select></label>
      <label className="form-field"><span>شهر</span><select value={cityId} onChange={(event) => setCityId(event.target.value)} disabled={!provinceId} required><option value="">{provinceId ? 'انتخاب شهر' : 'ابتدا استان را انتخاب کنید'}</option>{cities.map((city) => <option value={city.id} key={city.id}>{city.nameFa}{city.isProvinceCapital ? ' · مرکز استان' : ''}</option>)}</select></label>
      <button className="button button-primary" disabled={busy || !provinceId || !cityId}>{busy ? 'در حال ثبت…' : `ایجاد حساب ${kind === 'BUYER' ? 'خریدار' : 'فروشنده'}`}</button>
    </form>
  </div>;
}

function allowedRoles(role: MemberRole | undefined): MemberRole[] {
  if (role === 'BUYER_OWNER') return ['BUYER_MEMBER'];
  if (role === 'SUPPLIER_OWNER') return ['SUPPLIER_MANAGER', 'SUPPLIER_SALES'];
  if (role === 'SUPPLIER_MANAGER') return ['SUPPLIER_SALES'];
  return [];
}
