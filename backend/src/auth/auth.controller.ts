import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AllowUnlinkedClerkUser } from './allow-unlinked-clerk-user.decorator';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { AuthenticatedRequest } from './authenticated-request.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @AllowUnlinkedClerkUser()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  register(@Req() request: AuthenticatedRequest, @Body() dto: RegisterDto) {
    if (!request.clerkUserId) {
      throw new UnauthorizedException('A Clerk session is required');
    }
    return this.authService.provisionUser(request.clerkUserId, dto);
  }

  @Get('profile')
  profile(@Req() request: AuthenticatedRequest) {
    const user = this.requireUser(request);
    return this.authService.profile(user.sub);
  }

  @Patch('profile')
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = this.requireUser(request);
    return this.authService.updateProfile(user.sub, user.clerkUserId, dto);
  }

  private requireUser(request: AuthenticatedRequest) {
    if (!request.user) {
      throw new UnauthorizedException('DormEase account is not linked');
    }
    return request.user;
  }
}
