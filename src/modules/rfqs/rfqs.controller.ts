import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { CreateRfqDto, UpdateRfqDto } from './create-rfq.dto';
import { RfqsService } from './rfqs.service';
import { CancelRfqDto, MarkRfqInvitationViewedDto, ReviewRfqDto } from './review-rfq.dto';
import { CreateCommitmentPaymentDto } from './create-commitment-payment.dto';

@Controller('rfqs')
@UseGuards(SessionGuard)
export class RfqsController {
  constructor(private readonly rfqs: RfqsService) {}

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.rfqs.listForUser(user);
  }

  @Get('admin/review-queue')
  listReviewQueue(@CurrentUser() user: AuthenticatedUser) {
    return this.rfqs.listReviewQueue(user);
  }

  @Get('matched')
  listMatched(@CurrentUser() user: AuthenticatedUser) {
    return this.rfqs.listMatchedForSupplier(user);
  }

  @Get('active-policy')
  activePolicy() {
    return this.rfqs.getActivePolicy();
  }

  @Post('invitations/:invitationId/decline')
  declineInvitation(@CurrentUser() user: AuthenticatedUser, @Param('invitationId') invitationId: string) {
    return this.rfqs.declineInvitation(user, invitationId);
  }

  @Post(':id/invitations/view')
  markInvitationViewed(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: MarkRfqInvitationViewedDto) {
    return this.rfqs.markInvitationViewed(user, id, input.supplierOrganizationId);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.rfqs.getOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateRfqDto) {
    return this.rfqs.createSelfService(user, input);
  }

  @Post('on-behalf')
  createOnBehalf(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateRfqDto) {
    return this.rfqs.createOnBehalf(user, input);
  }

  @Put(':id')
  updateDraft(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: UpdateRfqDto) {
    return this.rfqs.updateDraft(user, id, input);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.rfqs.submit(user, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: CancelRfqDto) {
    return this.rfqs.cancel(user, id, input.reason);
  }

  @Post(':id/review')
  review(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: ReviewRfqDto) {
    return this.rfqs.review(user, id, input);
  }

  @Post(':id/publish')
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.rfqs.publish(user, id);
  }

  @Post(':id/commitment/payment')
  createCommitmentPayment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: CreateCommitmentPaymentDto) {
    return this.rfqs.createCommitmentPayment(user, id, input.idempotencyKey);
  }
}
