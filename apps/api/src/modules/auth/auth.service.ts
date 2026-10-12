import { HttpException, HttpStatus, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '@prisma/client';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { normalizeIranianMobile } from './domain/mobile';
import { SMS_PORT, type SmsPort } from './sms/sms.port';

type RequestOtpResult = { expiresInSeconds: number; debugCode?: string };
type VerifyOtpResult = { token: string; expiresAt: Date; user: { id: string; mobile: string }; isNewUser: boolean };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(SMS_PORT) private readonly sms: SmsPort,
  ) {}

  async requestOtp(rawMobile: string, purpose: OtpPurpose, ipAddress?: string, userAgent?: string): Promise<RequestOtpResult> {
    const mobile = normalizeIranianMobile(rawMobile);
    const windowStartedAt = new Date(Date.now() - 60_000);
    const [recentMobileCount, recentIpCount] = await Promise.all([
      this.prisma.otpCode.count({ where: { mobile, createdAt: { gte: windowStartedAt } } }),
      ipAddress ? this.prisma.otpCode.count({ where: { ipAddress, createdAt: { gte: windowStartedAt } } }) : Promise.resolve(0),
    ]);
    const ipLimit = Number(this.config.get<string>('OTP_IP_REQUESTS_PER_MINUTE', '10'));
    if (recentMobileCount >= 3 || (ipAddress && recentIpCount >= ipLimit)) {
      await this.prisma.securityEvent.create({ data: {
        eventType: 'auth.otp.request_rate_limited', severity: 'MEDIUM', outcome: 'BLOCKED',
        subjectHash: this.hashSubject(mobile), ipAddress, userAgent: this.safeUserAgent(userAgent), metadata: { purpose, recentMobileCount, recentIpCount, ipLimit },
      } });
      throw new HttpException('تعداد درخواست‌ها زیاد است؛ یک دقیقه بعد دوباره تلاش کنید.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const debugEnabled = this.config.get<string>('OTP_DEBUG_ENABLED') === 'true';
    const code = debugEnabled ? this.config.get<string>('OTP_DEBUG_CODE', '11111') : randomInt(10_000, 100_000).toString();
    const ttl = this.config.get<number>('OTP_TTL_SECONDS', 120);
    const otp = await this.prisma.$transaction(async (tx) => {
      await tx.otpCode.updateMany({ where: { mobile, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
      return tx.otpCode.create({ data: { mobile, purpose, codeHash: this.hashOtp(mobile, purpose, code), ipAddress, expiresAt: new Date(Date.now() + ttl * 1000) } });
    });
    try { await this.sms.sendOtp(mobile, code); }
    catch (error) {
      await this.prisma.$transaction([
        this.prisma.otpCode.delete({ where: { id: otp.id } }),
        this.prisma.securityEvent.create({ data: {
          eventType: 'auth.otp.delivery_failed', severity: 'LOW', outcome: 'FAILED',
          subjectHash: this.hashSubject(mobile), ipAddress, userAgent: this.safeUserAgent(userAgent), metadata: { purpose },
        } }),
      ]);
      throw error;
    }
    return { expiresInSeconds: ttl, ...(debugEnabled ? { debugCode: code } : {}) };
  }

  async verifyOtp(rawMobile: string, purpose: OtpPurpose, code: string, ipAddress?: string, userAgent?: string): Promise<VerifyOtpResult> {
    const mobile = normalizeIranianMobile(rawMobile);
    const otp = await this.prisma.otpCode.findFirst({ where: { mobile, purpose, consumedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!otp || otp.expiresAt <= new Date()) {
      await this.prisma.securityEvent.create({ data: {
        eventType: 'auth.otp.invalid_or_expired', severity: 'LOW', outcome: 'DENIED',
        subjectHash: this.hashSubject(mobile), ipAddress, userAgent: this.safeUserAgent(userAgent), metadata: { purpose },
      } });
      throw new UnauthorizedException('کد تأیید منقضی یا نامعتبر است.');
    }
    const maxAttempts = this.config.get<number>('OTP_MAX_ATTEMPTS', 5);
    if (otp.attempts >= maxAttempts) {
      await this.prisma.securityEvent.create({ data: {
        eventType: 'auth.otp.attempt_limit_reached', severity: 'HIGH', outcome: 'BLOCKED',
        subjectHash: this.hashSubject(mobile), ipAddress, userAgent: this.safeUserAgent(userAgent), metadata: { purpose, attempts: otp.attempts },
      } });
      throw new HttpException('تعداد تلاش‌های ناموفق بیش از حد مجاز است.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const expected = Buffer.from(otp.codeHash, 'hex');
    const supplied = Buffer.from(this.hashOtp(mobile, purpose, code), 'hex');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      await this.prisma.$transaction([
        this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } }),
        this.prisma.securityEvent.create({ data: {
          eventType: 'auth.otp.code_mismatch', severity: 'MEDIUM', outcome: 'DENIED',
          subjectHash: this.hashSubject(mobile), ipAddress, userAgent: this.safeUserAgent(userAgent), metadata: { purpose, attempt: otp.attempts + 1 },
        } }),
      ]);
      throw new UnauthorizedException('کد تأیید صحیح نیست.');
    }
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.get<number>('SESSION_TTL_DAYS', 30) * 86_400_000);
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { mobile } });
      const user = existing ?? await tx.user.create({ data: { mobile, mobileVerifiedAt: new Date() } });
      if (user.status !== 'ACTIVE') throw new UnauthorizedException('حساب کاربری غیرفعال است.');
      await tx.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      await tx.session.create({ data: { userId: user.id, tokenHash: this.hashToken(rawToken), expiresAt, ipAddress, userAgent } });
      await tx.auditLog.create({ data: { actorUserId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, ipAddress } });
      await tx.securityEvent.create({ data: {
        eventType: 'auth.login.success', severity: 'INFO', outcome: 'SUCCESS', userId: user.id,
        subjectHash: this.hashSubject(mobile), ipAddress, userAgent: this.safeUserAgent(userAgent), metadata: { purpose },
      } });
      await tx.outboxEvent.create({ data: { aggregateType: 'User', aggregateId: user.id, eventType: 'ir.vazano.auth.login.v1', payload: { userId: user.id } } });
      return { user, isNewUser: !existing };
    });
    return { token: rawToken, expiresAt, user: { id: result.user.id, mobile: result.user.mobile }, isNewUser: result.isNewUser };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.session.updateMany({ where: { tokenHash: this.hashToken(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async listSessions(userId: string, rawToken: string) {
    const currentTokenHash = this.hashToken(rawToken);
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, tokenHash: true, expiresAt: true, lastSeenAt: true, ipAddress: true, userAgent: true, createdAt: true },
      orderBy: { lastSeenAt: 'desc' },
    });
    return sessions.map(({ tokenHash, ...session }) => ({ ...session, isCurrent: tokenHash === currentTokenHash }));
  }

  async revokeSession(userId: string, sessionId: string, rawToken: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
      select: { id: true, tokenHash: true },
    });
    if (!session) throw new NotFoundException('نشست فعال پیدا نشد.');
    const isCurrent = session.tokenHash === this.hashToken(rawToken);
    await this.prisma.$transaction(async (tx) => {
      await tx.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: {
        actorUserId: userId, action: 'auth.session.revoke', entityType: 'Session', entityId: session.id,
        metadata: { isCurrent },
      } });
      await tx.securityEvent.create({ data: {
        eventType: 'auth.session.revoked_by_user', severity: 'INFO', outcome: 'SUCCESS', userId,
        metadata: { sessionId: session.id, isCurrent },
      } });
    });
    return { sessionId: session.id, revoked: true, isCurrent };
  }

  hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
  private hashSubject(value: string): string {
    const pepper = this.config.getOrThrow<string>('OTP_PEPPER');
    return createHmac('sha256', pepper).update(`security-subject:${value}`).digest('hex');
  }
  private safeUserAgent(userAgent: string | undefined): string | undefined {
    return userAgent?.slice(0, 500);
  }
  private hashOtp(mobile: string, purpose: OtpPurpose, code: string): string {
    const pepper = this.config.getOrThrow<string>('OTP_PEPPER');
    return createHmac('sha256', pepper).update(`${mobile}:${purpose}:${code}`).digest('hex');
  }
}
