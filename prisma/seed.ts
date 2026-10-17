import { PrismaClient } from '@prisma/client';
import { normalizeIranianMobile } from '../src/modules/auth/domain/mobile';

const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === 'production';
const permissions = [
  'user.read', 'user.manage', 'organization.read', 'organization.manage', 'supplier.verify',
  'category.read', 'category.manage', 'rfq.create', 'rfq.create_on_behalf', 'rfq.read', 'rfq.review',
  'rfq.manage', 'quotation.create', 'quotation.read', 'quotation.manage', 'subscription.read',
  'subscription.manage', 'billing.read', 'billing.manage', 'payment.manage', 'content.manage',
  'support.manage', 'quality_control.manage', 'contract.manage', 'report.read', 'audit.read', 'role.manage', 'settings.read', 'settings.manage', 'location.read', 'location.manage',
];
const roles: Record<string, string[]> = {
  SUPER_ADMIN: permissions,
  ADMIN: permissions.filter((key) => !['role.manage', 'settings.manage'].includes(key)),
  SUPPORT: ['user.read', 'organization.read', 'rfq.read', 'rfq.create_on_behalf', 'quotation.read', 'support.manage', 'quality_control.manage', 'contract.manage'],
  FINANCE: ['organization.read', 'subscription.read', 'subscription.manage', 'billing.read', 'billing.manage', 'payment.manage', 'report.read'],
  CONTENT_MANAGER: ['category.read', 'category.manage', 'content.manage', 'location.read', 'location.manage'],
  BUYER_OWNER: ['organization.read', 'organization.manage', 'category.read', 'rfq.create', 'rfq.read', 'quotation.read'],
  BUYER_MEMBER: ['organization.read', 'category.read', 'rfq.create', 'rfq.read', 'quotation.read'],
  SUPPLIER_OWNER: ['organization.read', 'organization.manage', 'category.read', 'rfq.read', 'quotation.create', 'quotation.read', 'subscription.read', 'billing.read'],
  SUPPLIER_MANAGER: ['organization.read', 'category.read', 'rfq.read', 'quotation.create', 'quotation.read', 'subscription.read'],
  SUPPLIER_SALES: ['organization.read', 'category.read', 'rfq.read', 'quotation.create', 'quotation.read'],
};
const roleNamesFa: Record<string, string> = {
  SUPER_ADMIN: 'مدیر ارشد', ADMIN: 'مدیر سامانه', SUPPORT: 'پشتیبانی', FINANCE: 'مالی', CONTENT_MANAGER: 'مدیر محتوا',
  BUYER_OWNER: 'مالک سازمان خریدار', BUYER_MEMBER: 'عضو سازمان خریدار', SUPPLIER_OWNER: 'مالک سازمان فروشنده',
  SUPPLIER_MANAGER: 'مدیر فروش', SUPPLIER_SALES: 'کارشناس فروش',
};

const iranProvinces = [
  ['east-azerbaijan', 'آذربایجان شرقی', 'East Azerbaijan', 'tabriz', 'تبریز', 'Tabriz'],
  ['west-azerbaijan', 'آذربایجان غربی', 'West Azerbaijan', 'urmia', 'ارومیه', 'Urmia'],
  ['ardabil', 'اردبیل', 'Ardabil', 'ardabil', 'اردبیل', 'Ardabil'],
  ['isfahan', 'اصفهان', 'Isfahan', 'isfahan', 'اصفهان', 'Isfahan'],
  ['alborz', 'البرز', 'Alborz', 'karaj', 'کرج', 'Karaj'],
  ['ilam', 'ایلام', 'Ilam', 'ilam', 'ایلام', 'Ilam'],
  ['bushehr', 'بوشهر', 'Bushehr', 'bushehr', 'بوشهر', 'Bushehr'],
  ['tehran', 'تهران', 'Tehran', 'tehran', 'تهران', 'Tehran'],
  ['chaharmahal-bakhtiari', 'چهارمحال و بختیاری', 'Chaharmahal and Bakhtiari', 'shahrekord', 'شهرکرد', 'Shahrekord'],
  ['south-khorasan', 'خراسان جنوبی', 'South Khorasan', 'birjand', 'بیرجند', 'Birjand'],
  ['razavi-khorasan', 'خراسان رضوی', 'Razavi Khorasan', 'mashhad', 'مشهد', 'Mashhad'],
  ['north-khorasan', 'خراسان شمالی', 'North Khorasan', 'bojnord', 'بجنورد', 'Bojnord'],
  ['khuzestan', 'خوزستان', 'Khuzestan', 'ahvaz', 'اهواز', 'Ahvaz'],
  ['zanjan', 'زنجان', 'Zanjan', 'zanjan', 'زنجان', 'Zanjan'],
  ['semnan', 'سمنان', 'Semnan', 'semnan', 'سمنان', 'Semnan'],
  ['sistan-baluchestan', 'سیستان و بلوچستان', 'Sistan and Baluchestan', 'zahedan', 'زاهدان', 'Zahedan'],
  ['fars', 'فارس', 'Fars', 'shiraz', 'شیراز', 'Shiraz'],
  ['qazvin', 'قزوین', 'Qazvin', 'qazvin', 'قزوین', 'Qazvin'],
  ['qom', 'قم', 'Qom', 'qom', 'قم', 'Qom'],
  ['kurdistan', 'کردستان', 'Kurdistan', 'sanandaj', 'سنندج', 'Sanandaj'],
  ['kerman', 'کرمان', 'Kerman', 'kerman', 'کرمان', 'Kerman'],
  ['kermanshah', 'کرمانشاه', 'Kermanshah', 'kermanshah', 'کرمانشاه', 'Kermanshah'],
  ['kohgiluyeh-boyer-ahmad', 'کهگیلویه و بویراحمد', 'Kohgiluyeh and Boyer-Ahmad', 'yasuj', 'یاسوج', 'Yasuj'],
  ['golestan', 'گلستان', 'Golestan', 'gorgan', 'گرگان', 'Gorgan'],
  ['gilan', 'گیلان', 'Gilan', 'rasht', 'رشت', 'Rasht'],
  ['lorestan', 'لرستان', 'Lorestan', 'khorramabad', 'خرم‌آباد', 'Khorramabad'],
  ['mazandaran', 'مازندران', 'Mazandaran', 'sari', 'ساری', 'Sari'],
  ['markazi', 'مرکزی', 'Markazi', 'arak', 'اراک', 'Arak'],
  ['hormozgan', 'هرمزگان', 'Hormozgan', 'bandar-abbas', 'بندرعباس', 'Bandar Abbas'],
  ['hamedan', 'همدان', 'Hamedan', 'hamedan', 'همدان', 'Hamedan'],
  ['yazd', 'یزد', 'Yazd', 'yazd', 'یزد', 'Yazd'],
] as const;

const naturalStoneCategories = [
  ['travertine', 'travertine', 'تراورتن', 'Travertine'],
  ['marmarit', 'marmarit', 'مرمریت', 'Marmarit'],
  ['granite', 'granite', 'گرانیت', 'Granite'],
  ['crystal-china', 'crystal-china', 'چینی و کریستال', 'Crystal / China Stone'],
  ['onyx-marble', 'onyx-marble', 'مرمر', 'Onyx Marble'],
  ['andesite', 'andesite', 'آندزیت', 'Andesite'],
  ['basalt', 'basalt', 'بازالت', 'Basalt'],
  ['tramite', 'tramite', 'ترامیت', 'Tramite'],
  ['travonyx', 'travonyx', 'تراونیکس', 'Travonyx'],
  ['limestone', 'limestone', 'لایم‌استون و سنگ آهک', 'Limestone'],
  ['sandstone', 'sandstone', 'ماسه‌سنگ', 'Sandstone'],
  ['quartzite', 'quartzite', 'کوارتزیت', 'Quartzite'],
  ['slate', 'slate', 'اسلیت و سنگ لوح', 'Slate'],
  ['tuff', 'tuff', 'توف', 'Tuff'],
  ['conglomerate', 'conglomerate', 'کنگلومرا', 'Conglomerate'],
] as const;

