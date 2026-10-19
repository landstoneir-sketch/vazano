import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { CreateQuotationDto, UpdateQuotationDto } from './create-quotation.dto';
import { QuotationsService } from './quotations.service';

@Controller('quotations')
@UseGuards(SessionGuard)
export class QuotationsController {
  constructor(private readonly quotations: QuotationsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateQuotationDto) {
    return this.quotations.createDraft(user, input);
  }

  @Put(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: UpdateQuotationDto) {
    return this.quotations.updateDraft(user, id, input);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.quotations.submit(user, id);
  }

  @Post(':id/accept')
  accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.quotations.accept(user, id);
  }

  @Post(':id/withdraw')
  withdraw(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.quotations.withdraw(user, id);
  }

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser, @Query('organizationId') organizationId: string) {
    return this.quotations.listForSupplier(user, organizationId);
  }

  @Get('active-policy')
  activePolicy() {
    return this.quotations.getActivePolicy();
  }

  @Get('rfqs/:rfqId/comparison')
  comparison(@CurrentUser() user: AuthenticatedUser, @Param('rfqId') rfqId: string) {
    return this.quotations.comparison(user, rfqId);
  }
}
