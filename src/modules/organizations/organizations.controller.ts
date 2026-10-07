import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { CreateOrganizationDto } from './create-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations') @UseGuards(SessionGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}
  @Get('mine') list(@CurrentUser() user: AuthenticatedUser) { return this.organizations.listForUser(user.id); }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateOrganizationDto) { return this.organizations.create(user.id, input); }
}