const stoneApplicationOptions = [
  'نمای خارجی', 'نمای داخلی', 'نمای رومی', 'کف داخلی', 'کف لابی', 'کف واحد', 'کف فروشگاه', 'کف مرکز تجاری',
  'کف فضای پرتردد', 'کف پارکینگ', 'کف محوطه', 'پیاده‌رو', 'پله', 'زیرپله', 'پاگرد', 'دیوار داخلی',
  'دیوار راه‌پله', 'دیوار پارکینگ', 'سرویس بهداشتی', 'حمام', 'آشپزخانه', 'کانتر', 'جزیره آشپزخانه',
  'آسانسور', 'لابی', 'قرنیز', 'جدول', 'محوطه‌سازی', 'فضای باز', 'فضای مرطوب', 'فضای سردسیر',
  'فضای یخبندان', 'مناطق گرم', 'مناطق دارای آلودگی',
] as const;

const stoneKnowledgeGuidance = {
  version: '1.0',
  packVersion: '2.1.0-source-redacted',
  sourceSha256: '51A20E4B61D03A23BF9577681E4C6672690099236AFC604A893BB0AADF750B38',
  scope: 'decision_support_not_engineering_approval',
  disclaimerFa: 'این راهنما برای تکمیل استعلام و شروع بررسی است؛ تأیید نهایی باید براساس مشخصات پروژه، نمونه و آزمون همان پارت انجام شود.',
  profiles: {
    exteriorFacade: {
      requiredChecks: ['هویت و یکسانی پارت', 'سلامت و نبود ترک مؤثر', 'ابعاد و ضخامت واقعی', 'روش و ظرفیت مهار'],
      comparisonCriteria: ['مقاومت خمشی', 'جذب آب', 'پایداری فضای باز', 'رفتار حرارتی', 'هماهنگی رنگ و طرح', 'تأمین بار هم‌سورت', 'هزینه کل تهیه و اجرا'],
      suggestedFamilies: ['تراورتن', 'گرانیت', 'چینی / کریستال'],
    },
    romanFacade: {
      requiredChecks: ['هویت و یکسانی پارت', 'سلامت و نبود ترک مؤثر', 'ابعاد و ضخامت واقعی', 'روش و ظرفیت مهار'],
      comparisonCriteria: ['مقاومت خمشی', 'جذب آب', 'پایداری فضای باز', 'رفتار حرارتی', 'هماهنگی رنگ و طرح', 'تأمین بار هم‌سورت', 'هزینه کل تهیه و اجرا'],
      suggestedFamilies: ['تراورتن'],
    },
    wall: {
      requiredChecks: ['هویت و یکسانی پارت', 'سلامت و نبود ترک مؤثر', 'ابعاد و ضخامت واقعی'],
      comparisonCriteria: ['ظرفیت و سازگاری مهار', 'هماهنگی رنگ و طرح', 'لکه‌پذیری و نظافت', 'تأمین بار هم‌سورت', 'هزینه کل تهیه و اجرا'],
      suggestedFamilies: ['تراورتن', 'مرمریت', 'گرانیت', 'چینی / کریستال', 'مرمر / اونیکس', 'لایم‌استون', 'ماسه‌سنگ'],
    },
    floor: {
      requiredChecks: ['هویت و یکسانی پارت', 'سلامت و نبود ترک مؤثر', 'ابعاد و ضخامت واقعی', 'لغزش در شرایط مصرف', 'بستر و باربری سازه'],
      comparisonCriteria: ['مقاومت سایشی', 'مقاومت لغزشی', 'مقاومت خمشی و فشاری', 'جذب آب', 'قابلیت ترمیم', 'تأمین بار هم‌سورت', 'هزینه کل تهیه و اجرا'],
      suggestedFamilies: ['گرانیت', 'چینی / کریستال', 'مرمریت'],
    },
    outdoorFloor: {
      requiredChecks: ['هویت و یکسانی پارت', 'سلامت و نبود ترک مؤثر', 'ابعاد و ضخامت واقعی', 'لغزش در شرایط خیس', 'بستر و باربری سازه'],
      comparisonCriteria: ['دوام یخ‌زدگی و ذوب', 'زهکشی و آب‌بندی', 'پایداری فضای باز', 'مقاومت سایشی', 'مقاومت خمشی و فشاری', 'جذب آب', 'هزینه کل تهیه و اجرا'],
      suggestedFamilies: ['گرانیت', 'چینی / کریستال', 'مرمریت'],
    },
    wetWall: {
      requiredChecks: ['هویت و یکسانی پارت', 'سلامت و نبود ترک مؤثر', 'ابعاد و ضخامت واقعی', 'زهکشی و آب‌بندی'],
      comparisonCriteria: ['جذب آب', 'لغزش در صورت مصرف کف', 'تماس با شوینده و مواد اسیدی', 'لکه‌پذیری و نظافت', 'هماهنگی رنگ و طرح', 'هزینه کل تهیه و اجرا'],
      suggestedFamilies: ['تراورتن', 'مرمریت', 'گرانیت', 'چینی / کریستال', 'مرمر / اونیکس', 'لایم‌استون', 'ماسه‌سنگ'],
    },
    wetFloor: {
      requiredChecks: ['هویت و یکسانی پارت', 'سلامت و نبود ترک مؤثر', 'ابعاد و ضخامت واقعی', 'لغزش در شرایط خیس', 'بستر و باربری سازه', 'زهکشی و آب‌بندی'],
      comparisonCriteria: ['جذب آب', 'تماس با شوینده و مواد اسیدی', 'مقاومت سایشی', 'مقاومت خمشی و فشاری', 'قابلیت ترمیم', 'هزینه کل تهیه و اجرا'],
      suggestedFamilies: ['گرانیت', 'چینی / کریستال', 'مرمریت'],
    },
    worktop: {
      requiredChecks: ['هویت و یکسانی پارت', 'سلامت و نبود ترک مؤثر', 'ابعاد و ضخامت واقعی', 'تماس با مواد اسیدی', 'لکه‌پذیری و نظافت'],
      comparisonCriteria: ['رفتار حرارتی', 'مقاومت خمشی', 'قابلیت ترمیم', 'هزینه کل تهیه و اجرا'],
      suggestedFamilies: ['گرانیت', 'سایر گزینه‌های دارای آزمون و تأیید پروژه'],
    },
    elevator: {
      requiredChecks: ['هویت و یکسانی پارت', 'سلامت و نبود ترک مؤثر', 'ابعاد و ضخامت واقعی', 'وزن و طراحی تکیه‌گاه'],
      comparisonCriteria: ['مقاومت خمشی', 'ظرفیت و سازگاری مهار', 'مقاومت سایشی', 'مقاومت لغزشی', 'هزینه کل تهیه و اجرا'],
      suggestedFamilies: ['تراورتن', 'مرمریت', 'گرانیت', 'چینی / کریستال', 'مرمر / اونیکس', 'لایم‌استون', 'ماسه‌سنگ'],
    },
    outdoorGeneral: {
      requiredChecks: ['هویت و یکسانی پارت', 'سلامت و نبود ترک مؤثر', 'ابعاد و ضخامت واقعی'],
      comparisonCriteria: ['دوام یخ‌زدگی و ذوب', 'زهکشی و آب‌بندی', 'پایداری فضای باز', 'مقاومت لغزشی', 'هماهنگی رنگ و طرح', 'تأمین بار هم‌سورت', 'هزینه کل تهیه و اجرا'],
      suggestedFamilies: ['تراورتن', 'مرمریت', 'گرانیت', 'چینی / کریستال', 'مرمر / اونیکس', 'لایم‌استون', 'ماسه‌سنگ'],
    },
    coldClimate: {
      requiredChecks: ['هویت و یکسانی پارت', 'سلامت و نبود ترک مؤثر', 'ابعاد و ضخامت واقعی', 'آزمون یخ‌زدگی و ذوب همان پارت'],
      comparisonCriteria: ['جذب آب', 'مقاومت خمشی', 'ظرفیت و سازگاری مهار', 'زهکشی و آب‌بندی', 'هزینه کل تهیه و اجرا'],
      suggestedFamilies: ['گرانیت', 'تراورتن', 'چینی / کریستال', 'ماسه‌سنگ'],
    },
    hotClimate: {
      requiredChecks: ['هویت و یکسانی پارت', 'سلامت و نبود ترک مؤثر', 'ابعاد و ضخامت واقعی', 'رفتار حرارتی در شرایط پروژه'],
      comparisonCriteria: ['پایداری فضای باز', 'ظرفیت و سازگاری مهار', 'هماهنگی رنگ و طرح', 'هزینه کل تهیه و اجرا'],
      suggestedFamilies: ['تراورتن', 'مرمریت', 'گرانیت', 'چینی / کریستال', 'مرمر / اونیکس', 'لایم‌استون', 'ماسه‌سنگ'],
    },
    pollutedClimate: {
      requiredChecks: ['هویت و یکسانی پارت', 'سلامت و نبود ترک مؤثر', 'ابعاد و ضخامت واقعی'],
      comparisonCriteria: ['تماس با مواد اسیدی و شوینده', 'پایداری فضای باز', 'لکه‌پذیری و نظافت', 'قابلیت ترمیم', 'ظرفیت و سازگاری مهار', 'هزینه کل تهیه و اجرا'],
      suggestedFamilies: ['تراورتن', 'مرمریت', 'گرانیت', 'چینی / کریستال', 'مرمر / اونیکس', 'لایم‌استون', 'ماسه‌سنگ'],
    },
  },
  applications: [
    ['exterior_facade', 'نمای خارجی', 'exteriorFacade', true], ['interior_facade', 'نمای داخلی', 'wall', false], ['roman_facade', 'نمای رومی', 'romanFacade', true],
    ['interior_floor', 'کف داخلی', 'floor', false], ['lobby_floor', 'کف لابی', 'floor', false], ['unit_floor', 'کف واحد', 'floor', false],
    ['shop_floor', 'کف فروشگاه', 'floor', false], ['mall_floor', 'کف مرکز تجاری', 'floor', false], ['high_traffic_floor', 'کف فضای پرتردد', 'floor', true],
    ['parking_floor', 'کف پارکینگ', 'floor', true], ['yard_floor', 'کف محوطه', 'outdoorFloor', false], ['sidewalk', 'پیاده‌رو', 'outdoorFloor', false],
    ['stair_tread', 'پله', 'floor', true], ['stair_riser', 'زیرپله', 'wall', false], ['landing', 'پاگرد', 'floor', false],
    ['interior_wall', 'دیوار داخلی', 'wall', false], ['stair_wall', 'دیوار راه‌پله', 'wall', false], ['parking_wall', 'دیوار پارکینگ', 'wall', false],
    ['toilet', 'سرویس بهداشتی', 'wetWall', false], ['bathroom', 'حمام', 'wetFloor', false], ['kitchen', 'آشپزخانه', 'worktop', false],
    ['countertop', 'کانتر', 'worktop', false], ['kitchen_island', 'جزیره آشپزخانه', 'worktop', false], ['elevator', 'آسانسور', 'elevator', true],
    ['lobby', 'لابی', 'wall', false], ['skirting', 'قرنیز', 'wall', false], ['kerb', 'جدول', 'outdoorGeneral', false],
    ['landscaping', 'محوطه‌سازی', 'outdoorGeneral', false], ['outdoors', 'فضای باز', 'outdoorGeneral', false], ['wet_area', 'فضای مرطوب', 'wetFloor', false],
    ['cold_climate', 'فضای سردسیر', 'coldClimate', true], ['freeze_thaw', 'فضای یخبندان', 'coldClimate', true],
    ['hot_climate', 'مناطق گرم', 'hotClimate', false], ['polluted_climate', 'مناطق دارای آلودگی', 'pollutedClimate', false],
  ],
} as const;

