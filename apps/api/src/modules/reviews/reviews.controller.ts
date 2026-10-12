import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { CreateSupplierReviewDto } from './create-supplier-review.dto';
import { ModerateSupplierReviewDto } from './moderate-supplier-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
@UseGuards(SessionGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('rfqs/:rfqId')
  getForRfq(@CurrentUser() user: AuthenticatedUser, @Param('rfqId') rfqId: string) {
    return this.reviews.getForRfq(user, rfqId);
  }

  @Post('rfqs/:rfqId')
  create(@CurrentUser() user: AuthenticatedUser, @Param('rfqId') rfqId: string, @Body() input: CreateSupplierReviewDto) {
    return this.reviews.create(user, rfqId, input);
  }

  @Get('suppliers/:organizationId/summary')
  summary(@Param('organizationId') organizationId: string) {
    return this.reviews.summaryForSupplier(organizationId);
  }

  @Get('admin/moderation')
  listForModeration(@CurrentUser() user: AuthenticatedUser) {
    return this.reviews.listForModeration(user);
  }

  @Put('admin/:reviewId')
  moderate(@CurrentUser() user: AuthenticatedUser, @Param('reviewId') reviewId: string, @Body() input: ModerateSupplierReviewDto) {
    return this.reviews.moderate(user, reviewId, input);
  }
}
