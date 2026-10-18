import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { AttachmentsService } from './attachments.service';
import { CreateUploadIntentDto } from './create-upload-intent.dto';

@Controller('attachments')
@UseGuards(SessionGuard)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post('rfqs/:rfqId/upload-intent')
  createRfqUploadIntent(@CurrentUser() user: AuthenticatedUser, @Param('rfqId') rfqId: string, @Body() input: CreateUploadIntentDto) {
    return this.attachments.createRfqUploadIntent(user, rfqId, input);
  }

  @Get('rfqs/:rfqId')
  listForRfq(@CurrentUser() user: AuthenticatedUser, @Param('rfqId') rfqId: string) {
    return this.attachments.listForRfq(user, rfqId);
  }

  @Post('quotations/:quotationId/upload-intent')
  createQuotationUploadIntent(@CurrentUser() user: AuthenticatedUser, @Param('quotationId') quotationId: string, @Body() input: CreateUploadIntentDto) {
    return this.attachments.createQuotationUploadIntent(user, quotationId, input);
  }

  @Get('quotations/:quotationId')
  listForQuotation(@CurrentUser() user: AuthenticatedUser, @Param('quotationId') quotationId: string) {
    return this.attachments.listForQuotation(user, quotationId);
  }

  @Post('suppliers/:organizationId/upload-intent')
  createSupplierUploadIntent(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string, @Body() input: CreateUploadIntentDto) {
    return this.attachments.createSupplierUploadIntent(user, organizationId, input);
  }

  @Get('suppliers/:organizationId')
  listForSupplier(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string) {
    return this.attachments.listForSupplier(user, organizationId);
  }

  @Post('supplier-products/:productId/upload-intent')
  createSupplierProductUploadIntent(@CurrentUser() user: AuthenticatedUser, @Param('productId') productId: string, @Body() input: CreateUploadIntentDto) {
    return this.attachments.createSupplierProductUploadIntent(user, productId, input);
  }

  @Get('supplier-products/:productId')
  listForSupplierProduct(@CurrentUser() user: AuthenticatedUser, @Param('productId') productId: string) {
    return this.attachments.listForSupplierProduct(user, productId);
  }

  @Post('support-tickets/:ticketId/upload-intent')
  createSupportTicketUploadIntent(@CurrentUser() user: AuthenticatedUser, @Param('ticketId') ticketId: string, @Body() input: CreateUploadIntentDto) {
    return this.attachments.createSupportTicketUploadIntent(user, ticketId, input);
  }

  @Get('support-tickets/:ticketId')
  listForSupportTicket(@CurrentUser() user: AuthenticatedUser, @Param('ticketId') ticketId: string) {
    return this.attachments.listForSupportTicket(user, ticketId);
  }

  @Post(':attachmentId/complete')
  complete(@CurrentUser() user: AuthenticatedUser, @Param('attachmentId') attachmentId: string) {
    return this.attachments.complete(user, attachmentId);
  }

  @Get(':attachmentId/download-url')
  downloadUrl(@CurrentUser() user: AuthenticatedUser, @Param('attachmentId') attachmentId: string) {
    return this.attachments.downloadUrl(user, attachmentId);
  }

  @Delete(':attachmentId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('attachmentId') attachmentId: string) {
    return this.attachments.remove(user, attachmentId);
  }
}

@Controller('public/supplier-products')
export class PublicSupplierProductAttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get(':productId/images')
  listImages(@Param('productId') productId: string) {
    return this.attachments.listPublicSupplierProductImages(productId);
  }
}
