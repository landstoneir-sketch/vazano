INSERT INTO "notification_templates" (
  "id", "code", "event_type", "channel", "locale", "title_template", "body_template", "action_path_template", "updated_at"
) VALUES
  (
    'tpl-sub-trial-7-fa-v1',
    'IN_APP_SUBSCRIPTION_TRIAL_7_DAYS_FA_V1',
    'ir.vazano.subscription.trial.7_days_before.v1',
    'IN_APP',
    'fa-IR',
    '۷ روز تا پایان دوره آزمایشی',
    'دوره آزمایشی «{{planName}}» در {{expiresAt}} پایان می‌یابد. برای ادامه دریافت استعلام، پلن مناسب را انتخاب کنید.',
    '/supplier/subscription',
    CURRENT_TIMESTAMP
  ),
  (
    'tpl-sub-trial-3-fa-v1',
    'IN_APP_SUBSCRIPTION_TRIAL_3_DAYS_FA_V1',
    'ir.vazano.subscription.trial.3_days_before.v1',
    'IN_APP',
    'fa-IR',
    '۳ روز تا پایان دوره آزمایشی',
    'برای جلوگیری از توقف امکانات فروشنده، پیش از {{expiresAt}} اشتراک خود را فعال کنید.',
    '/supplier/subscription',
    CURRENT_TIMESTAMP
  ),
  (
    'tpl-sub-trial-1-fa-v1',
    'IN_APP_SUBSCRIPTION_TRIAL_1_DAY_FA_V1',
    'ir.vazano.subscription.trial.1_day_before.v1',
    'IN_APP',
    'fa-IR',
    'فردا دوره آزمایشی پایان می‌یابد',
    'تنها یک روز از دوره آزمایشی «{{planName}}» باقی مانده است.',
    '/supplier/subscription',
    CURRENT_TIMESTAMP
  ),
  (
    'tpl-sub-trial-expired-fa-v1',
    'IN_APP_SUBSCRIPTION_TRIAL_EXPIRED_FA_V1',
    'ir.vazano.subscription.trial.expired.v1',
    'IN_APP',
    'fa-IR',
    'دوره آزمایشی پایان یافت',
    'دوره آزمایشی «{{planName}}» پایان یافت. اطلاعات و سوابق حساب محفوظ است.',
    '/supplier/subscription',
    CURRENT_TIMESTAMP
  )
ON CONFLICT DO NOTHING;
