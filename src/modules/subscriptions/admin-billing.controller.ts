import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { AdminBillingService } from './admin-billing.service';
import { CreateSubscriptionPlanDto } from './create-subscription-plan.dto';
import { CreateManualSubscriptionRenewalDto } from './create-manual-subscription-renewal.dto';
import { ResolvePaymentReconciliationDto } from './resolve-payment-reconciliation.dto';
import { UpdateSubscriptionPlanDto } from './update-subscription-plan.dto';
import { CreateSubscriptionDiscountDto } from './create-subscription-discount.dto';
import { UpdateSubscriptionDiscountStatusDto } from './update-subscription-discount-status.dto';

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

  @Post('discounts')
  createDiscount(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateSubscriptionDiscountDto) {
    return this.billing.createDiscount(user, input);
  }

  @Put('discounts/:discountId/status')
  updateDiscountStatus(@CurrentUser() user: AuthenticatedUser, @Param('discountId') discountId: string, @Body() input: UpdateSubscriptionDiscountStatusDto) {
    return this.billing.updateDiscountStatus(user, discountId, input);
  }

  @Post('payments/:paymentId/reconcile')
  reconcilePayment(@CurrentUser() user: AuthenticatedUser, @Param('paymentId') paymentId: string) {
    return this.billing.reconcilePayment(user, paymentId);
  }

  @Post('payments/:paymentId/resolve-reconciliation')
  resolvePaymentReconciliation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId') paymentId: string,
    @Body() input: ResolvePaymentReconciliationDto,
  ) {
    return this.billing.resolvePaymentReconciliation(user, paymentId, input);
  }

  @Post('reminders/:reminderId/retry')
  retryReminder(@CurrentUser() user: AuthenticatedUser, @Param('reminderId') reminderId: string) {
    return this.billing.retryReminder(user, reminderId);
  }

  @Post('manual-renewals')
  createManualRenewal(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateManualSubscriptionRenewalDto) {
    return this.billing.createManualRenewal(user, input);
  }
}
