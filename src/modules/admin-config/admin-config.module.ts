import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AdminConfigController } from './admin-config.controller';
import { AdminConfigService } from './admin-config.service';

@Module({ imports: [AuthModule, AttachmentsModule], controllers: [AdminConfigController], providers: [AdminConfigService] })
export class AdminConfigModule {}
