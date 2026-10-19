import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { AdminConfigService } from './admin-config.service';
import { UpdateNotificationTemplateDto } from './update-notification-template.dto';
import { UpdateSystemSettingDto } from './update-system-setting.dto';

@Controller('admin/config')
@UseGuards(SessionGuard)
export class AdminConfigController {
  constructor(private readonly config: AdminConfigService) {}

  @Get('settings')
  listSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.config.listSettings(user);
  }

  @Get('release-readiness')
  releaseReadiness(@CurrentUser() user: AuthenticatedUser) {
    return this.config.releaseReadiness(user);
  }

  @Get('delivery-progress')
  deliveryProgress(@CurrentUser() user: AuthenticatedUser) {
    return this.config.deliveryProgress(user);
  }

  @Put('settings/:settingId')
  updateSetting(@CurrentUser() user: AuthenticatedUser, @Param('settingId') settingId: string, @Body() input: UpdateSystemSettingDto) {
    return this.config.updateSetting(user, settingId, input);
  }

  @Get('notification-templates')
  listNotificationTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.config.listNotificationTemplates(user);
  }

  @Put('notification-templates/:templateId')
  updateNotificationTemplate(@CurrentUser() user: AuthenticatedUser, @Param('templateId') templateId: string, @Body() input: UpdateNotificationTemplateDto) {
    return this.config.updateNotificationTemplate(user, templateId, input);
  }
}
