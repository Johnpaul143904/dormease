import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { createClerkClient } from '@clerk/backend';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { CLERK_CLIENT } from './clerk-client.token';
import { ClerkIdentityService } from './clerk-identity.service';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRoot([{ limit: 5, ttl: 15 * 60 * 1000 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: CLERK_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createClerkClient({
          secretKey: configService.getOrThrow<string>('CLERK_SECRET_KEY'),
          publishableKey: configService.getOrThrow<string>(
            'CLERK_PUBLISHABLE_KEY',
          ),
        }),
    },
    ClerkIdentityService,
    ClerkAuthGuard,
    RolesGuard,
  ],
  exports: [ClerkIdentityService, ClerkAuthGuard, RolesGuard],
})
export class AuthModule {}
