import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.register(dto);
    this.setSessionCookie(response, session);
    return { user: session.user };
  }

  @Post('login')
  @Public()
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.setSessionCookie(response, await this.authService.login(dto));
  }

  @Post('forgot-password')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('profile')
  profile(@Req() request: { user: { sub: number } }) {
    return this.authService.profile(request.user.sub);
  }

  @Patch('profile')
  updateProfile(
    @Req() request: { user: { sub: number } },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(request.user.sub, dto);
  }

  @Post('logout')
  @Public()
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('dormease_access_token', this.cookieOptions());
    return this.authService.logout();
  }

  private setSessionCookie(
    response: Response,
    session: { accessToken: string; user: unknown },
  ) {
    response.cookie('dormease_access_token', session.accessToken, {
      ...this.cookieOptions(),
      maxAge: 15 * 60 * 1000,
    });
    return { user: session.user };
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.authService.isProduction(),
      sameSite: this.authService.isProduction()
        ? ('none' as const)
        : ('lax' as const),
      path: '/',
    };
  }
}
