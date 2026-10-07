export const SMS_PORT = Symbol('SMS_PORT');
export interface SmsPort { sendOtp(mobile: string, code: string): Promise<void>; }
