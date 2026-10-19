import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { AuthModule } from '../auth/auth.module';
import { PublicSuppliersController } from './public-suppliers.controller';

@Module({ imports: [AuthModule], controllers: [SuppliersController, PublicSuppliersController], providers: [SuppliersService] })
export class SuppliersModule {}
