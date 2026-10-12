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

  @Post('suppliers/:organizationId/upload-intent')
  createSupplierUploadIntent(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string, @Body() input: CreateUploadIntentDto) {
    return this.attachments.createSupplierUploadIntent(user, organizationId, input);
  }

  @Get('suppliers/:organizationId')
  listForSupplier(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string) {
    return this.attachments.listForSupplier(user, organizationId);
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
