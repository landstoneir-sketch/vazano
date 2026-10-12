import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SessionGuard, type AuthenticatedRequest } from './session.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('otp/request') @HttpCode(200)
  requestOtp(@Body() input: RequestOtpDto, @Req() request: Request) {
    return this.auth.requestOtp(input.mobile, input.purpose, request.ip, request.headers['user-agent']);
  }

  @Post('otp/verify') @HttpCode(200)
  async verifyOtp(@Body() input: VerifyOtpDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.verifyOtp(input.mobile, input.purpose, input.code, request.ip, request.headers['user-agent']);
    response.cookie('vazano_session', result.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: result.expiresAt, path: '/' });
    return { user: result.user, isNewUser: result.isNewUser, expiresAt: result.expiresAt };
  }

  @Get('me') @UseGuards(SessionGuard)
  me(@CurrentUser() user: AuthenticatedUser) { return user; }

  @Get('sessions') @UseGuards(SessionGuard)
  listSessions(@CurrentUser() user: AuthenticatedUser, @Req() request: AuthenticatedRequest) {
    return this.auth.listSessions(user.id, request.sessionToken);
  }

  @Delete('sessions/:sessionId') @UseGuards(SessionGuard)
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.revokeSession(user.id, sessionId, request.sessionToken);
    if (result.isCurrent) response.clearCookie('vazano_session', { path: '/' });
    return result;
  }

  @Post('logout') @HttpCode(204) @UseGuards(SessionGuard)
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(request.sessionToken);
    response.clearCookie('vazano_session', { path: '/' });
  }
}
