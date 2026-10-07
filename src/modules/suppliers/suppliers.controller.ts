import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { SuppliersService } from './suppliers.service';
import { UpsertSupplierProfileDto } from './upsert-supplier-profile.dto';
import { VerifySupplierDto } from './verify-supplier.dto';

@Controller('suppliers')
@UseGuards(SessionGuard)
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get('admin/verification-queue')
  listVerificationQueue(@CurrentUser() user: AuthenticatedUser) {
    return this.suppliers.listVerificationQueue(user);
  }

  @Get('organizations/:organizationId/profile')
  getProfile(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string) {
    return this.suppliers.getProfile(user, organizationId);
  }

  @Put('organizations/:organizationId/profile')
  upsertProfile(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string, @Body() input: UpsertSupplierProfileDto) {
    return this.suppliers.upsertProfile(user, organizationId, input);
  }

  @Put('organizations/:organizationId/verification')
  verify(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string, @Body() input: VerifySupplierDto) {
    return this.suppliers.verify(user, organizationId, input);
  }
}
