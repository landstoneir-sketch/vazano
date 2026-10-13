import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpdateNotificationTemplateDto } from './update-notification-template.dto';
import { UpdateSystemSettingDto } from './update-system-setting.dto';
import { evaluateReleaseReadiness } from './release-readiness';
import { assertValidSubscriptionPolicySetting } from '../subscriptions/subscription-policy-settings.service';
import { assertValidProposalFeePolicy, assertValidShortageOverrideSetting } from '../quotations/quotation-policies';
import { assertValidRfqPolicySetting, resolveRfqPolicySettings } from '../rfqs/rfq-policy-settings.service';

@Injectable()
export class AdminConfigService {
  constructor(private readonly prisma: PrismaService, private readonly environment: ConfigService) {}

  async releaseReadiness(user: AuthenticatedUser) {
    this.requireAnyPermission(user, ['settings.read', 'settings.manage']);
    const [legalPages, paidPlanCount, activeCategoryCount, activeProvinceCount, activeSuperAdminCount] = await Promise.all([
      this.prisma.cmsPage.findMany({ where: { slug: { in: ['terms', 'privacy'] } }, select: { slug: true, status: true } }),
      this.prisma.subscriptionPlan.count({ where: { isActive: true, isPublic: true, isTrial: false, priceRial: { gt: 0 } } }),
      this.prisma.category.count({ where: { isActive: true, parentId: { not: null } } }),
      this.prisma.province.count({ where: { isActive: true } }),
      this.prisma.user.count({
        where: { status: 'ACTIVE', userRoles: { some: { organizationId: null, role: { key: 'SUPER_ADMIN' } } } },
      }),
    ]);
    const pageStatus = new Map(legalPages.map((page) => [page.slug, page.status]));
    const renewalTemplateKeys = [
      'SMSIR_SUBSCRIPTION_RENEWAL_14_TEMPLATE_ID', 'SMSIR_SUBSCRIPTION_RENEWAL_7_TEMPLATE_ID', 'SMSIR_SUBSCRIPTION_RENEWAL_3_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_EXPIRED_TEMPLATE_ID', 'SMSIR_SUBSCRIPTION_GRACE_ENDED_TEMPLATE_ID', 'SMSIR_SUBSCRIPTION_TRIAL_7_TEMPLATE_ID',
      'SMSIR_SUBSCRIPTION_TRIAL_3_TEMPLATE_ID', 'SMSIR_SUBSCRIPTION_TRIAL_1_TEMPLATE_ID', 'SMSIR_SUBSCRIPTION_TRIAL_ENDED_TEMPLATE_ID',
    ];
    const smsConfigured = this.environment.get<string>('SMS_PROVIDER') === 'smsir'
      && Boolean(this.environment.get<string>('SMSIR_API_KEY'))
      && Boolean(this.environment.get<string>('SMSIR_TEMPLATE_ID'));
    const subscriptionSmsConfigured = this.environment.get<string>('SUBSCRIPTION_SMS_ENABLED') === 'true'
      && renewalTemplateKeys.every((key) => Boolean(this.environment.get<string>(key)));
    const paymentConfigured = this.environment.get<string>('PAYMENT_PROVIDER', 'zarinpal') === 'zarinpal'
      && this.environment.get<string>('ZARINPAL_ENABLED') === 'true'
      && this.environment.get<string>('ZARINPAL_SANDBOX') === 'false'
      && Boolean(this.environment.get<string>('ZARINPAL_MERCHANT_ID'));

    return {
      generatedAt: new Date().toISOString(),
      ...evaluateReleaseReadiness({
        nodeEnvironment: this.environment.get<string>('NODE_ENV', 'development'),
        otpDebugEnabled: this.environment.get<string>('OTP_DEBUG_ENABLED') === 'true',
        smsConfigured,
        subscriptionSmsConfigured,
        paymentConfigured,
        fileScanningConfigured: this.environment.get<string>('FILE_SCAN_MODE') === 'clamav',
        notificationWorkerEnabled: this.environment.get<string>('NOTIFICATION_WORKER_ENABLED', 'true') === 'true',
        subscriptionWorkerEnabled: this.environment.get<string>('SUBSCRIPTION_LIFECYCLE_WORKER_ENABLED', 'true') === 'true',
        termsPublished: pageStatus.get('terms') === 'PUBLISHED',
        privacyPublished: pageStatus.get('privacy') === 'PUBLISHED',
        paidPlanCount,
        activeCategoryCount,
        activeProvinceCount,
        activeSuperAdminCount,
      }),
    };
  }