const naturalStoneAttributes = [
  { code: 'stone-color', nameFa: 'رنگ غالب', nameEn: 'Primary color', dataType: 'TEXT' as const, unitLabelFa: null, options: [], validation: { maxLength: 80 }, isRequired: false },
  { code: 'quarry-name', nameFa: 'معدن یا خاستگاه', nameEn: 'Quarry / origin', dataType: 'TEXT' as const, unitLabelFa: null, options: [], validation: { maxLength: 120 }, isRequired: false },
  { code: 'finish', nameFa: 'نوع فرآوری', nameEn: 'Finish', dataType: 'SINGLE_SELECT' as const, unitLabelFa: null, options: ['سابیده', 'هوند', 'چرمی', 'بوش‌همر', 'تیشه‌ای', 'خام'], validation: {}, isRequired: true },
  { code: 'thickness-mm', nameFa: 'ضخامت', nameEn: 'Thickness', dataType: 'NUMBER' as const, unitLabelFa: 'میلی‌متر', options: [], validation: { min: 5, max: 200 }, isRequired: true },
  { code: 'dimensions', nameFa: 'ابعاد یا نوع برش', nameEn: 'Dimensions / cut', dataType: 'TEXT' as const, unitLabelFa: null, options: [], validation: { maxLength: 120 }, isRequired: false },
  { code: 'grade', nameFa: 'درجه یا سورت', nameEn: 'Grade / sort', dataType: 'SINGLE_SELECT' as const, unitLabelFa: null, options: ['سوپر', 'ممتاز', 'درجه یک', 'درجه دو'], validation: {}, isRequired: false },
  { code: 'application', nameFa: 'محل مصرف', nameEn: 'Application', dataType: 'MULTI_SELECT' as const, unitLabelFa: null, options: stoneApplicationOptions, validation: {}, isRequired: true },
] as const;

const systemSettings = [
  ['market.coverage.country', 'IR', 'کشور بازار اولیه وازانو'],
  ['market.coverage.mode', 'NATIONWIDE', 'پوشش جغرافیایی بازار'],
  ['market.coverage.province_codes', [], 'استان‌های مجاز در حالت پوشش منتخب'],
  ['pricing.display_tax_inclusive', false, 'نمایش قیمت‌ها بدون مالیات'],
  ['platform.legal_role', 'INFORMATION_INTERMEDIARY', 'نقش حقوقی پایه پلتفرم'],
  ['quality_control.enabled', true, 'فعال بودن خدمت اختیاری کنترل کیفیت'],
  ['quality_control.fee_bps', 300, 'کارمزد کنترل کیفیت بر حسب صدم درصد'],
  ['rfq.operator_entry_enabled', true, 'ثبت استعلام به نمایندگی از خریدار توسط اپراتور'],
  ['rfq.pilot_manual_review', true, 'بازبینی دستی همه استعلام‌های پایلوت'],
  ['rfq.buyer_commitment_amount_rial', 2_500_000, 'سپرده تعهد خریدار جدید در پایلوت'],
  ['rfq.buyer_commitment_policy_version', 'BUYER_PRICE_V1_0', 'نسخه سیاست سپرده تعهد خریدار'],
  ['subscription.grace_period_days', 7, 'مهلت تنفس پس از پایان اشتراک'],
  ['subscription.renewal_warning_offsets_days', [-14, -7, -3, 0, 7], 'روزهای ارسال اخطار تمدید نسبت به انقضا'],
  ['subscription.trial_warning_offsets_days', [-7, -3, -1, 0], 'روزهای ارسال اخطار پایان دوره آزمایشی'],
  ['subscription.founding_program', { enabled: true, planCode: 'SELLER_FOUNDING_P6M_V1', capacity: 20, renewalDiscountBps: 2000, minimumValidLeads: 10, guaranteeExtensionDays: 90, managedSalesOnly: true }, 'قواعد برنامه غیرعمومی کارخانه‌های مؤسس؛ قیمت و مدت از بخش پلن‌های اشتراک مدیریت می‌شود'],
  ['notification.sms.send_window_local', { startHour: 9, endHour: 20, timezone: 'Asia/Tehran' }, 'بازه مجاز ارسال پیامک'],
  ['notification.sms.renewal_max_per_24h', 1, 'حداکثر پیامک تمدید در ۲۴ ساعت'],
  ['seller.proposal_fee_policy', { version: '1.2', rate: '0.001', minToman: 100_000, maxToman: 5_000_000, refundFractionIfEligible: '2/3' }, 'سیاست هزینه ارسال پیشنهاد فروشنده'],
  ['seller.daily_proposal_limit', { base: 2, shortageOverrideMax: 6 }, 'مرجع قدیمی؛ سقف‌های فعال از بخش پلن‌های اشتراک مدیریت می‌شوند'],
  ['seller.shortage_override', { enabled: false, expiresAt: null, reason: '' }, 'افزایش موقت سقف روزانه پیشنهاد در کمبود عرضه'],
  ['knowledge.application_guidance.natural-stone.v1', stoneKnowledgeGuidance, 'راهنمای تخصصی تکمیل استعلام سنگ طبیعی؛ قابل ویرایش پس از بازبینی کارشناس'],
] as const;

