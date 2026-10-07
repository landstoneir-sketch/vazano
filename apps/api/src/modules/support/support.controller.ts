import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { AddSupportCommentDto } from './add-support-comment.dto';
import { CreateSupportTicketDto } from './create-support-ticket.dto';
import { SupportService } from './support.service';
import { UpdateSupportTicketDto } from './update-support-ticket.dto';

@Controller('support/tickets')
@UseGuards(SessionGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.support.listMine(user);
  }

  @Get('admin/queue')
  listAdminQueue(@CurrentUser() user: AuthenticatedUser) {
    return this.support.listAdminQueue(user);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateSupportTicketDto) {
    return this.support.create(user, input);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') ticketId: string) {
    return this.support.getOne(user, ticketId);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') ticketId: string,
    @Body() input: AddSupportCommentDto,
  ) {
    return this.support.addComment(user, ticketId, input);
  }

  @Put('admin/:id')
  updateAsAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') ticketId: string,
    @Body() input: UpdateSupportTicketDto,
  ) {
    return this.support.updateAsAdmin(user, ticketId, input);
  }
}
