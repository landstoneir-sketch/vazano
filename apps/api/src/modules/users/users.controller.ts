import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SessionGuard } from '../auth/session.guard';
import { UpdateProfileDto } from './update-profile.dto';
import { UsersService } from './users.service';

@Controller('users') @UseGuards(SessionGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get('me') me(@CurrentUser() user: AuthenticatedUser) { return this.users.findById(user.id); }
  @Patch('me') update(@CurrentUser() user: AuthenticatedUser, @Body() input: UpdateProfileDto) { return this.users.update(user.id, input); }
}
