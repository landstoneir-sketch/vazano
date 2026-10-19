'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../../../lib/api';

type BuyerContact = { id: string; displayName: string; mobileMasked: string; role: string };
type Organization = { id: string; displayName: string; kind?: string; province?: string | null; city?: string | null; contacts?: BuyerContact[] };
type Industry = { id: string; nameFa: string };
type Category = { id: string; industryId: string; parentId: string | null; nameFa: string };
type Unit = { id: string; nameFa: string; symbolFa: string };
type Province = { id: string; code: string; nameFa: string };
type City = { id: string; provinceId: string; code: string; nameFa: string; isProvinceCapital: boolean };
type ProductAttribute = {
  id: string;
  code: string;
  nameFa: string;
  dataType: 'TEXT' | 'NUMBER' | 'SINGLE_SELECT' | 'MULTI_SELECT' | 'BOOLEAN';
  unitLabelFa: string | null;
  options: string[];
  validation: Record<string, unknown>;
  isRequired: boolean;
};
type GuidanceProfile = { requiredChecks: string[]; comparisonCriteria: string[]; suggestedFamilies: string[] };
type CategoryGuidance = {
  profile: string | null;
  version?: string;
  settingVersion?: number;
  packVersion?: string | null;
  disclaimerFa?: string | null;
  applications: Array<{ code: string; labelFa: string; profileKey: string; sensitive: boolean }>;
  profiles: Record<string, GuidanceProfile>;
};
type SpecificationValue = string | number | boolean | string[] | null;
type RfqItemDraft = { categoryId: string; unitId: string; title: string; quantity: string; specifications: Record<string, SpecificationValue> };
type CreatedRfq = {
  id: string;
  code: string;
  lifecycleState: string;
  commitmentStatus: string;
  commitmentAmountRial: string | null;
  operationalStatus: string;
  updatedAt: string;
  buyerOrganizationId: string;
  buyerContactUserId: string;
  primaryDomainId: string;
  title: string;
  description: string | null;
  deliveryProvinceId: string | null;
  deliveryCityId: string | null;
  requiredAt: string | null;
  responseDeadline: string | null;
  installationRequired: boolean;
  qualityControlRequested: boolean;
  items: Array<{ categoryId: string; unitId: string; title: string; quantity: string; specifications: Record<string, SpecificationValue> }>;
};
type Attachment = { id: string; originalName: string; status: string; sizeBytes: number };
type UploadIntent = { attachment: Attachment; upload: { url: string; method: 'PUT'; headers: Record<string, string> } };
type RfqPolicy = {
  marketCountry: string;
  marketCoverageMode: 'NATIONWIDE' | 'SELECTED_PROVINCES';
  marketCoverageProvinceCodes: string[];
  displayPricesTaxInclusive: boolean;
  legalRole: 'INFORMATION_INTERMEDIARY' | 'MARKETPLACE_OPERATOR' | 'CONTRACTING_AGENT';
  qualityControlEnabled: boolean;
  qualityControlFeeBps: number;
  operatorEntryEnabled: boolean;
  pilotManualReview: boolean;
  buyerCommitmentAmountRial: string;
};

const RFQ_STEPS = [
  { number: 1, title: 'پروژه', description: 'معرفی نیاز خرید' },
  { number: 2, title: 'محصول', description: 'نوع، مقدار و واحد' },
  { number: 3, title: 'مشخصات فنی', description: 'جزئیات قابل مقایسه' },
  { number: 4, title: 'تحویل', description: 'مقصد و زمان‌بندی' },
  { number: 5, title: 'مرور و خدمات', description: 'کنترل نهایی و ذخیره' },
] as const;

