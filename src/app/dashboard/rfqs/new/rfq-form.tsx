'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest, normalizeDecimalInput } from '../../../../lib/api';

type BuyerContact = { id: string; displayName: string; mobileMasked: string; role: string };
type Organization = { id: string; displayName: string; kind?: string; province?: string | null; city?: string | null; contacts?: BuyerContact[] };
type Industry = { id: string; nameFa: string };
type Category = { id: string; industryId: string; parentId: string | null; nameFa: string };
type Unit = { id: string; code: string; nameFa: string; symbolFa: string };
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
  projectName: string | null;
  deliveryAddress: string | null;
  paymentTerm: string | null;
  paymentDetail: string | null;
  deliveryTimeMode: string | null;
  deliverySchedule: string | null;
  deliveryScheduleDetail: string | null;
  shippingMode: string | null;
  transportCoordinator: string | null;
  freightPayer: string | null;
  unloadingPayer: string | null;
  purchaseQualityTerms: string[];
  purchaseQualityTermsOther: string | null;
  financialGuaranteeRequired: boolean;
  financialGuaranteeDetail: string | null;
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
  buyerCommitmentEnabled: boolean;
  buyerCommitmentAmountRial: string;
};
type AuthState = 'CHECKING' | 'AUTHENTICATED' | 'GUEST';
type GuestRfqDraft = {
  version: 2;
  savedAt: string;
  industryId: string;
  title: string;
  description: string;
  projectName: string;
  provinceId: string;
  cityId: string;
  deliveryAddress: string;
  requiredAt: string;
  responseDeadline: string;
  paymentTerm: string;
  paymentDetail: string;
  deliveryTimeMode: string;
  deliverySchedule: string;
  deliveryScheduleDetail: string;
  shippingMode: string;
  transportCoordinator: string;
  freightPayer: string;
  unloadingPayer: string;
  purchaseQualityTerms: string[];
  purchaseQualityTermsOther: string;
  financialGuaranteeRequired: boolean;
  financialGuaranteeDetail: string;
  installationRequired: boolean;
  qualityControlRequested: boolean;
  items: RfqItemDraft[];
};

const GUEST_RFQ_DRAFT_KEY = 'vazano:guest-rfq-draft:v2';
const LEGACY_GUEST_RFQ_DRAFT_KEY = 'vazano:guest-rfq-draft:v1';
const MAX_RFQ_ITEMS = 20;

const RFQ_STEPS = [
  { number: 1, title: 'ردیف‌های سنگ', description: 'نوع، مقدار و مشخصات فنی' },
  { number: 2, title: 'اطلاعات مشترک', description: 'پروژه، تحویل و شرایط خرید' },
  { number: 3, title: 'بازبینی', description: 'کنترل نهایی و ذخیره' },
] as const;

const PAYMENT_TERMS = [['CASH', 'نقدی'], ['ADVANCE', 'پیش‌پرداخت'], ['AFTER_DELIVERY', 'پس از تحویل'], ['CHEQUE', 'چک'], ['BARTER', 'تهاتر'], ['NEGOTIABLE', 'قابل مذاکره']] as const;
const PARTY_OPTIONS = [['BUYER', 'خریدار'], ['SELLER', 'فروشنده'], ['INCLUDED', 'داخل قیمت پیشنهادی'], ['NEGOTIABLE', 'قابل مذاکره']] as const;
const QUALITY_TERM_OPTIONS = [['SAMPLE_APPROVAL', 'تأیید نمونه پیش از خرید'], ['PRE_LOADING_INSPECTION', 'بازرسی پیش از بارگیری'], ['DIMENSION_TOLERANCE', 'کنترل ابعاد و تلرانس'], ['SORT_CONSISTENCY', 'یکنواختی سورت و رنگ'], ['NONCONFORMING_RETURN', 'مرجوعی کالای نامنطبق'], ['QUALITY_GUARANTEE', 'تضمین کیفیت'], ['OTHER', 'سایر']] as const;

