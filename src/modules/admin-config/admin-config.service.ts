import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpdateNotificationTemplateDto } from './update-notification-template.dto';
import { UpdateSystemSettingDto } from './update-system-setting.dto';

@Injectable()
export class AdminConfigService {
  constructor(private readonly prisma: PrismaService) {}

  listSettings(user: AuthenticatedUser) {
    this.requireAnyPermission(user, ['settings.read', 'settings.manage']);
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async updateSetting(user: AuthenticatedUser, settingId: string, input: UpdateSystemSettingDto) {
    this.requireAnyPermission(user, ['settings.manage']);
    const setting = await this.prisma.systemSetting.findUnique({ where: { id: settingId } });
    if (!setting) throw new NotFoundException('تنظیم پیدا نشد.');
    if (!setting.isEditable) throw new ForbiddenException('این تنظیم از پنل قابل تغییر نیست.');
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
