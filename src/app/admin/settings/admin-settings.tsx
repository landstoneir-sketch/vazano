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
    <section><h2>تنظیمات تجاری</h2><p className="muted">مقادیر متنی باید داخل علامت نقل‌قول و مقادیر چندبخشی به‌شکل JSON وارد شوند.</p>
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
    <textarea aria-label={`مقدار ${setting.key}`} dir="ltr" rows={4} value={value} onChange={(event) => setValue(event.target.value)} disabled={!setting.isEditable} />
    <div className="setting-actions"><span className="muted">نسخه {setting.version.toLocaleString('fa-IR')}</span><button className="button button-secondary" type="button" onClick={() => void save()} disabled={busy || !setting.isEditable}>ذخیره</button></div>
    {message && <div className="message">{message}</div>}
  </article>;
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
