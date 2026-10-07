export const ticketTypeLabels: Record<string, string> = {
  QUESTION: 'پرسش',
  SERVICE_REQUEST: 'درخواست خدمت',
  ISSUE: 'مشکل',
  COMPLAINT: 'شکایت',
  VIOLATION_REPORT: 'گزارش تخلف',
  APPEAL: 'اعتراض به تصمیم',
};

export const ticketCategoryLabels: Record<string, string> = {
  PRODUCT_TECHNICAL: 'فنی و محصول',
  ACCOUNT_ACCESS: 'حساب و دسترسی',
  RFQ: 'استعلام',
  QUOTATION: 'پیشنهاد قیمت',
  SUPPLIER_BUYER_CONDUCT: 'رفتار خریدار یا فروشنده',
  BILLING: 'مالی و اشتراک',
  PRIVACY_SECURITY: 'حریم خصوصی و امنیت',
  COMMUNICATION: 'ارتباطات',
  POLICY: 'قوانین و سیاست‌ها',
  OTHER: 'سایر',
};

export const ticketStatusLabels: Record<string, string> = {
  SUBMITTED: 'ثبت‌شده',
  ACKNOWLEDGED: 'دریافت‌شده',
  IN_REVIEW: 'در حال بررسی',
  WAITING_FOR_REQUESTER: 'در انتظار پاسخ شما',
  RESOLVED: 'حل‌شده',
  CLOSED: 'بسته‌شده',
  REJECTED: 'ردشده',
};
