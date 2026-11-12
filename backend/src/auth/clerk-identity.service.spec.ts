import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClerkBackendClient } from './clerk-client.token';
import { ClerkIdentityService } from './clerk-identity.service';

describe('ClerkIdentityService', () => {
  const clerkClient = {
    authenticateRequest: jest.fn(),
    users: { getUser: jest.fn() },
  };
  const configService = {
    get: jest.fn((key: string) =>
      key === 'CLERK_AUTHORIZED_PARTIES'
        ? 'https://dormease.example, https://admin.dormease.example/'
        : undefined,
    ),
  };
  let service: ClerkIdentityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClerkIdentityService(
      clerkClient as unknown as ClerkBackendClient,
      configService as unknown as ConfigService,
    );
  });

  it('accepts only authenticated Clerk session tokens from configured parties', async () => {
    clerkClient.authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({ isAuthenticated: true, userId: 'user_clerk_123' }),
    });

    await expect(
      service.authenticateRequest(new Request('https://api.example/rooms')),
    ).resolves.toBe('user_clerk_123');
    expect(clerkClient.authenticateRequest).toHaveBeenCalledWith(
      expect.any(Request),
      {
        acceptsToken: 'session_token',
        authorizedParties: [
          'https://dormease.example',
          'https://admin.dormease.example',
        ],
      },
    );
  });

  it('rejects invalid or expired Clerk sessions', async () => {
    clerkClient.authenticateRequest.mockResolvedValue({
      isAuthenticated: false,
    });

    await expect(
      service.authenticateRequest(new Request('https://api.example/rooms')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('requires an active Clerk account and a verified primary email', async () => {
    clerkClient.users.getUser.mockResolvedValue({
      id: 'user_clerk_123',
      banned: false,
      locked: false,
      deprovisioned: false,
      firstName: 'Dorm',
      lastName: 'Tenant',
      primaryEmailAddress: {
        emailAddress: 'TENANT@example.com',
        verification: { status: 'verified' },
      },
    });

    await expect(
      service.getVerifiedIdentity('user_clerk_123'),
    ).resolves.toEqual({
      clerkUserId: 'user_clerk_123',
      email: 'tenant@example.com',
      fullName: 'Dorm Tenant',
    });

    clerkClient.users.getUser.mockResolvedValue({
      id: 'user_clerk_123',
      banned: false,
      locked: false,
      deprovisioned: false,
      primaryEmailAddress: {
        emailAddress: 'tenant@example.com',
        verification: { status: 'unverified' },
      },
    });
    await expect(
      service.getVerifiedIdentity('user_clerk_123'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
