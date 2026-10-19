import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { CreateMessageThreadDto } from './create-message-thread.dto';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './send-message.dto';

@Controller('messages')
@UseGuards(SessionGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('threads')
  listThreads(@CurrentUser() user: AuthenticatedUser) {
    return this.messages.listThreads(user);
  }

  @Post('threads')
  createThread(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateMessageThreadDto) {
    return this.messages.createThread(user, input);
  }

  @Get('threads/:id/messages')
  listMessages(@CurrentUser() user: AuthenticatedUser, @Param('id') threadId: string) {
    return this.messages.listMessages(user, threadId);
  }

  @Post('threads/:id/messages')
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') threadId: string,
    @Body() input: SendMessageDto,
  ) {
    return this.messages.sendMessage(user, threadId, input);
  }

  @Put('threads/:id/read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') threadId: string) {
    return this.messages.markRead(user, threadId);
  }
}
