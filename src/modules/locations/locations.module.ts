import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminLocationsController } from './admin-locations.controller';
import { AdminLocationsService } from './admin-locations.service';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({ imports: [AuthModule], controllers: [LocationsController, AdminLocationsController], providers: [LocationsService, AdminLocationsService] })
export class LocationsModule {}
