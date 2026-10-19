import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicSupplierSearchDto } from './public-supplier-search.dto';
import { SuppliersService } from './suppliers.service';

@Controller('public/suppliers')
export class PublicSuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list(@Query() query: PublicSupplierSearchDto) {
    return this.suppliers.listPublicProfiles(query);
  }

  @Get(':organizationId')
  get(@Param('organizationId') organizationId: string) {
    return this.suppliers.getPublicProfile(organizationId);
  }
}
