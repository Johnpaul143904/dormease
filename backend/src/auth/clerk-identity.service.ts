import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CLERK_CLIENT } from './clerk-client.token';
import type { ClerkBackendClient } from './clerk-client.token';

@Injectable()
export class ClerkIdentityService {
  private readonly authorizedParties: string[];

  constructor(
    @Inject(CLERK_CLIENT) private readonly clerkClient: ClerkBackendClient,
    configService: ConfigService,
  ) {
    const configuredParties =
      configService.get<string>('CLERK_AUTHORIZED_PARTIES') ??
      configService.get<string>('CORS_ORIGIN') ??
      'http://localhost:3000';
    this.authorizedParties = configuredParties
      .split(',')
      .map((party) => party.trim().replace(/\/+$/, ''))
      .map((party) => {
        try {
          return new URL(party).origin;
        } catch {
          return party;
        }
      })
      .filter(Boolean);

    if (!this.authorizedParties.length) {
      throw new Error('At least one Clerk authorized party must be configured');
    }
  }

  async authenticateRequest(request: Request) {
    const state = await this.clerkClient.authenticateRequest(request, {
      acceptsToken: 'session_token',
      authorizedParties: this.authorizedParties,
    });

    if (!state.isAuthenticated) {
      throw new UnauthorizedException('Invalid or expired Clerk session');
    }

    const auth = state.toAuth();
    if (!auth.isAuthenticated || !auth.userId) {
      throw new UnauthorizedException('Invalid or expired Clerk session');
    }

    return auth.userId;
  }

  async getVerifiedIdentity(clerkUserId: string) {
    const user = await this.clerkClient.users.getUser(clerkUserId);
    if (user.banned || user.locked || user.deprovisioned) {
      throw new UnauthorizedException('Clerk account is not active');
    }

    const primaryEmail = user.primaryEmailAddress;
    if (!primaryEmail || primaryEmail.verification?.status !== 'verified') {
      throw new ForbiddenException('A verified primary email is required');
    }

    const fullName = [user.firstName, user.lastName]
      .filter((name): name is string => Boolean(name?.trim()))
      .join(' ')
      .trim();

    return {
      clerkUserId: user.id,
      email: primaryEmail.emailAddress.trim().toLowerCase(),
      fullName,
    };
  }
}
