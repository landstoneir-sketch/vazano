'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type SystemSetting = { id: string; key: string; value: unknown; descriptionFa: string | null; isEditable: boolean; version: number };
type NotificationTemplate = { id: string; code: string; eventType: string; channel: string; locale: string; titleTemplate: string; bodyTemplate: string; actionPathTemplate: string | null; isActive: boolean; version: number };

export function AdminSettings() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<SystemSetting[]>('/admin/config/settings'),
      apiRequest<NotificationTemplate[]>('/admin/config/notification-templates'),
    ]).then(([settingData, templateData]) => {
      if (active) { setSettings(settingData); setTemplates(templateData); }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'دریافت تنظیمات انجام نشد.');
    });
    return () => { active = false; };
  }, []);

  return <div className="stack">
    {error && <div className="message message-error">{error}</div>}
    <section><h2>تنظیمات تجاری</h2><p className="muted">تغییرات بلافاصله در قواعد آینده سامانه اعمال می‌شوند و در سوابق مدیریت ثبت خواهند شد.</p>
      <div className="settings-grid">{settings.map((setting) => <SettingEditor setting={setting} key={setting.id} onUpdated={(updated) => setSettings((items) => items.map((item) => item.id === updated.id ? updated : item))} />)}</div>
    </section>
    <section><h2>قالب اعلان‌های داخل سامانه</h2><p className="muted">عبارت‌های داخل دو آکولاد مانند {'{{rfqCode}}'} متغیر هستند و هنگام ارسال با مقدار واقعی جایگزین می‌شوند.</p>
      <div className="stack">{templates.map((template) => <TemplateEditor template={template} key={template.id} onUpdated={(updated) => setTemplates((items) => items.map((item) => item.id === updated.id ? updated : item))} />)}</div>
    </section>
  </div>;
}

function SettingEditor({ setting, onUpdated }: { setting: SystemSetting; onUpdated: (setting: SystemSetting) => void }) {
  const [value, setValue] = useState(() => JSON.stringify(setting.value, null, 2));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMessage('');
    try {
      const parsed = JSON.parse(value) as unknown;
      const updated = await apiRequest<SystemSetting>(`/admin/config/settings/${setting.id}`, { method: 'PUT', body: JSON.stringify({ value: parsed, expectedVersion: setting.version }) });
      onUpdated(updated); setValue(JSON.stringify(updated.value, null, 2)); setMessage('ذخیره شد.');
    } catch (reason: unknown) {
      setMessage(reason instanceof SyntaxError ? 'ساختار مقدار معتبر نیست.' : reason instanceof Error ? reason.message : 'ذخیره تنظیم انجام نشد.');
    } finally { setBusy(false); }
  }

  return <article className="card setting-card">
    <code>{setting.key}</code><p>{setting.descriptionFa ?? 'بدون توضیح'}</p>
    <SettingValueEditor settingKey={setting.key} rawValue={value} onChange={setValue} disabled={!setting.isEditable} />
    <div className="setting-actions"><span className="muted">نسخه {setting.version.toLocaleString('fa-IR')}</span><button className="button button-secondary" type="button" onClick={() => void save()} disabled={busy || !setting.isEditable}>ذخیره</button></div>
    {message && <div className="message">{message}</div>}
  </article>;
}

