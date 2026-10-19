import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttachmentsController, PublicSupplierProductAttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { FileSafetyService } from './file-safety.service';
import { ObjectStorageService } from './object-storage.service';

@Module({
  imports: [AuthModule],
  controllers: [AttachmentsController, PublicSupplierProductAttachmentsController],
  providers: [AttachmentsService, ObjectStorageService, FileSafetyService],
  exports: [ObjectStorageService, FileSafetyService],
})
export class AttachmentsModule {}
