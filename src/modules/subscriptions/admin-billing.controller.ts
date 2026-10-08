import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { AdminBillingService } from './admin-billing.service';
import { CreateSubscriptionPlanDto } from './create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './update-subscription-plan.dto';

@Controller('admin/billing')
@UseGuards(SessionGuard)
export class AdminBillingController {
  constructor(private readonly billing: AdminBillingService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.overview(user);
  }

  @Post('plans')
  createPlan(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateSubscriptionPlanDto) {
    return this.billing.createPlan(user, input);
  }

  @Put('plans/:planId')
  updatePlan(@CurrentUser() user: AuthenticatedUser, @Param('planId') planId: string, @Body() input: UpdateSubscriptionPlanDto) {
    return this.billing.updatePlan(user, planId, input);
  }
}
