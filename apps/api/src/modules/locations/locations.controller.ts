import { Controller, Get, Param } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('provinces')
  listProvinces() {
    return this.locations.listProvinces();
  }

  @Get('provinces/:provinceId/cities')
  listCities(@Param('provinceId') provinceId: string) {
    return this.locations.listCities(provinceId);
  }
}
