import { Controller, Get, Param } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

@Controller('public/suppliers')
export class PublicSuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list() {
    return this.suppliers.listPublicProfiles();
  }

  @Get(':organizationId')
  get(@Param('organizationId') organizationId: string) {
    return this.suppliers.getPublicProfile(organizationId);
  }
}
