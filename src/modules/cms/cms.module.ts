import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminCmsController, PublicCmsController } from './cms.controller';
import { CmsService } from './cms.service';

@Module({ imports: [AuthModule], controllers: [PublicCmsController, AdminCmsController], providers: [CmsService] })
export class CmsModule {}
