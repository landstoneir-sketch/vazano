import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { PaymentReceiptsService } from './payment-receipts.service';

@Controller('payments/receipts')
@UseGuards(SessionGuard)
export class PaymentReceiptsController {
  constructor(private readonly receipts: PaymentReceiptsService) {}

  @Get(':receiptId')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('receiptId') receiptId: string) {
    return this.receipts.getById(user, receiptId);
  }
}