const inAppNotificationTemplates = [
  {
    code: 'IN_APP_SUPPLIER_PROFILE_SUBMITTED_FA_V1',
    eventType: 'ir.vazano.supplier.profile.submitted.v1',
    titleTemplate: 'فروشنده جدید آماده بررسی است',
    bodyTemplate: 'پروفایل «{{supplierName}}» برای احراز و بررسی مدارک ارسال شد.',
    actionPathTemplate: '/admin/suppliers',
  },
  {
    code: 'IN_APP_SUPPLIER_VERIFICATION_CHANGED_FA_V1',
    eventType: 'ir.vazano.supplier.verification.changed.v1',
    titleTemplate: 'نتیجه بررسی پروفایل فروشنده',
    bodyTemplate: 'پروفایل «{{supplierName}}» {{verificationStatus}}. توضیح: {{verificationReason}}',
    actionPathTemplate: '/supplier/profile/{{organizationId}}',
  },
  {
    code: 'IN_APP_QUALITY_CONTROL_QUOTED_FA_V1',
    eventType: 'ir.vazano.quality_control.quoted.v1',
    titleTemplate: 'هزینه کنترل کیفیت آماده پرداخت است',
    bodyTemplate: 'هزینه کنترل کیفیت استعلام {{rfqCode}} برابر {{feeAmountToman}} تومان محاسبه شد.',
    actionPathTemplate: '/dashboard/rfqs/{{rfqId}}',
  },
  {
    code: 'IN_APP_QUALITY_CONTROL_ACCEPTED_FA_V1',
    eventType: 'ir.vazano.quality_control.accepted.v1',
    titleTemplate: 'درخواست کنترل کیفیت فعال شد',
    bodyTemplate: 'درخواست استعلام {{rfqCode}} پرداخت شد و در صف عملیات قرار گرفت.',
    actionPathTemplate: '/admin/quality-control',
  },
  {
    code: 'IN_APP_QUALITY_CONTROL_IN_PROGRESS_FA_V1',
    eventType: 'ir.vazano.quality_control.in_progress.v1',
    titleTemplate: 'کنترل کیفیت آغاز شد',
    bodyTemplate: 'خدمت کنترل کیفیت استعلام {{rfqCode}} اکنون در حال انجام است.',
    actionPathTemplate: '/dashboard/rfqs/{{rfqId}}',
  },
  {
    code: 'IN_APP_QUALITY_CONTROL_COMPLETED_FA_V1',
    eventType: 'ir.vazano.quality_control.completed.v1',
    titleTemplate: 'کنترل کیفیت تکمیل شد',
    bodyTemplate: 'خدمت کنترل کیفیت استعلام {{rfqCode}} تکمیل شد.',
    actionPathTemplate: '/dashboard/rfqs/{{rfqId}}',
  },
  {
    code: 'IN_APP_QUALITY_CONTROL_CANCELLED_FA_V1',
    eventType: 'ir.vazano.quality_control.cancelled.v1',
    titleTemplate: 'درخواست کنترل کیفیت لغو شد',
    bodyTemplate: 'خدمت کنترل کیفیت استعلام {{rfqCode}} لغو شد. توضیح: {{note}}',
    actionPathTemplate: '/dashboard/rfqs/{{rfqId}}',
  },
  {
    code: 'IN_APP_SUPPLIER_REVIEW_PUBLISHED_FA_V1',
    eventType: 'ir.vazano.supplier.review_published.v1',
    titleTemplate: 'امتیاز جدید برای فروشنده',
    bodyTemplate: 'خریدار استعلام {{rfqCode}} امتیاز {{rating}} از ۵ را ثبت کرد.',
    actionPathTemplate: '/supplier',
  },
  {
    code: 'IN_APP_BUYER_COMMITMENT_HELD_FA_V1',
    eventType: 'ir.vazano.buyer.commitment.held.v1',
    titleTemplate: 'سپرده تعهد خریدار ثبت شد',
    bodyTemplate: 'پرداخت سپرده استعلام {{rfqCode}} قطعی شد. شماره رسید: {{receiptNumber}}',
    actionPathTemplate: '/dashboard/rfqs/{{rfqId}}',
  },
  {
    code: 'IN_APP_ORGANIZATION_MEMBER_INVITED_FA_V1',
    eventType: 'ir.vazano.organization.member_invited.v1',
    titleTemplate: 'دعوت به سازمان {{organizationName}}',
    bodyTemplate: 'برای عضویت با نقش «{{memberRole}}» دعوت شده‌اید. دعوت‌نامه را بررسی کنید.',
    actionPathTemplate: '/dashboard/organization',
  },
  {
    code: 'IN_APP_RFQ_SUBMITTED_FA_V1',
    eventType: 'ir.vazano.rfq.submitted.v1',
    titleTemplate: 'استعلام آماده بررسی است',
    bodyTemplate: 'استعلام {{rfqCode}} با عنوان «{{rfqTitle}}» برای بررسی ارسال شد.',
    actionPathTemplate: '/admin/rfqs',
  },
  {
    code: 'IN_APP_RFQ_REVIEWED_FA_V1',
    eventType: 'ir.vazano.rfq.reviewed.v1',
    titleTemplate: 'نتیجه بررسی استعلام',
    bodyTemplate: 'استعلام {{rfqCode}} {{approvalStatus}}.',
    actionPathTemplate: '/dashboard/rfqs/{{rfqId}}',
  },
  {
    code: 'IN_APP_RFQ_DISTRIBUTED_FA_V1',
    eventType: 'ir.vazano.rfq.distributed.v1',
    titleTemplate: 'استعلام جدید برای فروشنده',
    bodyTemplate: 'استعلام {{rfqCode}} با عنوان «{{rfqTitle}}» با توانمندی‌های شما تطبیق دارد.',
    actionPathTemplate: '/supplier',
  },
  {
    code: 'IN_APP_RFQ_INVITATION_DECLINED_FA_V1',
    eventType: 'ir.vazano.rfq.invitation.declined.v1',
    titleTemplate: 'یک فروشنده فرصت استعلام را رد کرد',
    bodyTemplate: 'فروشنده «{{supplierName}}» امکان پاسخ‌گویی به استعلام {{rfqCode}} را ندارد.',
    actionPathTemplate: '/dashboard/rfqs/{{rfqId}}',
  },
  {
    code: 'IN_APP_RFQ_CANCELLED_FA_V1',
    eventType: 'ir.vazano.rfq.cancelled.v1',
    titleTemplate: 'استعلام توسط خریدار لغو شد',
    bodyTemplate: 'استعلام {{rfqCode}} با عنوان «{{rfqTitle}}» لغو شد. اعتبار مصرف‌شده برای پیشنهاد ثبت‌شده به‌طور کامل بازگردانده می‌شود.',
    actionPathTemplate: '/supplier',
  },
  {
    code: 'IN_APP_RFQ_QUOTE_WINDOW_CLOSED_FA_V1',
    eventType: 'ir.vazano.rfq.quote_window_closed.v1',
    titleTemplate: 'مهلت دریافت پیشنهاد پایان یافت',
    bodyTemplate: 'مهلت دریافت پیشنهاد برای استعلام {{rfqCode}} پایان یافت؛ وضعیت: {{statusLabel}}.',
    actionPathTemplate: '/supplier',
  },
  {
    code: 'IN_APP_QUOTATION_SUBMITTED_FA_V1',
    eventType: 'ir.vazano.quotation.submitted.v1',
    titleTemplate: 'پیشنهاد قیمت جدید دریافت شد',
    bodyTemplate: '{{supplierName}} پیشنهاد {{quotationCode}} را برای استعلام {{rfqCode}} ارسال کرد.',
    actionPathTemplate: '/dashboard/rfqs/{{rfqId}}',
  },
  {
    code: 'IN_APP_QUOTATION_ACCEPTED_FA_V1',
    eventType: 'ir.vazano.quotation.accepted.v1',
    titleTemplate: 'پیشنهاد قیمت انتخاب شد',
    bodyTemplate: 'پیشنهاد {{quotationCode}} از {{supplierName}} برای استعلام {{rfqCode}} انتخاب شد.',
    actionPathTemplate: '/supplier',
  },
  {
    code: 'IN_APP_QUOTATION_REJECTED_FA_V1',
    eventType: 'ir.vazano.quotation.rejected.v1',
    titleTemplate: 'نتیجه انتخاب پیشنهاد قیمت',
    bodyTemplate: 'پیشنهاد {{quotationCode}} برای استعلام {{rfqCode}} انتخاب نشد و {{refundCredits}} اعتبار به کیف شما بازگشت.',
    actionPathTemplate: '/supplier',
  },
  {
    code: 'IN_APP_QUOTATION_WITHDRAWN_FA_V1',
    eventType: 'ir.vazano.quotation.withdrawn.v1',
    titleTemplate: 'پیشنهاد قیمت پس گرفته شد',
    bodyTemplate: '{{supplierName}} پیشنهاد {{quotationCode}} را برای استعلام {{rfqCode}} پس گرفت.',
    actionPathTemplate: '/dashboard/rfqs/{{rfqId}}',
  },
  {
    code: 'IN_APP_CONTRACT_REQUESTED_FA_V1',
    eventType: 'ir.vazano.contract.requested.v1',
    titleTemplate: 'درخواست قرارداد جدید {{contractCode}}',
    bodyTemplate: '{{buyerName}} برای استعلام {{rfqCode}} درخواست هماهنگی قرارداد ثبت کرد.',
    actionPathTemplate: '/admin/contracts',
  },
  {
    code: 'IN_APP_CONTRACT_UNDER_REVIEW_FA_V1',
    eventType: 'ir.vazano.contract.under_review.v1',
    titleTemplate: 'بررسی درخواست قرارداد آغاز شد',
    bodyTemplate: 'درخواست {{contractCode}} برای استعلام {{rfqCode}} در حال بررسی است.',
    actionPathTemplate: '/dashboard/rfqs/{{rfqId}}',
  },
  {
    code: 'IN_APP_CONTRACT_TERMS_PREPARED_FA_V1',
    eventType: 'ir.vazano.contract.terms_prepared.v1',
    titleTemplate: 'شرایط قرارداد آماده بررسی است',
    bodyTemplate: 'خلاصه شرایط درخواست {{contractCode}} برای استعلام {{rfqCode}} آماده تأیید شما است.',
    actionPathTemplate: '/dashboard/rfqs/{{rfqId}}',
  },
  {
    code: 'IN_APP_CONTRACT_ACCEPTED_FA_V1',
    eventType: 'ir.vazano.contract.accepted.v1',
    titleTemplate: 'شرایط قرارداد تأیید شد',
    bodyTemplate: 'خریدار شرایط درخواست {{contractCode}} برای استعلام {{rfqCode}} را تأیید کرد.',
    actionPathTemplate: '/admin/contracts',
  },
  {
    code: 'IN_APP_CONTRACT_COMPLETED_FA_V1',
    eventType: 'ir.vazano.contract.completed.v1',
    titleTemplate: 'هماهنگی قرارداد تکمیل شد',
    bodyTemplate: 'درخواست {{contractCode}} برای استعلام {{rfqCode}} تکمیل شد.',
    actionPathTemplate: '/dashboard/rfqs/{{rfqId}}',
  },
  {
    code: 'IN_APP_CONTRACT_CANCELLED_FA_V1',
    eventType: 'ir.vazano.contract.cancelled.v1',
    titleTemplate: 'درخواست قرارداد لغو شد',
    bodyTemplate: 'درخواست {{contractCode}} برای استعلام {{rfqCode}} لغو شد. توضیح: {{note}}',
    actionPathTemplate: '/dashboard/rfqs/{{rfqId}}',
  },
  {
    code: 'IN_APP_MESSAGE_SENT_FA_V1',
    eventType: 'ir.vazano.message.sent.v1',
    titleTemplate: 'پیام جدید درباره استعلام {{rfqCode}}',
    bodyTemplate: '{{senderName}} پیام جدیدی برای این استعلام ارسال کرد.',
    actionPathTemplate: '/messages?thread={{threadId}}',
  },
  {
    code: 'IN_APP_SUPPORT_TICKET_CREATED_FA_V1',
    eventType: 'ir.vazano.support.ticket.created.v1',
    titleTemplate: 'تیکت {{ticketPriority}} جدید: {{ticketCode}}',
    bodyTemplate: '{{ticketType}} با موضوع «{{ticketSubject}}» برای رسیدگی ثبت شد.',
    actionPathTemplate: '/admin/support',
  },
  {
    code: 'IN_APP_SUPPORT_TICKET_STATUS_CHANGED_FA_V1',
    eventType: 'ir.vazano.support.ticket.status_changed.v1',
    titleTemplate: 'وضعیت تیکت {{ticketCode}} تغییر کرد',
    bodyTemplate: 'وضعیت جدید تیکت شما: {{ticketStatus}}.',
    actionPathTemplate: '/support/{{ticketId}}',
  },
  {
    code: 'IN_APP_SUPPORT_TICKET_REPLIED_FA_V1',
    eventType: 'ir.vazano.support.ticket.replied.v1',
    titleTemplate: 'پاسخ جدید برای تیکت {{ticketCode}}',
    bodyTemplate: 'تیم پشتیبانی وازانو پاسخ جدیدی برای درخواست شما ثبت کرد.',
    actionPathTemplate: '/support/{{ticketId}}',
  },
  {
    code: 'IN_APP_SUBSCRIPTION_ACTIVATED_FA_V1',
    eventType: 'ir.vazano.subscription.activated.v1',
    titleTemplate: 'اشتراک فروشنده فعال شد',
    bodyTemplate: 'پلن «{{planName}}» فعال شد و تا {{expiresAt}} اعتبار دارد.',
    actionPathTemplate: '/supplier',
  },
  {
    code: 'IN_APP_SUBSCRIPTION_RENEWAL_14_DAYS_FA_V1',
    eventType: 'ir.vazano.subscription.renewal.14_days_before.v1',
    titleTemplate: '۱۴ روز تا پایان اشتراک',
    bodyTemplate: 'اشتراک «{{planName}}» در {{expiresAt}} پایان می‌یابد. مبلغ تمدید {{renewalAmountToman}} تومان است.',
    actionPathTemplate: '/plans',
  },
  {
    code: 'IN_APP_SUBSCRIPTION_RENEWAL_7_DAYS_FA_V1',
    eventType: 'ir.vazano.subscription.renewal.7_days_before.v1',
    titleTemplate: '۷ روز تا پایان اشتراک',
    bodyTemplate: 'برای جلوگیری از توقف دریافت استعلام جدید، اشتراک «{{planName}}» را پیش از {{expiresAt}} تمدید کنید.',
    actionPathTemplate: '/plans',
  },
  {
    code: 'IN_APP_SUBSCRIPTION_RENEWAL_3_DAYS_FA_V1',
    eventType: 'ir.vazano.subscription.renewal.3_days_before.v1',
    titleTemplate: 'هشدار نهایی تمدید اشتراک',
    bodyTemplate: 'تنها ۳ روز تا پایان اشتراک «{{planName}}» باقی مانده است.',
    actionPathTemplate: '/plans',
  },
  {
    code: 'IN_APP_SUBSCRIPTION_EXPIRED_FA_V1',
    eventType: 'ir.vazano.subscription.renewal.expired.v1',
    titleTemplate: 'اشتراک شما پایان یافت',
    bodyTemplate: 'دریافت استعلام جدید متوقف شد؛ سوابق حساب محفوظ است و تا {{graceEndsAt}} مهلت تمدید دارید.',
    actionPathTemplate: '/plans',
  },
  {
    code: 'IN_APP_SUBSCRIPTION_GRACE_ENDED_FA_V1',
    eventType: 'ir.vazano.subscription.renewal.grace_ended.v1',
    titleTemplate: 'مهلت تمدید پایان یافت',
    bodyTemplate: 'مهلت ۷روزه تمدید اشتراک «{{planName}}» پایان یافت و خدمات حرفه‌ای حساب محدود شد.',
    actionPathTemplate: '/plans',
  },
  {
    code: 'IN_APP_SUBSCRIPTION_TRIAL_7_DAYS_FA_V1',
    eventType: 'ir.vazano.subscription.trial.7_days_before.v1',
    titleTemplate: '۷ روز تا پایان دوره آزمایشی',
    bodyTemplate: 'دوره آزمایشی «{{planName}}» در {{expiresAt}} پایان می‌یابد. برای ادامه دریافت استعلام، پلن مناسب را انتخاب کنید.',
    actionPathTemplate: '/supplier/subscription',
  },
  {
    code: 'IN_APP_SUBSCRIPTION_TRIAL_3_DAYS_FA_V1',
    eventType: 'ir.vazano.subscription.trial.3_days_before.v1',
    titleTemplate: '۳ روز تا پایان دوره آزمایشی',
    bodyTemplate: 'برای جلوگیری از توقف امکانات فروشنده، پیش از {{expiresAt}} اشتراک خود را فعال کنید.',
    actionPathTemplate: '/supplier/subscription',
  },
  {
    code: 'IN_APP_SUBSCRIPTION_TRIAL_1_DAY_FA_V1',
    eventType: 'ir.vazano.subscription.trial.1_day_before.v1',
    titleTemplate: 'فردا دوره آزمایشی پایان می‌یابد',
    bodyTemplate: 'تنها یک روز از دوره آزمایشی «{{planName}}» باقی مانده است.',
    actionPathTemplate: '/supplier/subscription',
  },
  {
    code: 'IN_APP_SUBSCRIPTION_TRIAL_EXPIRED_FA_V1',
    eventType: 'ir.vazano.subscription.trial.expired.v1',
    titleTemplate: 'دوره آزمایشی پایان یافت',
    bodyTemplate: 'دوره آزمایشی «{{planName}}» پایان یافت. اطلاعات و سوابق حساب محفوظ است.',
    actionPathTemplate: '/supplier/subscription',
  },
  {
    code: 'IN_APP_PAYMENT_RETRY_REQUESTED_FA_V1',
    eventType: 'ir.vazano.payment.retry_requested.v1',
    titleTemplate: 'پرداخت نیازمند اقدام شما است',
    bodyTemplate: 'پرداخت {{paymentPurpose}} به مبلغ {{amountToman}} تومان قطعی نشده است. برای پرداخت مجدد وارد صفحه مربوط شوید.',
    actionPathTemplate: '/supplier/subscription',
  },
] as const;