function SettingValueEditor({ settingKey, rawValue, onChange, disabled }: {
  settingKey: string; rawValue: string; onChange: (value: string) => void; disabled: boolean;
}) {
  const parsed = parseJson(rawValue);
  const setParsed = (value: unknown) => onChange(JSON.stringify(value, null, 2));

  if (settingKey === 'subscription.renewal_warning_offsets_days' || settingKey === 'subscription.trial_warning_offsets_days') {
    const options = settingKey.includes('trial') ? [-7, -3, -1, 0] : [-14, -7, -3, 0, 7];
    const selected = Array.isArray(parsed) ? parsed.filter((item): item is number => typeof item === 'number') : [];
    return <fieldset className="check-grid"><legend>زمان‌های فعال</legend>{options.map((offset) => <label className="check-field" key={offset}><input type="checkbox" disabled={disabled || offset === 0} checked={selected.includes(offset)} onChange={(event) => {
      const next = event.target.checked ? [...selected, offset] : selected.filter((item) => item !== offset);
      setParsed([...new Set(next)].sort((a, b) => a - b));
    }} /><span>{reminderOffsetLabel(offset)}</span></label>)}</fieldset>;
  }

  if (settingKey === 'notification.sms.send_window_local') {
    const current = asRecord(parsed);
    return <div className="form-grid"><label className="form-field"><span>ساعت شروع</span><input type="number" min="0" max="23" disabled={disabled} value={numberValue(current.startHour, 9)} onChange={(event) => setParsed({ ...current, startHour: Number(event.target.value) })} /></label><label className="form-field"><span>ساعت پایان</span><input type="number" min="1" max="24" disabled={disabled} value={numberValue(current.endHour, 20)} onChange={(event) => setParsed({ ...current, endHour: Number(event.target.value) })} /></label><label className="form-field full"><span>منطقه زمانی</span><input dir="ltr" disabled={disabled} value={stringValue(current.timezone, 'Asia/Tehran')} onChange={(event) => setParsed({ ...current, timezone: event.target.value })} /></label></div>;
  }

  if (settingKey === 'subscription.founding_program') {
    const current = asRecord(parsed);
    return <div className="form-grid"><label className="check-field full"><input type="checkbox" disabled={disabled} checked={booleanValue(current.enabled, true)} onChange={(event) => setParsed({ ...current, enabled: event.target.checked })} /><span>برنامه فعال باشد</span></label><label className="form-field full"><span>کد پلن مرتبط</span><input dir="ltr" disabled={disabled} value={stringValue(current.planCode, 'SELLER_FOUNDING_P6M_V1')} onChange={(event) => setParsed({ ...current, planCode: event.target.value.toUpperCase() })} /></label><NumberSetting label="ظرفیت کارخانه" value={numberValue(current.capacity, 20)} disabled={disabled} onChange={(capacity) => setParsed({ ...current, capacity })} /><NumberSetting label="تخفیف تمدید (صدم درصد)" value={numberValue(current.renewalDiscountBps, 2000)} disabled={disabled} onChange={(renewalDiscountBps) => setParsed({ ...current, renewalDiscountBps })} /><NumberSetting label="حداقل لید معتبر" value={numberValue(current.minimumValidLeads, 10)} disabled={disabled} onChange={(minimumValidLeads) => setParsed({ ...current, minimumValidLeads })} /><NumberSetting label="تمدید تضمینی (روز)" value={numberValue(current.guaranteeExtensionDays, 90)} disabled={disabled} onChange={(guaranteeExtensionDays) => setParsed({ ...current, guaranteeExtensionDays })} /><label className="check-field full"><input type="checkbox" disabled={disabled} checked={booleanValue(current.managedSalesOnly, true)} onChange={(event) => setParsed({ ...current, managedSalesOnly: event.target.checked })} /><span>فقط توسط تیم فروش مدیریت شود</span></label><p className="muted full">قیمت و مدت این برنامه در صفحه مدیریت اشتراک‌ها و پلن مرتبط تعیین می‌شود.</p></div>;
  }

  if (settingKey === 'seller.shortage_override') {
    const current = asRecord(parsed);
    const enabled = booleanValue(current.enabled, false);
    return <div className="form-grid"><label className="check-field full"><input type="checkbox" disabled={disabled} checked={enabled} onChange={(event) => setParsed({ ...current, enabled: event.target.checked, expiresAt: event.target.checked ? stringValue(current.expiresAt, defaultShortageExpiry()) : null })} /><span>افزایش موقت سقف پیشنهاد فعال باشد</span></label><label className="form-field"><span>زمان پایان</span><input type="datetime-local" disabled={disabled || !enabled} value={isoToLocalInput(current.expiresAt)} onChange={(event) => setParsed({ ...current, expiresAt: localInputToIso(event.target.value) })} /></label><label className="form-field full"><span>دلیل عملیاتی</span><input dir="rtl" maxLength={200} disabled={disabled || !enabled} value={stringValue(current.reason, '')} onChange={(event) => setParsed({ ...current, reason: event.target.value })} placeholder="مثلاً کمبود عرضه تراورتن در پایلوت" /></label><p className="muted full">در این بازه، سقف روزانه هر پلن تا حداکثر تعیین‌شده همان پلن افزایش می‌یابد و پس از زمان پایان خودکار غیرفعال می‌شود.</p></div>;
  }

  if (typeof parsed === 'boolean') {
    return <label className="check-field"><input type="checkbox" disabled={disabled} checked={parsed} onChange={(event) => setParsed(event.target.checked)} /><span>{parsed ? 'فعال' : 'غیرفعال'}</span></label>;
  }
  if (typeof parsed === 'number') {
    return <input aria-label={`مقدار ${settingKey}`} dir="ltr" type="number" disabled={disabled} value={parsed} onChange={(event) => setParsed(Number(event.target.value))} />;
  }
  if (typeof parsed === 'string') {
    return <input aria-label={`مقدار ${settingKey}`} dir="ltr" disabled={disabled} value={parsed} onChange={(event) => setParsed(event.target.value)} />;
  }
  return <textarea aria-label={`مقدار ${settingKey}`} dir="ltr" rows={4} value={rawValue} onChange={(event) => onChange(event.target.value)} disabled={disabled} />;
}

