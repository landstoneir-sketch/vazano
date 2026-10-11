import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { CreateOrganizationDto } from './create-organization.dto';
import { InviteOrganizationMemberDto } from './invite-organization-member.dto';
import { OrganizationsService } from './organizations.service';
import { UpdateMemberRoleDto } from './update-member-role.dto';

@Controller('organizations') @UseGuards(SessionGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}
  @Get('mine') list(@CurrentUser() user: AuthenticatedUser) { return this.organizations.listForUser(user.id); }
  @Get('admin/buyer-options') listBuyerOptions(@CurrentUser() user: AuthenticatedUser) { return this.organizations.listBuyerOptions(user); }
  @Get('invitations/mine') listInvitations(@CurrentUser() user: AuthenticatedUser) { return this.organizations.listInvitations(user.id); }
  @Post('invitations/:membershipId/accept') acceptInvitation(@CurrentUser() user: AuthenticatedUser, @Param('membershipId') membershipId: string) { return this.organizations.respondToInvitation(user.id, membershipId, true); }
  @Post('invitations/:membershipId/reject') rejectInvitation(@CurrentUser() user: AuthenticatedUser, @Param('membershipId') membershipId: string) { return this.organizations.respondToInvitation(user.id, membershipId, false); }
  @Get(':organizationId/members') listMembers(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string) { return this.organizations.listMembers(user.id, organizationId); }
  @Post(':organizationId/members/invite') inviteMember(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string, @Body() input: InviteOrganizationMemberDto) { return this.organizations.inviteMember(user.id, organizationId, input); }
  @Put(':organizationId/members/:memberId/role') updateMemberRole(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string, @Param('memberId') memberId: string, @Body() input: UpdateMemberRoleDto) { return this.organizations.updateMemberRole(user.id, organizationId, memberId, input.role); }
  @Delete(':organizationId/members/:memberId') removeMember(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') organizationId: string, @Param('memberId') memberId: string) { return this.organizations.removeMember(user.id, organizationId, memberId); }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateOrganizationDto) { return this.organizations.create(user.id, input); }
}
