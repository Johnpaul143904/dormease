import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ALLOW_UNLINKED_CLERK_USER_KEY } from './allow-unlinked-clerk-user.decorator';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { ClerkIdentityService } from './clerk-identity.service';
import { IS_PUBLIC_KEY } from './public.decorator';

describe('ClerkAuthGuard', () => {
  const request = {
    headers: {
      authorization: 'Bearer clerk-session-token',
      cookie: 'dormease_access_token=must-not-be-used',
      origin: 'https://dormease.example',
    },
    method: 'GET',
    originalUrl: '/api/rooms',
    url: '/api/rooms',
  };
  const clerkIdentity = { authenticateRequest: jest.fn() };
  const prisma = { user: { findUnique: jest.fn() } };
  const reflector = { getAllAndOverride: jest.fn() };
  let guard: ClerkAuthGuard;
  let context: {
    getHandler: jest.Mock;
    getClass: jest.Mock;
    switchToHttp: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    request.headers.authorization = 'Bearer clerk-session-token';
    reflector.getAllAndOverride.mockImplementation(
      (key: string) => key === IS_PUBLIC_KEY && false,
    );
    clerkIdentity.authenticateRequest.mockResolvedValue('user_clerk_123');
    prisma.user.findUnique.mockResolvedValue({
      id: 42,
      role: UserRole.TENANT,
    });
    context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    };
    guard = new ClerkAuthGuard(
      reflector as unknown as Reflector,
      prisma as unknown as PrismaService,
      clerkIdentity as unknown as ClerkIdentityService,
    );
  });

  it('maps Clerk identity to database ID and role, excluding cookies from verification', async () => {
    const canActivate = await guard.canActivate(context as never);

    expect(canActivate).toBe(true);
    expect(clerkIdentity.authenticateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          get: expect.any(Function),
        }),
      }),
    );
    const bearerRequest = clerkIdentity.authenticateRequest.mock
      .calls[0][0] as Request;
    expect(bearerRequest.headers.get('authorization')).toBe(
      'Bearer clerk-session-token',
    );
    expect(bearerRequest.headers.get('cookie')).toBeNull();
    expect(new URL(bearerRequest.url).origin).toBe('https://dormease.example');
    expect(request).toMatchObject({
      clerkUserId: 'user_clerk_123',
      user: {
        sub: 42,
        role: UserRole.TENANT,
        clerkUserId: 'user_clerk_123',
      },
    });
  });

  it('rejects a Clerk identity that has not been linked to a DormEase user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows an authenticated unlinked Clerk user only on the registration route', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    reflector.getAllAndOverride.mockImplementation(
      (key: string) => key === ALLOW_UNLINKED_CLERK_USER_KEY,
    );

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(request).toMatchObject({ clerkUserId: 'user_clerk_123' });
  });

  it('does not authenticate public routes', async () => {
    reflector.getAllAndOverride.mockImplementation(
      (key: string) => key === IS_PUBLIC_KEY,
    );

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(clerkIdentity.authenticateRequest).not.toHaveBeenCalled();
  });

  it('rejects cookie-only authentication', async () => {
    request.headers.authorization = '';

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(clerkIdentity.authenticateRequest).not.toHaveBeenCalled();
  });
});
