import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QualityControlController } from './quality-control.controller';
import { QualityControlService } from './quality-control.service';

@Module({ imports: [AuthModule], controllers: [QualityControlController], providers: [QualityControlService] })
export class QualityControlModule {}