export function NewRfqForm({ operatorMode = false, draftId }: { operatorMode?: boolean; draftId?: string }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [buyerContactUserId, setBuyerContactUserId] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [cityId, setCityId] = useState('');
  const [installationRequired, setInstallationRequired] = useState(false);
  const [qualityControlRequested, setQualityControlRequested] = useState(false);
  const [requiredAt, setRequiredAt] = useState('');
  const [responseDeadline, setResponseDeadline] = useState('');
  const [savedItems, setSavedItems] = useState<RfqItemDraft[]>([]);
  const [productAttributes, setProductAttributes] = useState<ProductAttribute[]>([]);
  const [loadedCategoryId, setLoadedCategoryId] = useState('');
  const [categoryGuidance, setCategoryGuidance] = useState<CategoryGuidance | null>(null);
  const [specifications, setSpecifications] = useState<Record<string, SpecificationValue>>({});
  const [created, setCreated] = useState<CreatedRfq | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [policy, setPolicy] = useState<RfqPolicy | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const attributesLoading = Boolean(categoryId && loadedCategoryId !== categoryId);

  useEffect(() => {
    void Promise.all([
      apiRequest<Organization[]>(operatorMode ? '/organizations/admin/buyer-options' : '/organizations/mine'),
      apiRequest<Industry[]>('/catalog/industries'),
      apiRequest<Category[]>('/catalog/categories'),
      apiRequest<Unit[]>('/catalog/units'),
      apiRequest<Province[]>('/locations/provinces'),
      apiRequest<RfqPolicy>('/rfqs/active-policy'),
      draftId ? apiRequest<CreatedRfq>(`/rfqs/${draftId}`) : Promise.resolve(null),
      draftId ? apiRequest<Attachment[]>(`/attachments/rfqs/${draftId}`) : Promise.resolve([]),
    ]).then(([orgData, industryData, categoryData, unitData, provinceData, policyData, draftData, attachmentData]) => {
      const buyers = operatorMode ? orgData : orgData.filter((item) => item.kind === 'BUYER');
      setOrganizations(buyers); setIndustries(industryData); setCategories(categoryData); setUnits(unitData); setProvinces(provinceData);
      setPolicy(policyData);
      if (draftData) {
        const firstItem = draftData.items[0];
        if (draftData.lifecycleState !== 'DRAFT' || !['DRAFT_INCOMPLETE', 'NEEDS_CHANGES'].includes(draftData.operationalStatus) || !firstItem) {
          throw new Error('این استعلام دیگر یک پیش‌نویس قابل ویرایش نیست.');
        }
        setCreated(draftData); setAttachments(attachmentData); setOrganizationId(draftData.buyerOrganizationId);
        setBuyerContactUserId(draftData.buyerContactUserId); setIndustryId(draftData.primaryDomainId); setTitle(draftData.title); setDescription(draftData.description ?? '');
        setLoadedCategoryId(''); setCategoryId(firstItem.categoryId); setUnitId(firstItem.unitId); setItemTitle(firstItem.title); setQuantity(firstItem.quantity);
        setSpecifications(firstItem.specifications ?? {}); setProvinceId(draftData.deliveryProvinceId ?? ''); setCityId(draftData.deliveryCityId ?? '');
        setRequiredAt(toLocalDateTime(draftData.requiredAt)); setResponseDeadline(toLocalDateTime(draftData.responseDeadline));
        setSavedItems(draftData.items.slice(1).map((item) => ({ ...item, specifications: item.specifications ?? {} })));
        setInstallationRequired(draftData.installationRequired); setQualityControlRequested(draftData.qualityControlRequested); setDraftDirty(false);
      } else {
        setOrganizationId(buyers[0]?.id ?? ''); setIndustryId(industryData[0]?.id ?? ''); setUnitId(unitData[0]?.id ?? '');
        setBuyerContactUserId(buyers[0]?.contacts?.[0]?.id ?? '');
      }
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'دریافت اطلاعات اولیه انجام نشد.'));
  }, [draftId, operatorMode]);

  const selectableCategories = useMemo(() => categories.filter((item) => item.industryId === industryId && item.parentId), [categories, industryId]);

  useEffect(() => {
    if (!categoryId) return;
    let active = true;
    void Promise.all([
      apiRequest<ProductAttribute[]>(`/catalog/categories/${categoryId}/attributes`),
      apiRequest<CategoryGuidance>(`/catalog/categories/${categoryId}/guidance`),
    ])
      .then(([attributes, guidance]) => { if (active) { setProductAttributes(attributes); setCategoryGuidance(guidance); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت ویژگی‌های فنی انجام نشد.'); })
      .finally(() => { if (active) setLoadedCategoryId(categoryId); });
    return () => { active = false; };
  }, [categoryId]);

  const activeGuidance = useMemo(() => {
    const selectedApplications = Array.isArray(specifications.application) ? specifications.application : [];
    const matches = categoryGuidance?.applications.filter((application) => selectedApplications.includes(application.labelFa)) ?? [];
    const profiles = matches.map((application) => categoryGuidance?.profiles[application.profileKey]).filter((item): item is GuidanceProfile => Boolean(item));
    return {
      selectedApplications: matches,
      requiredChecks: unique(profiles.flatMap((profile) => profile.requiredChecks)),
      comparisonCriteria: unique(profiles.flatMap((profile) => profile.comparisonCriteria)),
      suggestedFamilies: unique(profiles.flatMap((profile) => profile.suggestedFamilies)),
      sensitive: matches.some((application) => application.sensitive),
    };
  }, [categoryGuidance, specifications.application]);

  const missingRequiredAttributes = useMemo(
    () => productAttributes.filter((attribute) => attribute.isRequired && specificationMissing(specifications[attribute.code])).map(attributeLabel),
    [productAttributes, specifications],
  );

  useEffect(() => {
    if (!provinceId) return;
    let active = true;
    void apiRequest<City[]>(`/locations/provinces/${provinceId}/cities`)
      .then((data) => { if (active) setCities(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'دریافت شهرها انجام نشد.'); });
    return () => { active = false; };
  }, [provinceId]);

  function attributeLabel(attribute: ProductAttribute) {
    return attribute.unitLabelFa ? `${attribute.nameFa} (${attribute.unitLabelFa})` : attribute.nameFa;
  }

  function toggleMultiValue(code: string, option: string, checked: boolean) {
    setSpecifications((current) => {
      const selected = Array.isArray(current[code]) ? current[code] as string[] : [];
      return { ...current, [code]: checked ? [...selected, option] : selected.filter((item) => item !== option) };
    });
  }

  function currentItem(): RfqItemDraft | null {
    const hasAnyValue = Boolean(categoryId || itemTitle.trim() || quantity.trim());
    if (!hasAnyValue) return null;
    if (!categoryId || !unitId || itemTitle.trim().length < 2 || !quantity.trim()) {
      throw new Error('ردیف محصول در حال ویرایش ناقص است. دسته، شرح، مقدار و واحد را کامل کنید.');
    }
    return { categoryId, unitId, title: itemTitle.trim(), quantity, specifications };
  }

  function addAnotherItem(): boolean {
    setError('');
    try {
      const item = currentItem();
      if (!item) throw new Error('ابتدا مشخصات ردیف محصول را وارد کنید.');
      setSavedItems((current) => [...current, item]);
      setLoadedCategoryId(''); setCategoryId(''); setItemTitle(''); setQuantity(''); setSpecifications({}); setProductAttributes([]); setCategoryGuidance(null);
      return true;
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'افزودن ردیف انجام نشد.');
      return false;
    }
  }

  function editSavedItem(index: number) {
    setError('');
    try {
      const activeItem = currentItem();
      setSavedItems((current) => {
        const selected = current[index];
        if (!selected) return current;
        const next = current.filter((_, itemIndex) => itemIndex !== index);
        if (activeItem) next.push(activeItem);
        setLoadedCategoryId(''); setCategoryId(selected.categoryId); setUnitId(selected.unitId); setItemTitle(selected.title);
        setQuantity(selected.quantity); setSpecifications(selected.specifications); setProductAttributes([]); setCategoryGuidance(null);
        return next;
      });
      setActiveStep(2);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'ویرایش ردیف انجام نشد.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const invalidStep = RFQ_STEPS.slice(0, 4).find((step) => validateStep(step.number));
      if (invalidStep) {
        setActiveStep(invalidStep.number);
        throw new Error(validateStep(invalidStep.number));
      }
      const activeItem = currentItem();
      const items = [...savedItems, ...(activeItem ? [activeItem] : [])];
      if (items.length === 0) throw new Error('استعلام باید حداقل یک ردیف محصول داشته باشد.');
      const payload = {
        buyerOrganizationId: organizationId,
        ...(operatorMode ? { buyerContactUserId } : {}),
        primaryDomainId: industryId,
        title,
        description,
        deliveryProvinceId: provinceId,
        deliveryCityId: cityId,
        ...(requiredAt ? { requiredAt: new Date(requiredAt).toISOString() } : {}),
        ...(responseDeadline ? { responseDeadline: new Date(responseDeadline).toISOString() } : {}),
        installationRequired,
        qualityControlRequested,
        items,
        ...(created ? { expectedUpdatedAt: created.updatedAt } : {}),
      };
      const rfq = await apiRequest<CreatedRfq>(created ? `/rfqs/${created.id}` : (operatorMode ? '/rfqs/on-behalf' : '/rfqs'), {
        method: created ? 'PUT' : 'POST', body: JSON.stringify(payload),
      });
      setCreated(rfq);
      setDraftDirty(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'ثبت استعلام انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function submitForReview() {
    if (!created) return;
    setBusy(true); setError('');
    try {
      const updated = await apiRequest<CreatedRfq>(`/rfqs/${created.id}/submit`, { method: 'POST' });
      setCreated(updated); setDraftDirty(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'ارسال برای بررسی انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function uploadAttachment() {
    if (!created || !selectedFile) return;
    setBusy(true); setError('');
    try {
      const intent = await apiRequest<UploadIntent>(`/attachments/rfqs/${created.id}/upload-intent`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          sizeBytes: selectedFile.size,
          purpose: selectedFile.type.startsWith('image/') ? 'PRODUCT_IMAGE' : 'GENERAL',
        }),
      });
      const upload = await fetch(intent.upload.url, { method: intent.upload.method, headers: intent.upload.headers, body: selectedFile });
      if (!upload.ok) throw new Error('ارسال فایل به فضای ذخیره‌سازی انجام نشد.');
      const completed = await apiRequest<Attachment>(`/attachments/${intent.attachment.id}/complete`, { method: 'POST' });
      setAttachments((items) => [...items, completed]);
      setSelectedFile(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'بارگذاری فایل انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  if (!error && organizations.length === 0) return operatorMode
    ? <div className="card"><p>حساب خریدار فعال و دارای فرد تماس پیدا نشد.</p></div>
    : <div className="card"><p>برای ثبت استعلام ابتدا حساب خریدار ایجاد کنید.</p><Link className="button button-primary" href="/dashboard/organization">ایجاد حساب خریدار</Link></div>;

  if (operatorMode && policy && !policy.operatorEntryEnabled) {
    return <div className="card"><p>ثبت استعلام توسط اپراتور از تنظیمات سامانه غیرفعال شده است.</p></div>;
  }

  const selectedOrganization = organizations.find((item) => item.id === organizationId);
  const selectedProvince = provinces.find((item) => item.id === provinceId);
  const selectedCity = cities.find((item) => item.id === cityId);
  const activeItemPresent = Boolean(categoryId || itemTitle.trim() || quantity.trim());
  const itemCount = savedItems.length + (activeItemPresent ? 1 : 0);

  function validateStep(step: number): string {
    if (step === 1) {
      if (!organizationId) return 'حساب خریدار را انتخاب کنید.';
      if (operatorMode && !buyerContactUserId) return 'فرد تماس خریدار را انتخاب کنید.';
      if (!industryId) return 'حوزه اصلی را انتخاب کنید.';
      if (title.trim().length < 3) return 'برای استعلام یک عنوان روشن و حداقل سه‌حرفی بنویسید.';
    }
    if (step === 2) {
      if (!activeItemPresent && savedItems.length > 0) return '';
      if (!categoryId) return 'نوع سنگ را انتخاب کنید.';
      if (itemTitle.trim().length < 2) return 'شرح کوتاهی برای محصول بنویسید.';
      if (!quantity.trim() || Number(quantity) <= 0) return 'مقدار موردنیاز را با عددی بزرگ‌تر از صفر وارد کنید.';
      if (!unitId) return 'واحد اندازه‌گیری را انتخاب کنید.';
    }
    if (step === 3) {
      if (attributesLoading) return 'چند لحظه صبر کنید؛ مشخصات فنی محصول در حال دریافت است.';
      if (missingRequiredAttributes.length > 0) return `مشخصات ضروری را کامل کنید: ${missingRequiredAttributes.join('، ')}`;
    }
    if (step === 4 && !provinceId) return 'استان تحویل را انتخاب کنید.';
    return '';
  }

  function goToStep(step: number): void {
    if (step > activeStep) {
      const issue = validateStep(activeStep);
      if (issue) { setError(issue); return; }
    }
    setError('');
    setActiveStep(Math.min(5, Math.max(1, step)));
    document.getElementById('rfq-form-panel')?.scrollIntoView({ block: 'start' });
  }

  function isStepComplete(step: number): boolean {
    if (step === 2) return (Boolean(categoryId) || savedItems.length > 0) && validateStep(step) === '';
    if (step === 3) return (Boolean(categoryId) || savedItems.length > 0) && validateStep(step) === '';
    if (step === 5) return Boolean(created) && !draftDirty;
    return validateStep(step) === '';
  }

  return <div className="rfq-workspace">
    <form id="rfq-form-panel" className="card rfq-form rfq-wizard" onSubmit={submit} onChangeCapture={(event) => {
      if (created && (!(event.target instanceof HTMLInputElement) || event.target.type !== 'file')) setDraftDirty(true);
    }}>
      <nav className="rfq-wizard-progress" aria-label="مراحل ثبت استعلام">
        <ol>{RFQ_STEPS.map((step) => <li className={activeStep === step.number ? 'is-current' : isStepComplete(step.number) ? 'is-complete' : ''} key={step.number}>
          <button type="button" onClick={() => goToStep(step.number)} disabled={step.number > activeStep} aria-current={activeStep === step.number ? 'step' : undefined}>
            <b>{isStepComplete(step.number) ? '✓' : step.number.toLocaleString('fa-IR')}</b><span><strong>{step.title}</strong><small>{step.description}</small></span>
          </button>
        </li>)}</ol>
      </nav>

      {error && <div className="message message-error rfq-wizard-message" role="alert" aria-live="assertive">{error}</div>}
      {created && <div className="message message-success rfq-wizard-message" aria-live="polite"><strong>{created.lifecycleState === 'DRAFT' ? (draftDirty ? 'تغییرات ذخیره‌نشده دارید.' : 'پیش‌نویس با موفقیت ذخیره شد.') : created.operationalStatus === 'UNDER_REVIEW' ? 'استعلام در صف بررسی است.' : created.operationalStatus === 'WAITING_COMMITMENT' ? 'استعلام تأیید شد و منتظر تکمیل تعهد خریدار است.' : 'استعلام تأیید شد و آماده انتشار است.'}</strong><span>کد استعلام: {created.code}</span>{created.lifecycleState === 'DRAFT' && <button type="button" className="button button-secondary" onClick={() => void submitForReview()} disabled={busy || draftDirty}>{draftDirty ? 'ابتدا تغییرات را ذخیره کنید' : policy?.pilotManualReview === false ? 'ثبت نهایی استعلام' : 'ارسال برای بررسی وازانو'}</button>}{created.lifecycleState !== 'DRAFT' && <Link className="button button-secondary" href={`/dashboard/rfqs/${created.id}`}>مشاهده جزئیات و ادامه فرایند</Link>}</div>}

      {activeStep === 1 && <section className="rfq-wizard-panel" aria-labelledby="rfq-step-1">
        <header><span>مرحله ۱ از ۵</span><h2 id="rfq-step-1">پروژه و نیاز خرید</h2><p>ابتدا بگویید این خرید برای کدام حساب و چه پروژه‌ای است.</p></header>
        <div className="form-columns">
          <label className="form-field"><span>حساب خریدار</span><select value={organizationId} disabled={Boolean(created)} onChange={(event) => { const nextId = event.target.value; setOrganizationId(nextId); setBuyerContactUserId(organizations.find((item) => item.id === nextId)?.contacts?.[0]?.id ?? ''); }} required>{organizations.map((item) => <option value={item.id} key={item.id}>{buyerOrganizationLabel(item, operatorMode)}</option>)}</select><small>استعلام و پیشنهادها در همین حساب نگه‌داری می‌شوند.</small></label>
          {operatorMode && <label className="form-field"><span>فرد تماس خریدار</span><select value={buyerContactUserId} disabled={Boolean(created)} onChange={(event) => setBuyerContactUserId(event.target.value)} required><option value="">انتخاب کنید</option>{selectedOrganization?.contacts?.map((contact) => <option value={contact.id} key={contact.id}>{contact.displayName} — {contact.mobileMasked}</option>)}</select></label>}
          <label className="form-field"><span>حوزه خرید</span><select value={industryId} onChange={(event) => { setIndustryId(event.target.value); setLoadedCategoryId(''); setCategoryId(''); setProductAttributes([]); setCategoryGuidance(null); setSpecifications({}); }} required>{industries.map((item) => <option value={item.id} key={item.id}>{item.nameFa}</option>)}</select></label>
          <label className="form-field full"><span>عنوان استعلام</span><input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} placeholder="مثلاً تأمین سنگ نمای پروژه مسکونی" /><small>عنوان کوتاه و مشخص، پاسخ دقیق‌تری از فروشندگان می‌گیرد.</small></label>
          <label className="form-field full"><span>توضیحات تکمیلی <em>اختیاری</em></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} placeholder="شرایط پروژه، کیفیت مورد انتظار یا نکته‌ای که فروشندگان باید بدانند" /><small>{description.length.toLocaleString('fa-IR')} از ۲٬۰۰۰ نویسه</small></label>
        </div>
      </section>}

      {activeStep === 2 && <section className="rfq-wizard-panel" aria-labelledby="rfq-step-2">
        <header><span>مرحله ۲ از ۵</span><h2 id="rfq-step-2">محصول و مقدار موردنیاز</h2><p>نوع سنگ، شرح قابل‌فهم و مقدار تقریبی را وارد کنید.</p></header>
        {savedItems.length > 0 && <div className="rfq-saved-items"><h3>محصولات افزوده‌شده</h3>{savedItems.map((item, index) => <div className="list-card" key={`${item.categoryId}-${index}`}><div><strong>{item.title}</strong><p className="muted">{categories.find((category) => category.id === item.categoryId)?.nameFa ?? 'محصول'} · {item.quantity} {units.find((unit) => unit.id === item.unitId)?.symbolFa ?? ''}</p></div><div className="list-card-actions"><button className="button button-secondary" type="button" onClick={() => editSavedItem(index)}>ویرایش</button><button className="button button-ghost" type="button" onClick={() => setSavedItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>حذف</button></div></div>)}</div>}
        <div className="form-columns">
          <label className="form-field"><span>نوع سنگ</span><select value={categoryId} onChange={(event) => { setLoadedCategoryId(''); setCategoryId(event.target.value); setProductAttributes([]); setCategoryGuidance(null); setSpecifications({}); }} required><option value="">انتخاب نوع سنگ</option>{selectableCategories.map((item) => <option value={item.id} key={item.id}>{item.nameFa}</option>)}</select><small>نزدیک‌ترین دسته را انتخاب کنید؛ جزئیات در مرحله بعد تکمیل می‌شود.</small></label>
          <label className="form-field"><span>شرح محصول</span><input value={itemTitle} onChange={(event) => setItemTitle(event.target.value)} required minLength={2} placeholder="مثلاً تراورتن کرم برای نمای اصلی" /></label>
          <label className="form-field"><span>مقدار موردنیاز</span><input value={quantity} onChange={(event) => setQuantity(event.target.value)} required inputMode="decimal" dir="ltr" placeholder="مثلاً 850" /></label>
          <label className="form-field"><span>واحد اندازه‌گیری</span><select value={unitId} onChange={(event) => setUnitId(event.target.value)} required>{units.map((item) => <option value={item.id} key={item.id}>{item.nameFa} ({item.symbolFa})</option>)}</select></label>
        </div>
        {savedItems.length > 0 && !activeItemPresent && <button className="button button-secondary" type="button" onClick={() => goToStep(4)}>محصول دیگری ندارم؛ ادامه با همین محصولات</button>}
      </section>}

      {activeStep === 3 && <section className="rfq-wizard-panel" aria-labelledby="rfq-step-3">
        <header><span>مرحله ۳ از ۵</span><h2 id="rfq-step-3">مشخصات فنی محصول</h2><p>فقط اطلاعاتی را وارد کنید که به مقایسه درست پیشنهادها کمک می‌کند.</p></header>
        {attributesLoading ? <div className="message" role="status">در حال آماده‌سازی مشخصات فنی این محصول…</div> : productAttributes.length > 0 ? <div className="form-columns">
          {productAttributes.map((attribute) => {
            const label = attributeLabel(attribute);
            const value = specifications[attribute.code];
            if (attribute.dataType === 'SINGLE_SELECT') return <label className="form-field" key={attribute.id}><span>{label}{attribute.isRequired ? ' *' : ''}</span><select aria-label={label} value={typeof value === 'string' ? value : ''} required={attribute.isRequired} onChange={(event) => setSpecifications((current) => ({ ...current, [attribute.code]: event.target.value }))}><option value="">انتخاب کنید</option>{attribute.options.map((option) => <option value={option} key={option}>{option}</option>)}</select></label>;
            if (attribute.dataType === 'MULTI_SELECT') return <fieldset className={`attribute-options ${attribute.code === 'application' ? 'application-options' : ''}`} key={attribute.id}><legend>{label}{attribute.isRequired ? ' *' : ''}</legend>{attribute.options.map((option) => <label className="check-field" key={option}><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={(event) => toggleMultiValue(attribute.code, option, event.target.checked)} /><span>{option}</span></label>)}</fieldset>;
            if (attribute.dataType === 'BOOLEAN') return <label className="check-field rfq-option" key={attribute.id}><input type="checkbox" checked={value === true} onChange={(event) => setSpecifications((current) => ({ ...current, [attribute.code]: event.target.checked }))} /><span>{label}</span></label>;
            const minimum = typeof attribute.validation.min === 'number' ? attribute.validation.min : undefined;
            const maximum = typeof attribute.validation.max === 'number' ? attribute.validation.max : undefined;
            const maxLength = typeof attribute.validation.maxLength === 'number' ? attribute.validation.maxLength : undefined;
            return <label className="form-field" key={attribute.id}><span>{label}{attribute.isRequired ? ' *' : ''}</span><input aria-label={label} type={attribute.dataType === 'NUMBER' ? 'number' : 'text'} min={minimum} max={maximum} maxLength={maxLength} value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} required={attribute.isRequired} onChange={(event) => setSpecifications((current) => ({ ...current, [attribute.code]: event.target.value }))} /></label>;
          })}
        </div> : <div className="message">برای این نوع سنگ، مشخصات تکمیلی اجباری تعریف نشده است. می‌توانید به مرحله بعد بروید.</div>}
        {categoryGuidance?.profile && <aside className="stone-guidance" aria-live="polite">
          <div className="stone-guidance-heading"><div><strong>راهنمای تخصصی وازانو</strong><p>محل مصرف را دقیق انتخاب کنید تا پیشنهادها قابل‌اعتمادتر شوند.</p></div><span>پایگاه دانش سنگ</span></div>
          {activeGuidance.selectedApplications.length === 0 ? <div className="message">در «محل مصرف» حداقل یک گزینه دقیق مانند نمای خارجی، کف پارکینگ یا کانتر را انتخاب کنید.</div> : <>
            <div className="stone-guidance-applications">{activeGuidance.selectedApplications.map((application) => <span key={application.code}>{application.labelFa}</span>)}</div>
            {activeGuidance.sensitive && <div className="message message-warning"><strong>کاربرد حساس:</strong> انتخاب نهایی باید پس از بررسی نمونه و مدارک فنی همان پارت انجام شود.</div>}
            {missingRequiredAttributes.length > 0 && <div className="message message-warning"><strong>هنوز ناقص است:</strong> {missingRequiredAttributes.join('، ')}</div>}
            <details className="rfq-guidance-details"><summary>مشاهده راهنمای فنی و معیارهای مقایسه</summary><div className="stone-guidance-grid"><section><h3>مدارک و کنترل‌های لازم</h3><ul>{activeGuidance.requiredChecks.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>معیار مقایسه پیشنهادها</h3><ul>{activeGuidance.comparisonCriteria.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>خانواده‌های مناسب</h3><ul>{activeGuidance.suggestedFamilies.map((item) => <li key={item}>{item}</li>)}</ul></section></div></details>
            <p className="stone-guidance-disclaimer">{categoryGuidance.disclaimerFa}</p>
          </>}
        </aside>}
        <button className="button button-secondary rfq-add-item" type="button" onClick={() => { if (addAnotherItem()) setActiveStep(2); }}>ذخیره این محصول و افزودن محصول دیگر</button>
      </section>}

      {activeStep === 4 && <section className="rfq-wizard-panel" aria-labelledby="rfq-step-4">
        <header><span>مرحله ۴ از ۵</span><h2 id="rfq-step-4">زمان و محل تحویل</h2><p>مقصد و زمان واقعی پروژه به فروشنده کمک می‌کند قیمت و برنامه دقیق‌تری بدهد.</p></header>
        <div className="form-columns">
          <label className="form-field"><span>استان تحویل</span><select value={provinceId} onChange={(event) => { setProvinceId(event.target.value); setCities([]); setCityId(''); }} required><option value="">انتخاب استان</option>{provinces.filter((item) => policy?.marketCoverageMode !== 'SELECTED_PROVINCES' || policy.marketCoverageProvinceCodes.includes(item.code)).map((item) => <option value={item.id} key={item.id}>{item.nameFa}</option>)}</select></label>
          <label className="form-field"><span>شهر تحویل <em>اختیاری</em></span><select value={cityId} onChange={(event) => setCityId(event.target.value)} disabled={!provinceId}><option value="">{provinceId ? 'انتخاب شهر' : 'ابتدا استان را انتخاب کنید'}</option>{cities.map((item) => <option value={item.id} key={item.id}>{item.nameFa}{item.isProvinceCapital ? ' (مرکز استان)' : ''}</option>)}</select></label>
          <label className="form-field"><span>زمان موردنیاز <em>اختیاری</em></span><input type="datetime-local" value={requiredAt} onChange={(event) => setRequiredAt(event.target.value)} /><small>زمانی که کالا باید در پروژه آماده باشد.</small></label>
          <label className="form-field"><span>مهلت دریافت پیشنهاد <em>اختیاری</em></span><input type="datetime-local" value={responseDeadline} onChange={(event) => setResponseDeadline(event.target.value)} /><small>فروشندگان تا این زمان فرصت پاسخ دارند.</small></label>
        </div>
      </section>}

      {activeStep === 5 && <section className="rfq-wizard-panel" aria-labelledby="rfq-step-5">
        <header><span>مرحله ۵ از ۵</span><h2 id="rfq-step-5">مرور نهایی و خدمات تکمیلی</h2><p>انتخاب‌های زیر اختیاری‌اند. سپس پیش‌نویس را ذخیره کنید.</p></header>
        <div className="rfq-review-card"><h3>{title || 'عنوان استعلام وارد نشده'}</h3><dl><div><dt>خریدار</dt><dd>{selectedOrganization?.displayName ?? '—'}</dd></div><div><dt>تعداد محصولات</dt><dd>{itemCount.toLocaleString('fa-IR')} ردیف</dd></div><div><dt>تحویل</dt><dd>{[selectedProvince?.nameFa, selectedCity?.nameFa].filter(Boolean).join('، ') || '—'}</dd></div><div><dt>نمایش قیمت</dt><dd>{policy?.displayPricesTaxInclusive ? 'با مالیات' : 'بدون مالیات'}</dd></div></dl></div>
        <div className="rfq-service-options">
          <label className="check-field rfq-option"><input type="checkbox" checked={installationRequired} onChange={(event) => setInstallationRequired(event.target.checked)} /><span><strong>به خدمات نصب نیاز دارم</strong><small>فروشنده هزینه و شرایط نصب را جداگانه اعلام می‌کند.</small></span></label>
          {policy?.qualityControlEnabled !== false ? <label className="check-field rfq-option"><input type="checkbox" checked={qualityControlRequested} onChange={(event) => setQualityControlRequested(event.target.checked)} /><span><strong>کنترل کیفیت توسط وازانو</strong><small>کارمزد {((policy?.qualityControlFeeBps ?? 300) / 100).toLocaleString('fa-IR')}٪ مبلغ خرید؛ فقط در صورت درخواست شما.</small></span></label> : <div className="message">خدمت کنترل کیفیت در حال حاضر غیرفعال است.</div>}
        </div>
        <div className="message rfq-legal-note">{legalRoleText(policy?.legalRole)} مبلغ کالا، حمل و نصب مستقیماً میان خریدار و فروشنده تعیین می‌شود. ذخیره این فرم فقط یک پیش‌نویس می‌سازد و هنوز برای فروشندگان ارسال نمی‌شود.</div>
        {created && created.lifecycleState === 'DRAFT' && <fieldset className="fieldset rfq-attachments"><legend>نقشه، تصویر یا فایل متره</legend><p className="muted">PDF، تصویر، Word یا Excel تا ۲۰ مگابایت؛ فایل پس از بررسی امنیتی قابل استفاده می‌شود.</p><div className="attachment-upload-row"><input aria-label="انتخاب فایل پیوست" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.docx" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} /><button className="button button-secondary" type="button" disabled={busy || !selectedFile} onClick={() => void uploadAttachment()}>بارگذاری فایل</button></div>{attachments.length > 0 && <ul>{attachments.map((attachment) => <li key={attachment.id}>{attachment.originalName} — {attachmentStatusLabel(attachment.status)}</li>)}</ul>}</fieldset>}
      </section>}

      <footer className="rfq-wizard-actions">
        <button className="button button-ghost" type="button" onClick={() => goToStep(activeStep - 1)} disabled={activeStep === 1 || busy}>مرحله قبل</button>
        <span>مرحله {activeStep.toLocaleString('fa-IR')} از ۵</span>
        {activeStep < 5 ? <button className="button button-primary" type="button" onClick={() => goToStep(activeStep + 1)}>ادامه</button> : <button className="button button-primary rfq-submit" disabled={busy || !organizationId || !provinceId || (operatorMode && !buyerContactUserId)}>{busy ? 'در حال ذخیره…' : created ? 'ذخیره تغییرات پیش‌نویس' : operatorMode ? 'ثبت پیش‌نویس از طرف خریدار' : 'ذخیره پیش‌نویس استعلام'}</button>}
      </footer>
    </form>

    <aside className="card rfq-live-summary" aria-label="خلاصه زنده استعلام">
      <span className="eyebrow">خلاصه استعلام</span><h2>{title || 'استعلام جدید'}</h2><p>در هر مرحله می‌توانید اطلاعات را مرور و اصلاح کنید.</p>
      <dl><div><dt>مرحله فعلی</dt><dd>{RFQ_STEPS[activeStep - 1]?.title}</dd></div><div><dt>محصولات</dt><dd>{itemCount ? `${itemCount.toLocaleString('fa-IR')} ردیف` : 'هنوز وارد نشده'}</dd></div><div><dt>مقصد</dt><dd>{[selectedProvince?.nameFa, selectedCity?.nameFa].filter(Boolean).join('، ') || 'هنوز مشخص نشده'}</dd></div></dl>
      <div className="rfq-draft-assurance"><b>پیش‌نویس امن</b><span>هیچ اطلاعاتی تا ثبت نهایی برای فروشندگان ارسال نمی‌شود.</span></div>
    </aside>
  </div>;
}

function legalRoleText(role: RfqPolicy['legalRole'] | undefined): string {
  if (role === 'CONTRACTING_AGENT') return 'وازانو طبق درخواست خریدار می‌تواند نقش نماینده قراردادی داشته باشد.';
  if (role === 'MARKETPLACE_OPERATOR') return 'وازانو بهره‌بردار بازارگاه است.';
  return 'وازانو واسط اطلاعات است.';
}

function buyerOrganizationLabel(organization: Organization, operatorMode: boolean): string {
  if (!operatorMode) return organization.displayName;
  const location = [organization.province, organization.city].filter(Boolean).join('، ');
  const contact = organization.contacts?.[0]?.mobileMasked;
  return [organization.displayName, location, contact ? `تماس ${contact}` : null].filter(Boolean).join(' — ');
}

function attachmentStatusLabel(status: string): string {
  if (status === 'READY') return 'آماده';
  if (status === 'QUARANTINED') return 'قرنطینه‌شده؛ این فایل قابل استفاده نیست';
  if (status === 'REJECTED') return 'ردشده';
  return 'در انتظار بررسی امنیتی';
}

function toLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function specificationMissing(value: SpecificationValue | undefined): boolean {
  if (value === null || value === undefined || value === '') return true;
  return Array.isArray(value) && value.length === 0;
}
