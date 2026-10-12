export const SMS_PORT = Symbol('SMS_PORT');

export type SmsTemplateCode =
  | 'OTP_LOGIN'
  | 'SUBSCRIPTION_RENEWAL_14_DAYS'
  | 'SUBSCRIPTION_RENEWAL_7_DAYS'
  | 'SUBSCRIPTION_RENEWAL_3_DAYS'
  | 'SUBSCRIPTION_EXPIRED'
  | 'SUBSCRIPTION_GRACE_ENDED';

export type SmsTemplateParameter = { name: string; value: string };

export interface SmsPort {
  sendOtp(mobile: string, code: string): Promise<void>;
  sendTemplate(mobile: string, templateCode: SmsTemplateCode, parameters: SmsTemplateParameter[]): Promise<void>;
}
