import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { QualityControlStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { QualityControlService } from './quality-control.service';
import { StartQualityControlCheckoutDto } from './start-quality-control-checkout.dto';
import { UpdateQualityControlStatusDto } from './update-quality-control-status.dto';

@Controller('quality-control')
@UseGuards(SessionGuard)
export class QualityControlController {
  constructor(private readonly qualityControl: QualityControlService) {}

  @Post('rfqs/:rfqId/checkout')
  startCheckout(@CurrentUser() user: AuthenticatedUser, @Param('rfqId') rfqId: string, @Body() input: StartQualityControlCheckoutDto) {
    return this.qualityControl.startCheckout(user, rfqId, input.idempotencyKey);
  }

  @Get('admin/requests')
  listForAdmin(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: QualityControlStatus) {
    return this.qualityControl.listForAdmin(user, status);
  }

  @Put('admin/requests/:requestId/status')
  updateOperationalStatus(@CurrentUser() user: AuthenticatedUser, @Param('requestId') requestId: string, @Body() input: UpdateQualityControlStatusDto) {
    return this.qualityControl.updateOperationalStatus(user, requestId, input);
  }
}