function NumberSetting({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return <label className="form-field"><span>{label}</span><input type="number" min="0" disabled={disabled} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function parseJson(value: string): unknown {
  try { return JSON.parse(value) as unknown; }
  catch { return undefined; }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberValue(value: unknown, fallback: number): number { return typeof value === 'number' ? value : fallback; }
function stringValue(value: unknown, fallback: string): string { return typeof value === 'string' ? value : fallback; }
function booleanValue(value: unknown, fallback: boolean): boolean { return typeof value === 'boolean' ? value : fallback; }
function defaultShortageExpiry(): string { return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); }
function isoToLocalInput(value: unknown): string {
  if (typeof value !== 'string') return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function reminderOffsetLabel(offset: number): string {
  if (offset === 0) return 'روز پایان';
  return offset < 0 ? `${Math.abs(offset).toLocaleString('fa-IR')} روز پیش از پایان` : `${offset.toLocaleString('fa-IR')} روز پس از پایان`;
}

function TemplateEditor({ template, onUpdated }: { template: NotificationTemplate; onUpdated: (template: NotificationTemplate) => void }) {
  const [title, setTitle] = useState(template.titleTemplate);
  const [body, setBody] = useState(template.bodyTemplate);
  const [actionPath, setActionPath] = useState(template.actionPathTemplate ?? '');
  const [active, setActive] = useState(template.isActive);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMessage('');
    try {
      const updated = await apiRequest<NotificationTemplate>(`/admin/config/notification-templates/${template.id}`, { method: 'PUT', body: JSON.stringify({
        titleTemplate: title, bodyTemplate: body, actionPathTemplate: actionPath || undefined, isActive: active, expectedVersion: template.version,
      }) });
      onUpdated(updated); setMessage('قالب ذخیره شد.');
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'ذخیره قالب انجام نشد.');
    } finally { setBusy(false); }
  }

  return <article className="card setting-card">
    <div className="eyebrow">{template.code} · {template.channel}</div><p className="muted">رویداد: {template.eventType}</p>
    <label className="form-field"><span>عنوان</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
    <label className="form-field"><span>متن پیام</span><textarea rows={3} value={body} onChange={(event) => setBody(event.target.value)} /></label>
    <label className="form-field"><span>مسیر داخلی دکمه</span><input dir="ltr" value={actionPath} onChange={(event) => setActionPath(event.target.value)} placeholder="/dashboard" /></label>
    <label className="check-field"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span>قالب فعال باشد</span></label>
    <div className="setting-actions"><span className="muted">نسخه {template.version.toLocaleString('fa-IR')}</span><button className="button button-primary" type="button" onClick={() => void save()} disabled={busy}>ذخیره قالب</button></div>
    {message && <div className="message">{message}</div>}
  </article>;
}
