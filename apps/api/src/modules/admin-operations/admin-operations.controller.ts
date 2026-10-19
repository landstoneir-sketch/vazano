import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { AdminActionDto } from './admin-action.dto';
import { AdminOperationsService } from './admin-operations.service';
import { UpdateUserStatusDto } from './update-user-status.dto';
import { UpdateGlobalRolesDto } from './update-global-roles.dto';

@Controller('admin/operations')
@UseGuards(SessionGuard)
export class AdminOperationsController {
  constructor(private readonly operations: AdminOperationsService) {}

  @Get('users')
  listUsers(@CurrentUser() user: AuthenticatedUser, @Query('query') query?: string) {
    return this.operations.listUsers(user, query);
  }

  @Put('users/:id/status')
  updateUserStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') targetUserId: string,
    @Body() input: UpdateUserStatusDto,
  ) {
    return this.operations.updateUserStatus(user, targetUserId, input);
  }

  @Get('global-role-options')
  listGlobalRoleOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.operations.listGlobalRoleOptions(user);
  }

  @Put('users/:id/global-roles')
  updateGlobalRoles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') targetUserId: string,
    @Body() input: UpdateGlobalRolesDto,
  ) {
    return this.operations.updateGlobalRoles(user, targetUserId, input);
  }

  @Post('users/:id/revoke-sessions')
  revokeUserSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') targetUserId: string,
    @Body() input: AdminActionDto,
  ) {
    return this.operations.revokeUserSessions(user, targetUserId, input.reason);
  }

  @Get('audit-logs')
  listAuditLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('before') before?: string,
  ) {
    return this.operations.listAuditLogs(user, { limit, action, entityType, before });
  }

  @Get('security-events')
  listSecurityEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query('severity') severity?: string,
    @Query('resolved') resolved?: string,
  ) {
    return this.operations.listSecurityEvents(user, { severity, resolved });
  }

  @Put('security-events/:id/resolve')
  resolveSecurityEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Body() input: AdminActionDto,
  ) {
    return this.operations.resolveSecurityEvent(user, eventId, input.reason);
  }
}
