import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionBillingService } from './subscription-billing.service';
import { StartSubscriptionCheckoutDto } from './start-subscription-checkout.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService, private readonly billing: SubscriptionBillingService) {}

  @Get('plans')
  listPlans() {
    return this.subscriptions.listPublicPlans();
  }

  @Get('organizations/:organizationId')
  @UseGuards(SessionGuard)
  listForOrganization(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string) {
    return this.subscriptions.listForOrganization(user, organizationId);
  }

  @Post('organizations/:organizationId/checkout')
  @UseGuards(SessionGuard)
  checkout(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string, @Body() input: StartSubscriptionCheckoutDto) {
    return this.billing.startCheckout(user, organizationId, input.planId, input.idempotencyKey);
  }
}
