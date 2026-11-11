import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { JwtStrategy } from './jwt.strategy';
import { PasswordResetEmailService } from './password-reset-email.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ||
            '15m') as SignOptions['expiresIn'],
        },
      }),
    }),
    PassportModule,
    ThrottlerModule.forRoot([{ limit: 5, ttl: 15 * 60 * 1000 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordResetEmailService,
    JwtAuthGuard,
    RolesGuard,
    JwtStrategy,
  ],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
