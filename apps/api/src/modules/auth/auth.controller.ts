import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
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
  requestOtp(@Body() input: RequestOtpDto) { return this.auth.requestOtp(input.mobile, input.purpose); }

  @Post('otp/verify') @HttpCode(200)
  async verifyOtp(@Body() input: VerifyOtpDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.verifyOtp(input.mobile, input.purpose, input.code, request.ip, request.headers['user-agent']);
    response.cookie('vazano_session', result.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: result.expiresAt, path: '/' });
    return { user: result.user, isNewUser: result.isNewUser, expiresAt: result.expiresAt };
  }

  @Get('me') @UseGuards(SessionGuard)
  me(@CurrentUser() user: AuthenticatedUser) { return user; }

  @Post('logout') @HttpCode(204) @UseGuards(SessionGuard)
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(request.sessionToken);
    response.clearCookie('vazano_session', { path: '/' });
  }
}