export function NewRfqForm({ operatorMode = false, draftId }: { operatorMode?: boolean; draftId?: string }) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>('CHECKING');
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
  const [projectName, setProjectName] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [cityId, setCityId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [installationRequired, setInstallationRequired] = useState(false);
  const [qualityControlRequested, setQualityControlRequested] = useState(false);
  const [requiredAt, setRequiredAt] = useState('');
  const [responseDeadline, setResponseDeadline] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('');
  const [paymentDetail, setPaymentDetail] = useState('');
  const [deliveryTimeMode, setDeliveryTimeMode] = useState('FLEXIBLE');
  const [deliverySchedule, setDeliverySchedule] = useState('ONCE');
  const [deliveryScheduleDetail, setDeliveryScheduleDetail] = useState('');
  const [shippingMode, setShippingMode] = useState('NEGOTIABLE');
  const [transportCoordinator, setTransportCoordinator] = useState('');
  const [freightPayer, setFreightPayer] = useState('');
  const [unloadingPayer, setUnloadingPayer] = useState('');
  const [purchaseQualityTerms, setPurchaseQualityTerms] = useState<string[]>([]);
  const [purchaseQualityTermsOther, setPurchaseQualityTermsOther] = useState('');
  const [financialGuaranteeRequired, setFinancialGuaranteeRequired] = useState(false);
  const [financialGuaranteeDetail, setFinancialGuaranteeDetail] = useState('');
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
  const [guestDraftRestored, setGuestDraftRestored] = useState(false);
  const attributesLoading = Boolean(categoryId && loadedCategoryId !== categoryId);
  const isGuest = authState === 'GUEST';

  useEffect(() => {
    let active = true;
    apiRequest('/auth/me')
      .then(() => { if (active) setAuthState('AUTHENTICATED'); })
      .catch(() => { if (active) setAuthState('GUEST'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authState === 'CHECKING') return;
    void Promise.all([
      isGuest ? Promise.resolve([] as Organization[]) : apiRequest<Organization[]>(operatorMode ? '/organizations/admin/buyer-options' : '/organizations/mine'),
      apiRequest<Industry[]>('/catalog/industries'),
      apiRequest<Category[]>('/catalog/categories'),
      apiRequest<Unit[]>('/catalog/units'),
      apiRequest<Province[]>('/locations/provinces'),
      apiRequest<RfqPolicy>(isGuest ? '/public/rfqs/active-policy' : '/rfqs/active-policy'),
      draftId && !isGuest ? apiRequest<CreatedRfq>(`/rfqs/${draftId}`) : Promise.resolve(null),
      draftId && !isGuest ? apiRequest<Attachment[]>(`/attachments/rfqs/${draftId}`) : Promise.resolve([]),
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
        setBuyerContactUserId(draftData.buyerContactUserId); setIndustryId(draftData.primaryDomainId); setTitle(draftData.title); setDescription(draftData.description ?? ''); setProjectName(draftData.projectName ?? '');
        setLoadedCategoryId(''); setCategoryId(firstItem.categoryId); setUnitId(firstItem.unitId); setItemTitle(firstItem.title); setQuantity(firstItem.quantity);
        setSpecifications(firstItem.specifications ?? {}); setProvinceId(draftData.deliveryProvinceId ?? ''); setCityId(draftData.deliveryCityId ?? '');
        setRequiredAt(toLocalDateTime(draftData.requiredAt)); setResponseDeadline(toLocalDateTime(draftData.responseDeadline));
        setDeliveryAddress(draftData.deliveryAddress ?? ''); setPaymentTerm(draftData.paymentTerm ?? ''); setPaymentDetail(draftData.paymentDetail ?? '');
        setDeliveryTimeMode(draftData.deliveryTimeMode ?? 'FLEXIBLE'); setDeliverySchedule(draftData.deliverySchedule ?? 'ONCE'); setDeliveryScheduleDetail(draftData.deliveryScheduleDetail ?? '');
        setShippingMode(draftData.shippingMode ?? 'NEGOTIABLE'); setTransportCoordinator(draftData.transportCoordinator ?? ''); setFreightPayer(draftData.freightPayer ?? ''); setUnloadingPayer(draftData.unloadingPayer ?? '');
        setPurchaseQualityTerms(Array.isArray(draftData.purchaseQualityTerms) ? draftData.purchaseQualityTerms : []); setPurchaseQualityTermsOther(draftData.purchaseQualityTermsOther ?? '');
        setFinancialGuaranteeRequired(draftData.financialGuaranteeRequired); setFinancialGuaranteeDetail(draftData.financialGuaranteeDetail ?? '');
        setSavedItems(draftData.items.slice(1).map((item) => ({ ...item, specifications: item.specifications ?? {} })));
        setInstallationRequired(draftData.installationRequired); setQualityControlRequested(draftData.qualityControlRequested); setDraftDirty(false);
      } else {
        const guestDraft = readGuestRfqDraft();
        setOrganizationId(buyers[0]?.id ?? ''); setIndustryId(guestDraft?.industryId ?? industryData[0]?.id ?? ''); setUnitId(guestDraft?.items[0]?.unitId ?? unitData.find((unit) => unit.code === 'square-meter')?.id ?? unitData[0]?.id ?? '');
        setBuyerContactUserId(buyers[0]?.contacts?.[0]?.id ?? '');
        if (guestDraft) {
          const firstItem = guestDraft.items[0];
          setTitle(guestDraft.title); setDescription(guestDraft.description); setProjectName(guestDraft.projectName); setProvinceId(guestDraft.provinceId); setCityId(guestDraft.cityId); setDeliveryAddress(guestDraft.deliveryAddress);
          setRequiredAt(guestDraft.requiredAt); setResponseDeadline(guestDraft.responseDeadline); setInstallationRequired(guestDraft.installationRequired);
          setPaymentTerm(guestDraft.paymentTerm); setPaymentDetail(guestDraft.paymentDetail); setDeliveryTimeMode(guestDraft.deliveryTimeMode); setDeliverySchedule(guestDraft.deliverySchedule); setDeliveryScheduleDetail(guestDraft.deliveryScheduleDetail);
          setShippingMode(guestDraft.shippingMode); setTransportCoordinator(guestDraft.transportCoordinator); setFreightPayer(guestDraft.freightPayer); setUnloadingPayer(guestDraft.unloadingPayer);
          setPurchaseQualityTerms(guestDraft.purchaseQualityTerms); setPurchaseQualityTermsOther(guestDraft.purchaseQualityTermsOther); setFinancialGuaranteeRequired(guestDraft.financialGuaranteeRequired); setFinancialGuaranteeDetail(guestDraft.financialGuaranteeDetail);
          setQualityControlRequested(guestDraft.qualityControlRequested); setGuestDraftRestored(true);
          if (firstItem) {
            setCategoryId(firstItem.categoryId); setUnitId(firstItem.unitId); setItemTitle(firstItem.title); setQuantity(firstItem.quantity);
            setSpecifications(firstItem.specifications); setSavedItems(guestDraft.items.slice(1));
          }
        }
      }
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'دریافت اطلاعات اولیه انجام نشد.'));
  }, [authState, draftId, isGuest, operatorMode]);

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

  function toggleQualityTerm(code: string, checked: boolean) {
    setPurchaseQualityTerms((current) => checked ? [...new Set([...current, code])] : current.filter((item) => item !== code));
    if (code === 'OTHER' && !checked) setPurchaseQualityTermsOther('');
  }

  function currentItem(): RfqItemDraft | null {
    const hasAnyValue = Boolean(categoryId || itemTitle.trim() || quantity.trim());
    if (!hasAnyValue) return null;
    if (!categoryId || !unitId || itemTitle.trim().length < 2 || !quantity.trim()) {
      throw new Error('ردیف محصول در حال ویرایش ناقص است. دسته، شرح، مقدار و واحد را کامل کنید.');
    }
    return { categoryId, unitId, title: itemTitle.trim(), quantity, specifications };
  }

  function addAnotherItem(copyPrevious = true): boolean {
    setError('');
    try {
      const item = currentItem();
      if (!item) throw new Error('ابتدا مشخصات ردیف محصول را وارد کنید.');
      if (savedItems.length + 1 >= MAX_RFQ_ITEMS) throw new Error('حداکثر ۲۰ ردیف در هر استعلام قابل ثبت است.');
      setSavedItems((current) => [...current, item]);
      if (copyPrevious) {
        setItemTitle(item.title); setQuantity(item.quantity); setSpecifications({ ...item.specifications });
      } else {
        setLoadedCategoryId(''); setCategoryId(''); setItemTitle(''); setQuantity(''); setSpecifications({}); setProductAttributes([]); setCategoryGuidance(null);
      }
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
      setActiveStep(1);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'ویرایش ردیف انجام نشد.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const invalidStep = RFQ_STEPS.slice(0, 2).find((step) => validateStep(step.number));
      if (invalidStep) {
        setActiveStep(invalidStep.number);
        throw new Error(validateStep(invalidStep.number));
      }
      const activeItem = currentItem();
      const items = [...savedItems, ...(activeItem ? [activeItem] : [])];
      if (items.length === 0) throw new Error('استعلام باید حداقل یک ردیف محصول داشته باشد.');
      if (isGuest) {
        const guestDraft: GuestRfqDraft = {
          version: 2,
          savedAt: new Date().toISOString(),
          industryId,
          title: title.trim(),
          description: description.trim(),
          projectName: projectName.trim(),
          provinceId,
          cityId,
          deliveryAddress: deliveryAddress.trim(),
          requiredAt,
          responseDeadline,
          paymentTerm,
          paymentDetail: paymentDetail.trim(),
          deliveryTimeMode,
          deliverySchedule,
          deliveryScheduleDetail: deliveryScheduleDetail.trim(),
          shippingMode,
          transportCoordinator,
          freightPayer,
          unloadingPayer,
          purchaseQualityTerms,
          purchaseQualityTermsOther: purchaseQualityTermsOther.trim(),
          financialGuaranteeRequired,
          financialGuaranteeDetail: financialGuaranteeDetail.trim(),
          installationRequired,
          qualityControlRequested,
          items,
        };
        window.localStorage.setItem(GUEST_RFQ_DRAFT_KEY, JSON.stringify(guestDraft));
        router.push('/login?returnTo=/dashboard/rfqs/new');
        return;
      }
      const payload = {
        buyerOrganizationId: organizationId,
        ...(operatorMode ? { buyerContactUserId } : {}),
        primaryDomainId: industryId,
        title,
        description,
        projectName,
        deliveryProvinceId: provinceId,
        deliveryCityId: cityId,
        deliveryAddress,
        ...(requiredAt ? { requiredAt: new Date(requiredAt).toISOString() } : {}),
        ...(responseDeadline ? { responseDeadline: new Date(responseDeadline).toISOString() } : {}),
        paymentTerm,
        paymentDetail,
        deliveryTimeMode,
        deliverySchedule,
        deliveryScheduleDetail,
        shippingMode,
        transportCoordinator,
        freightPayer,
        unloadingPayer,
        purchaseQualityTerms,
        purchaseQualityTermsOther,
        financialGuaranteeRequired,
        financialGuaranteeDetail,
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
      window.localStorage.removeItem(GUEST_RFQ_DRAFT_KEY);
      window.localStorage.removeItem(LEGACY_GUEST_RFQ_DRAFT_KEY);
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

  if (authState === 'CHECKING') return <div className="card" role="status">در حال آماده‌سازی فرم درخواست خرید…</div>;

  if (!isGuest && !error && organizations.length === 0) return operatorMode
    ? <div className="card"><p>حساب خریدار فعال و دارای فرد تماس پیدا نشد.</p></div>
    : <div className="card"><p>اطلاعات درخواست شما محفوظ است. برای ثبت نهایی، ابتدا حساب خریدار را ایجاد کنید.</p><Link className="button button-primary" href="/dashboard/organization?returnTo=/dashboard/rfqs/new">ایجاد حساب خریدار</Link></div>;

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
      if (!activeItemPresent && savedItems.length > 0) return '';
      if (!categoryId) return 'نوع سنگ را انتخاب کنید.';
      if (itemTitle.trim().length < 2) return 'شرح کوتاهی برای محصول بنویسید.';
      if (!/^\d{1,9}(\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0) return 'مقدار باید عددی مثبت با حداکثر ۹ رقم و ۳ رقم اعشار باشد.';
      if (!unitId) return 'واحد اندازه‌گیری را انتخاب کنید.';
      if (units.find((unit) => unit.id === unitId)?.code === 'piece' && !Number.isInteger(Number(quantity))) return 'مقدار واحد «عدد» باید بدون اعشار باشد.';
      if (attributesLoading) return 'چند لحظه صبر کنید؛ مشخصات فنی محصول در حال دریافت است.';
      if (missingRequiredAttributes.length > 0) return `مشخصات ضروری را کامل کنید: ${missingRequiredAttributes.join('، ')}`;
      if (itemCount > MAX_RFQ_ITEMS) return 'حداکثر ۲۰ ردیف در هر استعلام قابل ثبت است.';
    }
    if (step === 2) {
      if (!isGuest && !organizationId) return 'حساب خریدار را انتخاب کنید.';
      if (operatorMode && !buyerContactUserId) return 'فرد تماس خریدار را انتخاب کنید.';
      if (!industryId) return 'حوزه اصلی را انتخاب کنید.';
      if (title.trim().length < 3) return 'برای استعلام یک عنوان روشن و حداقل سه‌حرفی بنویسید.';
      if (!provinceId) return 'استان تحویل را انتخاب کنید.';
      if (!paymentTerm) return 'شرایط پرداخت را انتخاب کنید.';
      if (['ADVANCE', 'AFTER_DELIVERY', 'CHEQUE', 'BARTER'].includes(paymentTerm) && !paymentDetail.trim()) return 'جزئیات شرایط پرداخت را وارد کنید.';
      if (deliveryTimeMode === 'FIXED' && !requiredAt) return 'تاریخ تحویل موردنیاز را وارد کنید.';
      if (deliverySchedule === 'STAGED' && !deliveryScheduleDetail.trim()) return 'برنامه تحویل مرحله‌ای را توضیح دهید.';
      if (shippingMode === 'DESTINATION' && !deliveryAddress.trim()) return 'نشانی محل تحویل را وارد کنید.';
      if (shippingMode === 'DESTINATION' && (!transportCoordinator || !freightPayer || !unloadingPayer)) return 'مسئولیت هماهنگی حمل، کرایه و تخلیه را مشخص کنید.';
      if (purchaseQualityTerms.includes('OTHER') && !purchaseQualityTermsOther.trim()) return 'شرط کنترل کیفیت «سایر» را توضیح دهید.';
      if (financialGuaranteeRequired && !financialGuaranteeDetail.trim()) return 'نوع و شرایط تضمین مالی را توضیح دهید.';
      if (responseDeadline && new Date(responseDeadline) <= new Date()) return 'مهلت دریافت پیشنهاد باید در آینده باشد.';
      if (requiredAt && new Date(requiredAt) <= new Date()) return 'زمان موردنیاز باید در آینده باشد.';
      if (responseDeadline && requiredAt && new Date(responseDeadline) >= new Date(requiredAt)) return 'مهلت دریافت پیشنهاد باید پیش از تاریخ تحویل باشد.';
    }
    return '';
  }

  function goToStep(step: number): void {
    if (step > activeStep) {
      const issue = validateStep(activeStep);
      if (issue) { setError(issue); return; }
    }
    setError('');
    setActiveStep(Math.min(3, Math.max(1, step)));
    document.getElementById('rfq-form-panel')?.scrollIntoView({ block: 'start' });
  }

  function isStepComplete(step: number): boolean {
    if (step === 1) return (Boolean(categoryId) || savedItems.length > 0) && validateStep(step) === '';
    if (step === 3) return Boolean(created) && !draftDirty;
    return validateStep(step) === '';
  }

  return <div className="rfq-workspace">
    <form id="rfq-form-panel" className="card rfq-form rfq-wizard" onSubmit={submit} onChangeCapture={(event) => {
      if (created && (!(event.target instanceof HTMLInputElement) || event.target.type !== 'file')) setDraftDirty(true);
    }}>
      <nav className="rfq-wizard-progress" aria-label="مراحل ثبت استعلام"><ol>{RFQ_STEPS.map((step) => <li className={activeStep === step.number ? 'is-current' : isStepComplete(step.number) ? 'is-complete' : ''} key={step.number}><button type="button" onClick={() => goToStep(step.number)} disabled={step.number > activeStep} aria-current={activeStep === step.number ? 'step' : undefined}><b>{isStepComplete(step.number) ? '✓' : step.number.toLocaleString('fa-IR')}</b><span><strong>{step.title}</strong><small>{step.description}</small></span></button></li>)}</ol></nav>

      {error && <div className="message message-error rfq-wizard-message" role="alert" aria-live="assertive">{error}</div>}
      {isGuest && <div className="message rfq-wizard-message" role="status"><strong>ابتدا درخواست خرید را کامل کنید.</strong><span>ورود و ساخت حساب به پایان فرم موکول شده است.</span></div>}
      {guestDraftRestored && <div className="message message-success rfq-wizard-message" role="status">پیش‌نویس قبلی شما بازیابی شد.</div>}
      {created && <div className="message message-success rfq-wizard-message" aria-live="polite"><strong>{created.lifecycleState === 'DRAFT' ? (draftDirty ? 'تغییرات ذخیره‌نشده دارید.' : 'پیش‌نویس با موفقیت ذخیره شد.') : created.operationalStatus === 'UNDER_REVIEW' ? 'استعلام در صف بررسی است.' : created.operationalStatus === 'WAITING_COMMITMENT' ? 'استعلام تأیید شد و منتظر تکمیل تعهد خریدار است.' : 'استعلام تأیید شد و آماده انتشار است.'}</strong><span>کد استعلام: {created.code}</span>{created.lifecycleState === 'DRAFT' && <button type="button" className="button button-secondary" onClick={() => void submitForReview()} disabled={busy || draftDirty}>{draftDirty ? 'ابتدا تغییرات را ذخیره کنید' : policy?.pilotManualReview === false ? 'ثبت نهایی استعلام' : 'ارسال برای بررسی وازانو'}</button>}{created.lifecycleState !== 'DRAFT' && <Link className="button button-secondary" href={`/dashboard/rfqs/${created.id}`}>مشاهده جزئیات و ادامه فرایند</Link>}</div>}

      {activeStep === 1 && <section className="rfq-wizard-panel" aria-labelledby="rfq-step-1">
        <header><span>مرحله ۱ از ۳</span><h2 id="rfq-step-1">ردیف‌های سنگ موردنیاز</h2><p>هر نوع، ابعاد یا سورت متفاوت را در یک ردیف جدا ثبت کنید. حداکثر ۲۰ ردیف.</p></header>
        {savedItems.length > 0 && <div className="rfq-saved-items"><h3>ردیف‌های ذخیره‌شده ({savedItems.length.toLocaleString('fa-IR')})</h3>{savedItems.map((item, index) => <div className="list-card" key={`${item.categoryId}-${index}`}><div><strong>{item.title}</strong><p className="muted">{categories.find((category) => category.id === item.categoryId)?.nameFa ?? 'سنگ طبیعی'} · {item.quantity} {units.find((unit) => unit.id === item.unitId)?.symbolFa ?? ''}</p></div><div className="list-card-actions"><button className="button button-secondary" type="button" onClick={() => editSavedItem(index)}>ویرایش</button><button className="button button-ghost" type="button" onClick={() => setSavedItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>حذف</button></div></div>)}</div>}
        <div className="rfq-line-editor"><div className="rfq-line-editor-heading"><div><span className="eyebrow">ردیف در حال ویرایش</span><h3>ردیف {(savedItems.length + 1).toLocaleString('fa-IR')}</h3></div><span>{itemCount.toLocaleString('fa-IR')} از {MAX_RFQ_ITEMS.toLocaleString('fa-IR')}</span></div>
          <div className="form-columns">
            <label className="form-field"><span>نوع سنگ *</span><select value={categoryId} onChange={(event) => { setLoadedCategoryId(''); setCategoryId(event.target.value); setProductAttributes([]); setCategoryGuidance(null); setSpecifications({}); }} required><option value="">انتخاب نوع سنگ</option>{selectableCategories.map((item) => <option value={item.id} key={item.id}>{item.nameFa}</option>)}</select></label>
            <label className="form-field"><span>نام یا شرح سنگ *</span><input value={itemTitle} onChange={(event) => setItemTitle(event.target.value)} required minLength={2} maxLength={160} placeholder="مثلاً تراورتن کرم عباس‌آباد برای نما" /></label>
            <label className="form-field"><span>مقدار *</span><input value={quantity} onChange={(event) => setQuantity(normalizeDecimalInput(event.target.value).slice(0, 13))} required inputMode="decimal" dir="ltr" pattern="[0-9]{1,9}([.][0-9]{1,3})?" placeholder="مثال: 850" /></label>
            <label className="form-field"><span>واحد *</span><select value={unitId} onChange={(event) => setUnitId(event.target.value)} required><option value="">انتخاب واحد</option>{units.map((item) => <option value={item.id} key={item.id}>{item.nameFa} ({item.symbolFa})</option>)}</select></label>
          </div>
          <details className="rfq-technical-details" open><summary>مشخصات فنی و معیارهای مقایسه</summary>{attributesLoading ? <div className="message" role="status">در حال آماده‌سازی مشخصات فنی…</div> : productAttributes.length > 0 ? <div className="form-columns">{productAttributes.map((attribute) => {
            const label = attributeLabel(attribute); const value = specifications[attribute.code];
            if (!shouldShowAttribute(attribute.code, specifications)) return null;
            if (attribute.dataType === 'SINGLE_SELECT') return <label className="form-field" key={attribute.id}><span>{label}{attribute.isRequired ? ' *' : ''}</span><select aria-label={label} value={typeof value === 'string' ? value : ''} required={attribute.isRequired} onChange={(event) => setSpecifications((current) => ({ ...current, [attribute.code]: event.target.value }))}><option value="">انتخاب کنید</option>{attribute.options.map((option) => <option value={option} key={option}>{option}</option>)}</select></label>;
            if (attribute.dataType === 'MULTI_SELECT') return <fieldset className={`attribute-options ${attribute.code === 'application' ? 'application-options' : ''}`} key={attribute.id}><legend>{label}{attribute.isRequired ? ' *' : ''}</legend>{attribute.options.map((option) => <label className="check-field" key={option}><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={(event) => toggleMultiValue(attribute.code, option, event.target.checked)} /><span>{option}</span></label>)}</fieldset>;
            if (attribute.dataType === 'BOOLEAN') return <label className="check-field rfq-option" key={attribute.id}><input type="checkbox" checked={value === true} onChange={(event) => setSpecifications((current) => ({ ...current, [attribute.code]: event.target.checked }))} /><span>{label}</span></label>;
            const minimum = typeof attribute.validation.min === 'number' ? attribute.validation.min : undefined; const maximum = typeof attribute.validation.max === 'number' ? attribute.validation.max : undefined; const maxLength = typeof attribute.validation.maxLength === 'number' ? attribute.validation.maxLength : undefined;
            return <label className="form-field" key={attribute.id}><span>{label}{attribute.isRequired ? ' *' : ''}</span><input aria-label={label} type={attribute.dataType === 'NUMBER' ? 'text' : 'text'} inputMode={attribute.dataType === 'NUMBER' ? 'decimal' : undefined} dir={attribute.dataType === 'NUMBER' ? 'ltr' : undefined} maxLength={attribute.dataType === 'TEXT' ? maxLength : 12} value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} required={attribute.isRequired} placeholder={attribute.dataType === 'NUMBER' ? [minimum, maximum].filter((item) => item !== undefined).join(' تا ') : undefined} onChange={(event) => setSpecifications((current) => ({ ...current, [attribute.code]: attribute.dataType === 'NUMBER' ? normalizeDecimalInput(event.target.value) : event.target.value }))} /></label>;
          })}</div> : <div className="message">پس از انتخاب نوع سنگ، فیلدهای فنی نمایش داده می‌شوند.</div>}</details>
        </div>
        {categoryGuidance?.profile && <aside className="stone-guidance" aria-live="polite"><div className="stone-guidance-heading"><div><strong>راهنمای تخصصی وازانو</strong><p>محل مصرف را دقیق انتخاب کنید تا پیشنهادها قابل‌اعتمادتر شوند.</p></div><span>پایگاه دانش سنگ</span></div>{activeGuidance.selectedApplications.length === 0 ? <div className="message">در «محل مصرف» حداقل یک گزینه را انتخاب کنید.</div> : <><div className="stone-guidance-applications">{activeGuidance.selectedApplications.map((application) => <span key={application.code}>{application.labelFa}</span>)}</div>{activeGuidance.sensitive && <div className="message message-warning"><strong>کاربرد حساس:</strong> انتخاب نهایی پس از بررسی نمونه و مدارک فنی همان پارت انجام شود.</div>}<details className="rfq-guidance-details"><summary>راهنمای فنی و معیارهای مقایسه</summary><div className="stone-guidance-grid"><section><h3>کنترل‌های لازم</h3><ul>{activeGuidance.requiredChecks.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>معیار مقایسه</h3><ul>{activeGuidance.comparisonCriteria.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h3>خانواده‌های مناسب</h3><ul>{activeGuidance.suggestedFamilies.map((item) => <li key={item}>{item}</li>)}</ul></section></div></details><p className="stone-guidance-disclaimer">{categoryGuidance.disclaimerFa}</p></>}</aside>}
        <div className="rfq-line-actions"><button className="button button-secondary" type="button" disabled={itemCount >= MAX_RFQ_ITEMS} onClick={() => void addAnotherItem(true)}>ذخیره و افزودن ردیف مشابه</button><button className="button button-ghost" type="button" disabled={itemCount >= MAX_RFQ_ITEMS} onClick={() => void addAnotherItem(false)}>ذخیره و افزودن ردیف خالی</button></div>
      </section>}

      {activeStep === 2 && <section className="rfq-wizard-panel" aria-labelledby="rfq-step-2">
        <header><span>مرحله ۲ از ۳</span><h2 id="rfq-step-2">اطلاعات مشترک استعلام</h2><p>اطلاعات پروژه، تحویل، پرداخت و کنترل کیفیت برای همه ردیف‌ها یکسان است.</p></header>
        <fieldset className="fieldset"><legend>خریدار و پروژه</legend><div className="form-columns">
          {!isGuest && <label className="form-field"><span>حساب خریدار *</span><select value={organizationId} disabled={Boolean(created)} onChange={(event) => { const nextId = event.target.value; setOrganizationId(nextId); setBuyerContactUserId(organizations.find((item) => item.id === nextId)?.contacts?.[0]?.id ?? ''); }} required>{organizations.map((item) => <option value={item.id} key={item.id}>{buyerOrganizationLabel(item, operatorMode)}</option>)}</select></label>}
          {operatorMode && <label className="form-field"><span>فرد تماس خریدار *</span><select value={buyerContactUserId} disabled={Boolean(created)} onChange={(event) => setBuyerContactUserId(event.target.value)} required><option value="">انتخاب کنید</option>{selectedOrganization?.contacts?.map((contact) => <option value={contact.id} key={contact.id}>{contact.displayName} — {contact.mobileMasked}</option>)}</select></label>}
          <label className="form-field"><span>حوزه خرید *</span><select value={industryId} onChange={(event) => setIndustryId(event.target.value)} required>{industries.map((item) => <option value={item.id} key={item.id}>{item.nameFa}</option>)}</select></label>
          <label className="form-field"><span>نام پروژه <em>اختیاری</em></span><input value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={160} placeholder="مثلاً مجتمع مسکونی سپیدار" /></label>
          <label className="form-field full"><span>عنوان استعلام *</span><input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} maxLength={120} placeholder="مثلاً تأمین سنگ نمای پروژه سپیدار" /></label>
          <label className="form-field full"><span>توضیحات مشترک <em>اختیاری</em></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={3} placeholder="نکاتی که برای همه ردیف‌ها و فروشندگان مهم است" /><small>{description.length.toLocaleString('fa-IR')} از ۲٬۰۰۰ نویسه</small></label>
        </div></fieldset>
        <fieldset className="fieldset"><legend>مقصد و زمان‌بندی</legend><div className="form-columns">
          <label className="form-field"><span>استان تحویل *</span><select value={provinceId} onChange={(event) => { setProvinceId(event.target.value); setCities([]); setCityId(''); }} required><option value="">انتخاب استان</option>{provinces.filter((item) => policy?.marketCoverageMode !== 'SELECTED_PROVINCES' || policy.marketCoverageProvinceCodes.includes(item.code)).map((item) => <option value={item.id} key={item.id}>{item.nameFa}</option>)}</select></label>
          <label className="form-field"><span>شهر تحویل <em>اختیاری</em></span><select value={cityId} onChange={(event) => setCityId(event.target.value)} disabled={!provinceId}><option value="">{provinceId ? 'انتخاب شهر' : 'ابتدا استان را انتخاب کنید'}</option>{cities.map((item) => <option value={item.id} key={item.id}>{item.nameFa}{item.isProvinceCapital ? ' (مرکز استان)' : ''}</option>)}</select></label>
          <label className="form-field full"><span>نشانی تحویل <em>{shippingMode === 'DESTINATION' ? 'الزامی' : 'اختیاری'}</em></span><input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} maxLength={500} placeholder="شهر، منطقه، نشانی پروژه یا کارگاه" /></label>
          <label className="form-field"><span>مهلت دریافت پیشنهاد <em>اختیاری</em></span><input type="datetime-local" value={responseDeadline} onChange={(event) => setResponseDeadline(event.target.value)} /></label>
          <label className="form-field"><span>زمان تحویل</span><select value={deliveryTimeMode} onChange={(event) => { setDeliveryTimeMode(event.target.value); if (event.target.value !== 'FIXED') setRequiredAt(''); }}><option value="FLEXIBLE">انعطاف‌پذیر</option><option value="URGENT">فوری</option><option value="FIXED">تاریخ مشخص</option></select></label>
          {deliveryTimeMode === 'FIXED' && <label className="form-field"><span>تاریخ تحویل موردنیاز *</span><input type="datetime-local" value={requiredAt} onChange={(event) => setRequiredAt(event.target.value)} required /></label>}
          <label className="form-field"><span>برنامه تحویل</span><select value={deliverySchedule} onChange={(event) => setDeliverySchedule(event.target.value)}><option value="ONCE">یک‌مرحله‌ای</option><option value="STAGED">مرحله‌ای</option><option value="NEGOTIABLE">قابل مذاکره</option></select></label>
          {deliverySchedule === 'STAGED' && <label className="form-field full"><span>برنامه تحویل مرحله‌ای *</span><textarea value={deliveryScheduleDetail} onChange={(event) => setDeliveryScheduleDetail(event.target.value)} maxLength={500} rows={2} placeholder="مثلاً ۵۰۰ متر در آذر و ۳۵۰ متر در دی" /></label>}
        </div></fieldset>
        <fieldset className="fieldset"><legend>پرداخت، حمل و تخلیه</legend><div className="form-columns">
          <label className="form-field"><span>شرایط پرداخت *</span><select value={paymentTerm} onChange={(event) => { setPaymentTerm(event.target.value); if (!['ADVANCE', 'AFTER_DELIVERY', 'CHEQUE', 'BARTER'].includes(event.target.value)) setPaymentDetail(''); }} required><option value="">انتخاب کنید</option>{PAYMENT_TERMS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          {['ADVANCE', 'AFTER_DELIVERY', 'CHEQUE', 'BARTER'].includes(paymentTerm) && <label className="form-field full"><span>جزئیات پرداخت *</span><textarea value={paymentDetail} onChange={(event) => setPaymentDetail(event.target.value)} maxLength={500} rows={2} placeholder="درصد پیش‌پرداخت، سررسید چک یا شرایط تهاتر" /></label>}
          <label className="form-field"><span>مبنای قیمت و تحویل</span><select value={shippingMode} onChange={(event) => setShippingMode(event.target.value)}><option value="FACTORY">درب کارخانه</option><option value="DESTINATION">تحویل در مقصد</option><option value="NEGOTIABLE">قابل مذاکره</option></select></label>
          {shippingMode === 'DESTINATION' && <><label className="form-field"><span>هماهنگ‌کننده حمل *</span><select value={transportCoordinator} onChange={(event) => setTransportCoordinator(event.target.value)} required><option value="">انتخاب کنید</option>{PARTY_OPTIONS.filter(([value]) => value !== 'INCLUDED').map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="form-field"><span>پرداخت‌کننده کرایه *</span><select value={freightPayer} onChange={(event) => setFreightPayer(event.target.value)} required><option value="">انتخاب کنید</option>{PARTY_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="form-field"><span>مسئول هزینه تخلیه *</span><select value={unloadingPayer} onChange={(event) => setUnloadingPayer(event.target.value)} required><option value="">انتخاب کنید</option>{PARTY_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></>}
        </div></fieldset>
        <fieldset className="fieldset"><legend>کنترل کیفیت و تضمین</legend><div className="attribute-options rfq-common-options">{QUALITY_TERM_OPTIONS.map(([value, label]) => <label className="check-field" key={value}><input type="checkbox" checked={purchaseQualityTerms.includes(value)} onChange={(event) => toggleQualityTerm(value, event.target.checked)} /><span>{label}</span></label>)}</div>{purchaseQualityTerms.includes('OTHER') && <label className="form-field"><span>توضیح شرط دیگر *</span><textarea value={purchaseQualityTermsOther} onChange={(event) => setPurchaseQualityTermsOther(event.target.value)} maxLength={500} rows={2} /></label>}<label className="check-field rfq-option"><input type="checkbox" checked={financialGuaranteeRequired} onChange={(event) => setFinancialGuaranteeRequired(event.target.checked)} /><span><strong>تضمین مالی لازم است</strong><small>نوع ضمانت‌نامه، چک یا تضامین قراردادی را مشخص کنید.</small></span></label>{financialGuaranteeRequired && <label className="form-field"><span>جزئیات تضمین مالی *</span><textarea value={financialGuaranteeDetail} onChange={(event) => setFinancialGuaranteeDetail(event.target.value)} maxLength={500} rows={2} /></label>}</fieldset>
        <div className="rfq-service-options"><label className="check-field rfq-option"><input type="checkbox" checked={installationRequired} onChange={(event) => setInstallationRequired(event.target.checked)} /><span><strong>به خدمات نصب نیاز دارم</strong><small>هزینه و شرایط نصب جداگانه اعلام می‌شود.</small></span></label>{policy?.qualityControlEnabled !== false ? <label className="check-field rfq-option"><input type="checkbox" checked={qualityControlRequested} onChange={(event) => setQualityControlRequested(event.target.checked)} /><span><strong>کنترل کیفیت توسط وازانو</strong><small>کارمزد {((policy?.qualityControlFeeBps ?? 300) / 100).toLocaleString('fa-IR')}٪ مبلغ خرید؛ فقط با درخواست خریدار.</small></span></label> : <div className="message">خدمت کنترل کیفیت در حال حاضر غیرفعال است.</div>}</div>
      </section>}

      {activeStep === 3 && <section className="rfq-wizard-panel" aria-labelledby="rfq-step-3">
        <header><span>مرحله ۳ از ۳</span><h2 id="rfq-step-3">بازبینی استعلام</h2><p>پیش از ذخیره، تعداد ردیف‌ها و شرایط اصلی را کنترل کنید.</p></header>
        <div className="rfq-review-card"><h3>{title || 'عنوان استعلام وارد نشده'}</h3><dl><div><dt>خریدار</dt><dd>{isGuest ? 'پس از ورود مشخص می‌شود' : selectedOrganization?.displayName ?? '—'}</dd></div><div><dt>پروژه</dt><dd>{projectName || 'ثبت نشده'}</dd></div><div><dt>تعداد ردیف</dt><dd>{itemCount.toLocaleString('fa-IR')}</dd></div><div><dt>تحویل</dt><dd>{[selectedProvince?.nameFa, selectedCity?.nameFa].filter(Boolean).join('، ') || '—'}</dd></div><div><dt>شرایط پرداخت</dt><dd>{PAYMENT_TERMS.find(([value]) => value === paymentTerm)?.[1] ?? '—'}</dd></div><div><dt>نمایش قیمت</dt><dd>{policy?.displayPricesTaxInclusive ? 'با مالیات' : 'بدون مالیات'}</dd></div></dl></div>
        <div className="rfq-review-lines"><h3>ردیف‌های درخواست</h3>{[...savedItems, ...(activeItemPresent ? [{ categoryId, unitId, title: itemTitle, quantity, specifications }] : [])].map((item, index) => <div className="list-card" key={`${item.categoryId}-${index}`}><span>{(index + 1).toLocaleString('fa-IR')}</span><div><strong>{item.title}</strong><p className="muted">{categories.find((category) => category.id === item.categoryId)?.nameFa} · {item.quantity} {units.find((unit) => unit.id === item.unitId)?.symbolFa}</p></div></div>)}</div>
        <div className="message rfq-legal-note">{legalRoleText(policy?.legalRole)} مبلغ کالا، حمل و نصب مستقیماً میان خریدار و فروشنده تعیین می‌شود. ذخیره فرم فقط پیش‌نویس می‌سازد و هنوز برای فروشندگان ارسال نمی‌شود.</div>
        {!created && <div className="message"><strong>پیوست‌ها پس از ذخیره پیش‌نویس قابل بارگذاری‌اند.</strong><span>به این ترتیب فایل‌ها با کد استعلام و بررسی امنیتی نگه‌داری می‌شوند.</span></div>}
        {created && created.lifecycleState === 'DRAFT' && <fieldset className="fieldset rfq-attachments"><legend>نقشه، تصویر، متره یا پیوست</legend><p className="muted">PDF، تصویر، Word یا Excel تا ۲۰ مگابایت؛ فایل پس از بررسی امنیتی قابل استفاده می‌شود.</p><div className="attachment-upload-row"><input aria-label="انتخاب فایل پیوست" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.docx" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} /><button className="button button-secondary" type="button" disabled={busy || !selectedFile} onClick={() => void uploadAttachment()}>بارگذاری فایل</button></div>{attachments.length > 0 && <ul>{attachments.map((attachment) => <li key={attachment.id}>{attachment.originalName} — {attachmentStatusLabel(attachment.status)}</li>)}</ul>}</fieldset>}
      </section>}

      <footer className="rfq-wizard-actions"><button className="button button-ghost" type="button" onClick={() => goToStep(activeStep - 1)} disabled={activeStep === 1 || busy}>مرحله قبل</button><span>مرحله {activeStep.toLocaleString('fa-IR')} از ۳</span>{activeStep < 3 ? <button key="next-step" className="button button-primary" type="button" onClick={() => goToStep(activeStep + 1)}>ادامه</button> : <button key="submit-rfq" className="button button-primary rfq-submit" type="submit" disabled={busy || (!isGuest && !organizationId) || !provinceId || (operatorMode && !buyerContactUserId)}>{busy ? 'در حال ذخیره…' : isGuest ? 'ورود و ذخیره درخواست' : created ? 'ذخیره تغییرات پیش‌نویس' : operatorMode ? 'ثبت پیش‌نویس از طرف خریدار' : 'ذخیره پیش‌نویس استعلام'}</button>}</footer>
    </form>
    <aside className="card rfq-live-summary" aria-label="خلاصه زنده استعلام"><span className="eyebrow">خلاصه استعلام</span><h2>{title || 'استعلام چندردیفی جدید'}</h2><p>ساختار فرم با الگوی چندردیفی وازانو هماهنگ شده است.</p><dl><div><dt>مرحله فعلی</dt><dd>{RFQ_STEPS[activeStep - 1]?.title}</dd></div><div><dt>ردیف‌ها</dt><dd>{itemCount ? `${itemCount.toLocaleString('fa-IR')} ردیف` : 'هنوز وارد نشده'}</dd></div><div><dt>مقصد</dt><dd>{[selectedProvince?.nameFa, selectedCity?.nameFa].filter(Boolean).join('، ') || 'هنوز مشخص نشده'}</dd></div></dl><div className="rfq-draft-assurance"><b>پیش‌نویس امن</b><span>هیچ اطلاعاتی تا ثبت نهایی برای فروشندگان ارسال نمی‌شود.</span></div></aside>
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

function shouldShowAttribute(code: string, specifications: Record<string, SpecificationValue>): boolean {
  if (code === 'length-cm') return specifications['length-mode'] === 'طول ثابت';
  if (code === 'minimum-length-cm') return specifications['length-mode'] === 'حداقل طول';
  if (code === 'width-cm') return specifications['width-mode'] === 'عرض مشخص';
  if (code === 'thickness-mm') return specifications['thickness-mode'] === 'ضخامت مشخص';
  if (code === 'tolerance-details') return Array.isArray(specifications.tolerances) && specifications.tolerances.length > 0;
  if (code === 'technical-standard-details') return Array.isArray(specifications['technical-standards']) && specifications['technical-standards'].includes('سایر');
  if (code === 'sample-detail') return Boolean(specifications['sample-mode'] && specifications['sample-mode'] !== 'نیاز نیست');
  return true;
}

function readGuestRfqDraft(): GuestRfqDraft | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(GUEST_RFQ_DRAFT_KEY) ?? window.localStorage.getItem(LEGACY_GUEST_RFQ_DRAFT_KEY);
  if (!value) return null;
  try {
    const draft = JSON.parse(value) as Partial<GuestRfqDraft> & { version?: number };
    if (![1, 2].includes(draft.version ?? 0) || !Array.isArray(draft.items) || typeof draft.title !== 'string') return null;
    return {
      version: 2,
      savedAt: typeof draft.savedAt === 'string' ? draft.savedAt : new Date().toISOString(),
      industryId: draft.industryId ?? '', title: draft.title, description: draft.description ?? '', projectName: draft.projectName ?? '',
      provinceId: draft.provinceId ?? '', cityId: draft.cityId ?? '', deliveryAddress: draft.deliveryAddress ?? '',
      requiredAt: draft.requiredAt ?? '', responseDeadline: draft.responseDeadline ?? '', paymentTerm: draft.paymentTerm ?? '', paymentDetail: draft.paymentDetail ?? '',
      deliveryTimeMode: draft.deliveryTimeMode ?? 'FLEXIBLE', deliverySchedule: draft.deliverySchedule ?? 'ONCE', deliveryScheduleDetail: draft.deliveryScheduleDetail ?? '',
      shippingMode: draft.shippingMode ?? 'NEGOTIABLE', transportCoordinator: draft.transportCoordinator ?? '', freightPayer: draft.freightPayer ?? '', unloadingPayer: draft.unloadingPayer ?? '',
      purchaseQualityTerms: Array.isArray(draft.purchaseQualityTerms) ? draft.purchaseQualityTerms : [], purchaseQualityTermsOther: draft.purchaseQualityTermsOther ?? '',
      financialGuaranteeRequired: draft.financialGuaranteeRequired ?? false, financialGuaranteeDetail: draft.financialGuaranteeDetail ?? '',
      installationRequired: draft.installationRequired ?? false, qualityControlRequested: draft.qualityControlRequested ?? false, items: draft.items,
    };
  } catch {
    window.localStorage.removeItem(GUEST_RFQ_DRAFT_KEY);
    window.localStorage.removeItem(LEGACY_GUEST_RFQ_DRAFT_KEY);
    return null;
  }
}
