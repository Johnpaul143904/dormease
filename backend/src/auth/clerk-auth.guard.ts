import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ALLOW_UNLINKED_CLERK_USER_KEY } from './allow-unlinked-clerk-user.decorator';
import { AuthenticatedRequest } from './authenticated-request.type';
import { ClerkIdentityService } from './clerk-identity.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly clerkIdentityService: ClerkIdentityService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      targets,
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const clerkUserId = await this.clerkIdentityService.authenticateRequest(
      this.createBearerRequest(request),
    );
    request.clerkUserId = clerkUserId;
    const clerkIdentity = await this.prisma.clerkIdentity.findUnique({
      where: { clerkUserId },
      select: { deletedAt: true },
    });
    if (clerkIdentity?.deletedAt) {
      throw new UnauthorizedException('Clerk account has been deleted');
    }

    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true, role: true },
    });

    if (!user) {
      const allowsUnlinkedUser = this.reflector.getAllAndOverride<boolean>(
        ALLOW_UNLINKED_CLERK_USER_KEY,
        targets,
      );
      if (allowsUnlinkedUser) return true;
      throw new UnauthorizedException('DormEase account is not linked');
    }

    request.user = {
      sub: user.id,
      role: user.role,
      clerkUserId,
    };
    return true;
  }

  private createBearerRequest(request: Request) {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') {
        headers.set(name, value);
      } else if (Array.isArray(value)) {
        headers.set(name, value.join(', '));
      }
    }
    headers.delete('cookie');

    const authorization = headers.get('authorization');
    if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
      throw new UnauthorizedException('A Clerk Bearer token is required');
    }

    const origin =
      headers.get('origin') ??
      `${headers.get('x-forwarded-proto')?.split(',')[0].trim() || 'https'}://${
        headers.get('x-forwarded-host')?.split(',')[0].trim() ??
        headers.get('host') ??
        'dormease-api.invalid'
      }`;
    let url: URL;
    try {
      url = new URL(request.originalUrl || request.url, origin);
    } catch {
      throw new UnauthorizedException('Invalid request origin');
    }
    return new Request(url, { method: request.method, headers });
  }
}