  listSettings(user: AuthenticatedUser) {
    this.requireAnyPermission(user, ['settings.read', 'settings.manage']);
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async updateSetting(user: AuthenticatedUser, settingId: string, input: UpdateSystemSettingDto) {
    this.requireAnyPermission(user, ['settings.manage']);
    const setting = await this.prisma.systemSetting.findUnique({ where: { id: settingId } });
    if (!setting) throw new NotFoundException('تنظیم پیدا نشد.');
    if (!setting.isEditable) throw new ForbiddenException('این تنظیم از پنل قابل تغییر نیست.');
    try {
      assertValidSubscriptionPolicySetting(setting.key, input.value);
      assertValidRfqPolicySetting(setting.key, input.value);
      if (['market.coverage.mode', 'market.coverage.province_codes'].includes(setting.key)) {
        const coverageRows = await this.prisma.systemSetting.findMany({
          where: { key: { in: ['market.coverage.mode', 'market.coverage.province_codes'] } },
          select: { key: true, value: true },
        });
        resolveRfqPolicySettings({ ...Object.fromEntries(coverageRows.map((row) => [row.key, row.value])), [setting.key]: input.value });
      }
      if (setting.key === 'seller.shortage_override') assertValidShortageOverrideSetting(input.value);
      if (setting.key === 'seller.proposal_fee_policy') assertValidProposalFeePolicy(input.value);
    }
    catch (error: unknown) {
      throw new BadRequestException(error instanceof Error ? error.message : 'مقدار تنظیم معتبر نیست.');
    }
    const serialized = JSON.stringify(input.value);
    if (serialized === undefined || serialized.length > 10_000) throw new BadRequestException('مقدار تنظیم معتبر یا در محدوده مجاز نیست.');
    const value = input.value === null ? Prisma.JsonNull : input.value as Prisma.InputJsonValue;

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.systemSetting.updateMany({
        where: { id: setting.id, version: input.expectedVersion },
        data: { value, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new ConflictException('این تنظیم هم‌زمان توسط شخص دیگری تغییر کرده است؛ صفحه را تازه‌سازی کنید.');
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'system_setting.update',
          entityType: 'SystemSetting',
          entityId: setting.id,
          metadata: { key: setting.key, previousVersion: setting.version },
        },
      });
      return tx.systemSetting.findUniqueOrThrow({ where: { id: setting.id } });
    });
  }

  listNotificationTemplates(user: AuthenticatedUser) {
    this.requireAnyPermission(user, ['settings.read', 'settings.manage', 'content.manage']);
    return this.prisma.notificationTemplate.findMany({ orderBy: [{ channel: 'asc' }, { eventType: 'asc' }] });
  }

  async updateNotificationTemplate(user: AuthenticatedUser, templateId: string, input: UpdateNotificationTemplateDto) {
    this.requireAnyPermission(user, ['settings.manage', 'content.manage']);
    if (input.actionPathTemplate && (!input.actionPathTemplate.startsWith('/') || input.actionPathTemplate.startsWith('//'))) {
      throw new BadRequestException('مسیر اقدام باید یک مسیر داخلی وازانو باشد.');
    }
    const template = await this.prisma.notificationTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException('قالب اعلان پیدا نشد.');

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.notificationTemplate.updateMany({
        where: { id: template.id, version: input.expectedVersion },
        data: {
          titleTemplate: input.titleTemplate,
          bodyTemplate: input.bodyTemplate,
          actionPathTemplate: input.actionPathTemplate || null,
          isActive: input.isActive,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('این قالب هم‌زمان توسط شخص دیگری تغییر کرده است؛ صفحه را تازه‌سازی کنید.');
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'notification_template.update',
          entityType: 'NotificationTemplate',
          entityId: template.id,
          metadata: { code: template.code, previousVersion: template.version },
        },
      });
      return tx.notificationTemplate.findUniqueOrThrow({ where: { id: template.id } });
    });
  }

  private requireAnyPermission(user: AuthenticatedUser, permissions: string[]): void {
    if (!permissions.some((permission) => user.permissions.includes(permission))) {
      throw new ForbiddenException('شما مجوز انجام این عملیات را ندارید.');
    }
  }
}