async function main(): Promise<void> {
  for (const key of permissions) {
    await prisma.permission.upsert({ where: { key }, create: { key, description: key }, update: {} });
  }
  for (const [key, rolePermissions] of Object.entries(roles)) {
    const role = await prisma.role.upsert({ where: { key }, create: { key, nameFa: roleNamesFa[key] ?? key }, update: { nameFa: roleNamesFa[key] ?? key } });
    const records = await prisma.permission.findMany({ where: { key: { in: rolePermissions } }, select: { id: true } });
    await prisma.rolePermission.createMany({ data: records.map(({ id }) => ({ roleId: role.id, permissionId: id })), skipDuplicates: true });
  }

  for (const [sortOrder, [code, nameFa, nameEn, capitalCode, capitalNameFa, capitalNameEn]] of iranProvinces.entries()) {
    const province = await prisma.province.upsert({
      where: { code },
      create: { code, nameFa, nameEn, sortOrder: sortOrder + 1 },
      update: isProduction ? {} : { nameFa, nameEn, sortOrder: sortOrder + 1, isActive: true },
    });
    await prisma.city.upsert({
      where: { provinceId_code: { provinceId: province.id, code: capitalCode } },
      create: { provinceId: province.id, code: capitalCode, nameFa: capitalNameFa, nameEn: capitalNameEn, isProvinceCapital: true, sortOrder: 1 },
      update: isProduction ? {} : { nameFa: capitalNameFa, nameEn: capitalNameEn, isProvinceCapital: true, sortOrder: 1, isActive: true },
    });
    await prisma.rfq.updateMany({
      where: { deliveryProvince: nameFa, deliveryProvinceId: null },
      data: { deliveryProvinceId: province.id },
    });
    const capital = await prisma.city.findUniqueOrThrow({ where: { provinceId_code: { provinceId: province.id, code: capitalCode } } });
    await prisma.rfq.updateMany({
      where: { deliveryProvince: nameFa, deliveryCity: capitalNameFa, deliveryCityId: null },
      data: { deliveryProvinceId: province.id, deliveryCityId: capital.id },
    });
  }
  const legacySupplierProfiles = await prisma.supplierProfile.findMany({
    where: { nationwideCoverage: false },
    select: { id: true, serviceProvinces: true },
  });
  const provinceReferences = await prisma.province.findMany({ select: { id: true, nameFa: true } });
  const provinceIdByName = new Map(provinceReferences.map((province) => [province.nameFa, province.id]));
  for (const profile of legacySupplierProfiles) {
    const provinceIds = profile.serviceProvinces.map((name) => provinceIdByName.get(name)).filter((id): id is string => Boolean(id));
    await prisma.supplierServiceProvince.createMany({ data: provinceIds.map((provinceId) => ({ supplierProfileId: profile.id, provinceId })), skipDuplicates: true });
  }

  const industry = await prisma.industry.upsert({
    where: { code: 'building-materials' },
    create: { code: 'building-materials', nameFa: 'مصالح ساختمانی', nameEn: 'Building Materials', sortOrder: 10 },
    update: isProduction ? {} : { nameFa: 'مصالح ساختمانی', isActive: true },
  });
  const naturalStone = await prisma.category.upsert({
    where: { code: 'natural-stone' },
    create: { industryId: industry.id, code: 'natural-stone', slug: 'natural-stone', nameFa: 'سنگ طبیعی', nameEn: 'Natural Stone', metadata: { knowledgeProfile: 'natural-stone' }, sortOrder: 10 },
    update: isProduction ? {} : { industryId: industry.id, nameFa: 'سنگ طبیعی', metadata: { knowledgeProfile: 'natural-stone' }, isActive: true },
  });
  for (const [code, slug, nameFa, nameEn] of naturalStoneCategories) {
    await prisma.category.upsert({
      where: { code },
      create: { industryId: industry.id, parentId: naturalStone.id, code, slug, nameFa, nameEn, sortOrder: naturalStoneCategories.findIndex((item) => item[0] === code) + 1 },
      update: isProduction ? {} : { industryId: industry.id, parentId: naturalStone.id, nameFa, nameEn, isActive: true },
    });
  }

  const units = [
    ['square-meter', 'متر مربع', 'م²', 3],
    ['linear-meter', 'متر طول', 'متر', 3],
    ['piece', 'عدد', 'عدد', 0],
    ['tonne', 'تن', 'تن', 3],
    ['kilogram', 'کیلوگرم', 'کیلوگرم', 3],
    ['slab', 'اسلب', 'اسلب', 0],
  ] as const;
  for (const [code, nameFa, symbolFa, decimalScale] of units) {
    await prisma.unitOfMeasure.upsert({
      where: { code },
      create: { code, nameFa, symbolFa, decimalScale },
      update: isProduction ? {} : { nameFa, symbolFa, decimalScale, isActive: true },
    });
  }

  const stoneCategories = await prisma.category.findMany({
    where: { parentId: naturalStone.id, isActive: true },
    select: { id: true },
  });
  for (const [sortOrder, definition] of naturalStoneAttributes.entries()) {
    const attribute = await prisma.productAttributeDefinition.upsert({
      where: { code: definition.code },
      create: {
        code: definition.code,
        nameFa: definition.nameFa,
        nameEn: definition.nameEn,
        dataType: definition.dataType,
        unitLabelFa: definition.unitLabelFa,
        options: [...definition.options],
        validation: definition.validation,
      },
      update: isProduction ? {} : {
        nameFa: definition.nameFa,
        nameEn: definition.nameEn,
        dataType: definition.dataType,
        unitLabelFa: definition.unitLabelFa,
        options: [...definition.options],
        validation: definition.validation,
        isActive: true,
      },
    });
    for (const category of stoneCategories) {
      await prisma.categoryAttribute.upsert({
        where: { categoryId_attributeId: { categoryId: category.id, attributeId: attribute.id } },
        create: { categoryId: category.id, attributeId: attribute.id, isRequired: definition.isRequired, sortOrder: sortOrder + 1 },
        update: isProduction ? {} : { isRequired: definition.isRequired, sortOrder: sortOrder + 1 },
      });
    }
  }

  const plans = [
    { code: 'SELLER_TRIAL_14D_V1', nameFa: 'دوره آزمایشی ۱۴روزه', descriptionFa: 'یک‌بار برای هر سازمان؛ روزانه یک و در مجموع حداکثر دو پیشنهاد', billingCycle: 'CUSTOM' as const, durationIso: 'P14D', priceRial: 0n, grantCredits: 10_000_000n, dailyProposalLimit: 1, maxProposalLimit: 2, isTrial: true, isPublic: true },
    { code: 'SELLER_P1M_V1', nameFa: 'اشتراک فروشنده یک‌ماهه', descriptionFa: 'دسترسی به استعلام‌های مرتبط و ارسال روزانه دو پیشنهاد', billingCycle: 'P1M' as const, durationIso: 'P1M', priceRial: 50_000_000n, grantCredits: 5_000_000n, dailyProposalLimit: 2, maxProposalLimit: 6, isTrial: false, isPublic: true },
    { code: 'SELLER_P3M_V1', nameFa: 'اشتراک فروشنده سه‌ماهه', descriptionFa: 'اشتراک سه‌ماهه با قیمت مصوب اولیه MVP', billingCycle: 'P3M' as const, durationIso: 'P3M', priceRial: 145_500_000n, grantCredits: 14_550_000n, dailyProposalLimit: 2, maxProposalLimit: 6, isTrial: false, isPublic: true },
    { code: 'SELLER_P6M_V1', nameFa: 'اشتراک فروشنده شش‌ماهه', descriptionFa: 'اشتراک شش‌ماهه با قیمت مصوب اولیه MVP', billingCycle: 'P6M' as const, durationIso: 'P6M', priceRial: 279_000_000n, grantCredits: 27_900_000n, dailyProposalLimit: 2, maxProposalLimit: 6, isTrial: false, isPublic: true },
    { code: 'SELLER_P1Y_V1', nameFa: 'اشتراک فروشنده سالانه', descriptionFa: 'اشتراک سالانه با قیمت مصوب اولیه MVP', billingCycle: 'P1Y' as const, durationIso: 'P1Y', priceRial: 480_000_000n, grantCredits: 48_000_000n, dailyProposalLimit: 2, maxProposalLimit: 6, isTrial: false, isPublic: true },
    { code: 'SELLER_FOUNDING_P6M_V1', nameFa: 'کارخانه‌های مؤسس شش‌ماهه', descriptionFa: 'پلن غیرعمومی با ظرفیت ۲۰ کارخانه و مدیریت دستی تیم فروش', billingCycle: 'P6M' as const, durationIso: 'P6M', priceRial: 300_000_000n, grantCredits: 30_000_000n, dailyProposalLimit: 2, maxProposalLimit: 6, isTrial: false, isPublic: false },
  ];
  for (const plan of plans) {
    const entitlements = {
      canViewMatchedRfqs: true,
      dailyProposalLimit: plan.dailyProposalLimit,
      shortageOverrideMax: plan.maxProposalLimit,
      ...(plan.isTrial ? { totalProposalLimit: 2 } : {}),
      ...(plan.code === 'SELLER_FOUNDING_P6M_V1' ? { managedSalesOnly: true } : {}),
    };
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      create: { ...plan, taxIncluded: false, isActive: !isProduction, isPublic: !isProduction && plan.isPublic, entitlements },
      update: isProduction ? {} : { ...plan, taxIncluded: false, isActive: true, entitlements },
    });
  }
  const demoDiscountActive = !isProduction;
  await prisma.subscriptionDiscountCode.upsert({
    where: { code: 'DEMO10' },
    create: {
      code: 'DEMO10',
      nameFa: 'تخفیف آزمایشی محیط توسعه',
      descriptionFa: 'کد نمونه برای آزمون جریان خرید؛ در محیط عملیاتی غیرفعال شود.',
      type: 'PERCENTAGE',
      percentageBps: 1000,
      minimumPurchaseRial: 0n,
      perOrganizationLimit: 3,
      maxRedemptions: 1000,
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validUntil: new Date('2030-01-01T00:00:00.000Z'),
      isActive: demoDiscountActive,
    },
    update: { isActive: demoDiscountActive },
  });

  for (const [key, value, descriptionFa] of systemSettings) {
    const isEditable = key !== 'seller.daily_proposal_limit';
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, descriptionFa, isEditable },
      update: isProduction ? { descriptionFa, isEditable } : { value, descriptionFa, isEditable },
    });
  }

  for (const template of inAppNotificationTemplates) {
    await prisma.notificationTemplate.upsert({
      where: { code: template.code },
      create: { ...template, channel: 'IN_APP', locale: 'fa-IR' },
      update: isProduction ? {} : { ...template, channel: 'IN_APP', locale: 'fa-IR', isActive: true },
    });
  }

  const adminMobile = process.env.SEED_ADMIN_MOBILE;
  if (adminMobile) {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: 'SUPER_ADMIN' } });
    const existingProductionAdmin = isProduction
      ? await prisma.userRole.findFirst({ where: { roleId: role.id, organizationId: null, user: { status: 'ACTIVE' } }, select: { user: true } })
      : null;
    const user = existingProductionAdmin?.user ?? await prisma.user.upsert({ where: { mobile: normalizeIranianMobile(adminMobile) }, create: { mobile: normalizeIranianMobile(adminMobile), mobileVerifiedAt: new Date() }, update: {} });
    const existing = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id, organizationId: null } });
    if (!existing) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    await prisma.cmsPage.upsert({
      where: { slug: 'how-it-works' },
      create: {
        slug: 'how-it-works', titleFa: 'نحوه کار وازانو', excerptFa: 'از ثبت نیاز تا مقایسه و انتخاب پیشنهاد مناسب',
        bodyFa: '۱. ثبت نیاز\nمشخصات فنی، مقدار، محل پروژه و زمان موردنیاز را وارد کنید.\n\n۲. دریافت پیشنهاد\nاستعلام پس از بررسی برای فروشندگان واجد شرایط ارسال می‌شود.\n\n۳. مقایسه و انتخاب\nقیمت، زمان تحویل و شرایط پیشنهادها را شفاف مقایسه و گزینه مناسب را انتخاب کنید.',
        seoTitleFa: 'نحوه کار وازانو', seoDescriptionFa: 'راهنمای ثبت استعلام، دریافت پیشنهاد قیمت و انتخاب فروشنده در وازانو',
        status: 'PUBLISHED', publishedAt: new Date(), updatedByUserId: user.id,
      },
      update: {},
    });
    const foundationalPages = [
      {
        slug: 'about', titleFa: 'درباره وازانو', excerptFa: 'زیرساخت تخصصی استعلام قیمت و مدیریت درخواست خرید',
        bodyFa: 'وازانو یک پلتفرم تخصصی برای ثبت، توزیع و مقایسه استعلام قیمت است. فعالیت پلتفرم از بازار سنگ ساختمانی ایران آغاز شده و ساختار آن برای توسعه به سایر مصالح و صنایع طراحی شده است.\n\nهدف وازانو ایجاد فرایندی شفاف، سریع و قابل پیگیری میان خریداران و تأمین‌کنندگان واجد شرایط است.',
        seoTitleFa: 'درباره وازانو', seoDescriptionFa: 'معرفی پلتفرم تخصصی استعلام قیمت وازانو', status: 'PUBLISHED' as const,
      },
      {
        slug: 'terms', titleFa: 'قوانین و شرایط استفاده', excerptFa: 'پیش‌نویس نیازمند بررسی و تأیید مدیریت',
        bodyFa: 'این متن یک پیش‌نویس داخلی است و نباید پیش از بررسی حقوقی و تأیید مدیریت منتشر شود.\n\nسرفصل‌های لازم: نقش وازانو به‌عنوان واسط اطلاعات، مسئولیت کاربران، محرمانگی اطلاعات، قواعد استعلام و پیشنهاد، اشتراک فروشندگان، کنترل کیفیت اختیاری، رسیدگی به تخلف و شرایط تعلیق حساب.',
        seoTitleFa: 'قوانین وازانو', seoDescriptionFa: 'قوانین و شرایط استفاده از پلتفرم وازانو', status: 'DRAFT' as const,
      },
      {
        slug: 'privacy', titleFa: 'سیاست حریم خصوصی', excerptFa: 'پیش‌نویس نیازمند بررسی و تأیید مدیریت',
        bodyFa: 'این متن یک پیش‌نویس داخلی است و نباید پیش از بررسی حقوقی و تأیید مدیریت منتشر شود.\n\nسرفصل‌های لازم: داده‌های دریافتی، هدف پردازش، دسترسی اعضای سازمان، نگهداری و حذف، فایل‌ها و پیوست‌ها، ارائه‌دهندگان خدمات، رخدادهای امنیتی و روش ثبت درخواست یا شکایت حریم خصوصی.',
        seoTitleFa: 'حریم خصوصی وازانو', seoDescriptionFa: 'سیاست حریم خصوصی و حفاظت از داده در وازانو', status: 'DRAFT' as const,
      },
    ];
    for (const page of foundationalPages) {
      await prisma.cmsPage.upsert({
        where: { slug: page.slug },
        create: { ...page, publishedAt: page.status === 'PUBLISHED' ? new Date() : null, updatedByUserId: user.id },
        update: {},
      });
    }
    const initialFaqs = [
      { id: 'faq-buyer-cost', questionFa: 'ثبت استعلام برای خریدار هزینه دارد؟', answerFa: 'در نسخه MVP، ثبت استعلام برای خریدار رایگان است.', category: 'خریداران', sortOrder: 10 },
      { id: 'faq-data-after-expiry', questionFa: 'پس از پایان اشتراک فروشنده، اطلاعات حذف می‌شود؟', answerFa: 'خیر. سوابق و اطلاعات حساب حفظ می‌شود؛ فقط دریافت استعلام و ارسال پیشنهاد جدید مطابق سیاست اشتراک محدود خواهد شد.', category: 'فروشندگان', sortOrder: 20 },
    ];
    for (const faq of initialFaqs) {
      await prisma.faqItem.upsert({
        where: { id: faq.id },
        create: { ...faq, isPublished: true, updatedByUserId: user.id },
        update: {},
      });
    }

    if (!isProduction && process.env.SEED_DEMO_DATA !== 'false') {
      const buyer = await prisma.organization.upsert({
        where: { id: 'demo-buyer-organization' },
        create: { id: 'demo-buyer-organization', kind: 'BUYER', type: 'COMPANY', legalName: 'خریدار آزمایشی وازانو', displayName: 'خریدار آزمایشی', province: 'تهران', city: 'تهران', status: 'ACTIVE' },
        update: { status: 'ACTIVE' },
      });
      await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: buyer.id, userId: user.id } },
        create: { organizationId: buyer.id, userId: user.id, role: 'BUYER_OWNER' },
        update: { role: 'BUYER_OWNER', status: 'ACTIVE' },
      });
      const demoCategory = await prisma.category.findFirstOrThrow({ where: { parentId: naturalStone.id }, orderBy: { sortOrder: 'asc' } });
      const demoUnit = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { code: 'square-meter' } });
      await prisma.rfq.upsert({
        where: { id: 'demo-historical-rfq' },
        create: {
          id: 'demo-historical-rfq', code: 'VZ-DEMO-HISTORY', buyerOrganizationId: buyer.id, buyerContactUserId: user.id, createdByUserId: user.id,
          primaryDomainId: industry.id, title: 'سابقه آزمایشی تکمیل‌شده', lifecycleState: 'CLOSED', operationalStatus: 'COMPLETED', approvalStatus: 'APPROVED',
          source: 'PLATFORM_OPERATOR', manualReviewRequired: false, commitmentStatus: 'NOT_REQUIRED', displayPricesTaxInclusive: false, closedAt: new Date(),
          items: { create: { id: 'demo-historical-rfq-item', categoryId: demoCategory.id, unitId: demoUnit.id, title: 'ردیف آزمایشی سابقه', quantity: '1' } },
        },
        update: {},
      });

      const supplier = await prisma.organization.upsert({
        where: { id: 'demo-supplier-organization' },
        create: { id: 'demo-supplier-organization', kind: 'SUPPLIER', type: 'COMPANY', legalName: 'سنگ نمونه وازانو', displayName: 'سنگ نمونه وازانو', province: 'تهران', city: 'تهران', status: 'ACTIVE' },
        update: { status: 'ACTIVE' },
      });
      await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: supplier.id, userId: user.id } },
        create: { organizationId: supplier.id, userId: user.id, role: 'SUPPLIER_OWNER' },
        update: { role: 'SUPPLIER_OWNER', status: 'ACTIVE' },
      });
      const supplierProfile = await prisma.supplierProfile.upsert({
        where: { organizationId: supplier.id },
        create: { organizationId: supplier.id, description: 'داده آزمایشی محیط توسعه برای کنترل جریان کامل استعلام و پیشنهاد', productionCapacityDescription: 'امکان تأمین سفارش‌های پروژه‌ای در چند نوع سنگ طبیعی و چند مرحله فرآوری', minimumOrderDescription: 'حداقل سفارش براساس نوع سنگ، ابعاد و فرآوری در پیشنهاد قیمت اعلام می‌شود.', leadTimeDescription: 'زمان آماده‌سازی معمول بین ۷ تا ۲۰ روز کاری و وابسته به مشخصات سفارش است.', officialInvoiceAvailable: true, sampleAvailable: true, installationAvailable: false, nationwideCoverage: true, verificationStatus: 'VERIFIED', verifiedAt: new Date() },
        update: { productionCapacityDescription: 'امکان تأمین سفارش‌های پروژه‌ای در چند نوع سنگ طبیعی و چند مرحله فرآوری', minimumOrderDescription: 'حداقل سفارش براساس نوع سنگ، ابعاد و فرآوری در پیشنهاد قیمت اعلام می‌شود.', leadTimeDescription: 'زمان آماده‌سازی معمول بین ۷ تا ۲۰ روز کاری و وابسته به مشخصات سفارش است.', officialInvoiceAvailable: true, sampleAvailable: true, installationAvailable: false, nationwideCoverage: true, verificationStatus: 'VERIFIED', verifiedAt: new Date() },
      });
      const stoneCategories = await prisma.category.findMany({ where: { parentId: naturalStone.id }, select: { id: true } });
      await prisma.supplierCategory.createMany({ data: stoneCategories.map(({ id }) => ({ supplierProfileId: supplierProfile.id, categoryId: id })), skipDuplicates: true });

      const demoPlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: 'SELLER_P1M_V1' } });
      const startsAt = new Date();
      const expiresAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      await prisma.subscription.upsert({
        where: { id: 'demo-supplier-subscription' },
        create: { id: 'demo-supplier-subscription', organizationId: supplier.id, planId: demoPlan.id, status: 'ACTIVE', startsAt, expiresAt, graceEndsAt: new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000), priceRialSnapshot: demoPlan.priceRial, listPriceRialSnapshot: demoPlan.priceRial, grantCreditSnapshot: demoPlan.grantCredits, planVersionSnapshot: demoPlan.version },
        update: { status: 'ACTIVE', startsAt, expiresAt, graceEndsAt: new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000) },
      });
      const wallet = await prisma.creditWallet.upsert({
        where: { organizationId: supplier.id },
        create: { organizationId: supplier.id, cachedBalanceCredits: 10_000_000n },
        update: {},
      });
      await prisma.creditLedgerEntry.upsert({
        where: { idempotencyKey: 'demo-supplier:initial-credit:v1' },
        create: { walletId: wallet.id, type: 'GRANT', amountCredits: 10_000_000n, referenceType: 'DevelopmentSeed', referenceId: supplier.id, idempotencyKey: 'demo-supplier:initial-credit:v1', reasonCode: 'DEVELOPMENT_DEMO_DATA' },
        update: {},
      });
    }
  }
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
