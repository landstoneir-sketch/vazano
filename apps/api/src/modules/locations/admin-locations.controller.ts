import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { AdminLocationsService } from './admin-locations.service';
import { CreateCityDto } from './create-city.dto';
import { CreateProvinceDto } from './create-province.dto';
import { UpdateCityDto } from './update-city.dto';
import { UpdateProvinceDto } from './update-province.dto';

@Controller('admin/locations')
@UseGuards(SessionGuard)
export class AdminLocationsController {
  constructor(private readonly locations: AdminLocationsService) {}

  @Get('provinces')
  listProvinces(@CurrentUser() user: AuthenticatedUser) { return this.locations.listProvinces(user); }

  @Post('provinces')
  createProvince(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateProvinceDto) { return this.locations.createProvince(user, input); }

  @Put('provinces/:provinceId')
  updateProvince(@CurrentUser() user: AuthenticatedUser, @Param('provinceId') provinceId: string, @Body() input: UpdateProvinceDto) { return this.locations.updateProvince(user, provinceId, input); }

  @Get('cities')
  listCities(@CurrentUser() user: AuthenticatedUser, @Query('provinceId') provinceId?: string) { return this.locations.listCities(user, provinceId); }

  @Post('cities')
  createCity(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateCityDto) { return this.locations.createCity(user, input); }

  @Put('cities/:cityId')
  updateCity(@CurrentUser() user: AuthenticatedUser, @Param('cityId') cityId: string, @Body() input: UpdateCityDto) { return this.locations.updateCity(user, cityId, input); }
}
