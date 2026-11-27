import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkIdentityService } from './clerk-identity.service';
import { AuthService } from './auth.service';
import { RegistrationAccountType } from './dto/register.dto';

describe('AuthService', () => {
  let service: AuthService;
  const identity = {
    clerkUserId: 'user_clerk_123',
    email: 'tenant@example.com',
    fullName: 'New Tenant',
  };
  const tx = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    tenant: { create: jest.fn(), update: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  };
  const clerkIdentity = {
    getVerifiedIdentity: jest.fn(),
  };
  const configService = {
    get: jest.fn().mockReturnValue('valid-admin-invite'),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );
    clerkIdentity.getVerifiedIdentity.mockResolvedValue(identity);
    configService.get.mockReturnValue('valid-admin-invite');
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.findMany.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
        { provide: ClerkIdentityService, useValue: clerkIdentity },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  it('links an existing account by verified email without changing its role or password', async () => {
    const existing = {
      id: 5,
      fullName: 'Existing Tenant',
      email: identity.email,
      role: UserRole.TENANT,
      clerkUserId: null,
      tenant: { userId: 5 },
    };
    const linked = {
      id: 5,
      fullName: 'Existing Tenant',
      email: identity.email,
      role: UserRole.TENANT,
    };
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.findMany.mockResolvedValue([existing]);
    tx.user.update.mockResolvedValue(linked);

    await expect(
      service.provisionUser(identity.clerkUserId, {}),
    ).resolves.toEqual({
      user: linked,
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: { clerkUserId: identity.clerkUserId },
      select: expect.any(Object),
    });
    expect(tx.tenant.create).not.toHaveBeenCalled();
  });

  it('creates a Clerk-backed tenant without a local password', async () => {
    const created = {
      id: 8,
      fullName: identity.fullName,
      email: identity.email,
      role: UserRole.TENANT,
    };
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.findMany.mockResolvedValue([]);
    tx.user.create.mockResolvedValue(created);

    await expect(
      service.provisionUser(identity.clerkUserId, {}),
    ).resolves.toEqual({
      user: created,
    });
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: identity.email,
          password: null,
          clerkUserId: identity.clerkUserId,
          role: UserRole.TENANT,
          tenant: { create: {} },
        }),
      }),
    );
  });

  it.each([
    ['email/password', 'user_email_123', 'email@example.com'],
    ['Google', 'user_google_123', 'google@example.com'],
  ])(
    'provisions a new %s account from the verified Clerk identity',
    async (_provider, clerkUserId, email) => {
      const verifiedIdentity = {
        clerkUserId,
        email,
        fullName: 'New Tenant',
      };
      const created = {
        id: 11,
        fullName: verifiedIdentity.fullName,
        email,
        role: UserRole.TENANT,
      };
      clerkIdentity.getVerifiedIdentity.mockResolvedValue(verifiedIdentity);
      tx.user.findUnique.mockResolvedValue(null);
      tx.user.findMany.mockResolvedValue([]);
      tx.user.create.mockResolvedValue(created);

      await expect(service.provisionUser(clerkUserId, {})).resolves.toEqual({
        user: created,
      });
      expect(clerkIdentity.getVerifiedIdentity).toHaveBeenCalledWith(
        clerkUserId,
      );
      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ clerkUserId, email }),
        }),
      );
    },
  );

  it('returns the existing account for a repeated request from the same Clerk identity', async () => {
    const linked = {
      id: 12,
      fullName: 'Existing Tenant',
      email: identity.email,
      role: UserRole.TENANT,
    };
    tx.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(linked);
    tx.user.findMany.mockResolvedValue([]);
    tx.user.create.mockResolvedValue(linked);

    await expect(
      service.provisionUser(identity.clerkUserId, {}),
    ).resolves.toEqual({ user: linked });
    await expect(
      service.provisionUser(identity.clerkUserId, {}),
    ).resolves.toEqual({ user: linked });
    expect(tx.user.create).toHaveBeenCalledTimes(1);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('restores a concurrent duplicate after the Clerk ID unique constraint wins', async () => {
    const linked = {
      id: 13,
      fullName: 'Existing Tenant',
      email: identity.email,
      role: UserRole.TENANT,
    };
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.findMany.mockResolvedValue([]);
    tx.user.create.mockRejectedValue({ code: 'P2002' });
    prisma.user.findUnique.mockResolvedValue(linked);

    await expect(
      service.provisionUser(identity.clerkUserId, {}),
    ).resolves.toEqual({ user: linked });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: identity.clerkUserId },
      select: expect.any(Object),
    });
  });

  it('does not replace a stale Clerk identity based only on matching email', async () => {
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.findMany.mockResolvedValue([
      {
        id: 14,
        fullName: 'Existing Tenant',
        email: identity.email,
        role: UserRole.TENANT,
        clerkUserId: 'user_old_clerk_identity',
        tenant: { userId: 14 },
      },
    ]);

    await expect(
      service.provisionUser(identity.clerkUserId, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('requires a valid invitation code before creating an admin account', async () => {
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.findMany.mockResolvedValue([]);

    await expect(
      service.provisionUser(identity.clerkUserId, {
        accountType: RegistrationAccountType.ADMIN,
        invitationCode: 'wrong-code',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.create).not.toHaveBeenCalled();

    tx.user.create.mockResolvedValue({
      id: 9,
      fullName: identity.fullName,
      email: identity.email,
      role: UserRole.ADMIN,
    });
    await service.provisionUser(identity.clerkUserId, {
      accountType: RegistrationAccountType.ADMIN,
      invitationCode: 'valid-admin-invite',
    });
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: UserRole.ADMIN }),
      }),
    );
  });

  it('requires the new primary email to be verified by Clerk before syncing it', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 5,
      email: 'old@example.com',
      tenant: null,
    });
    clerkIdentity.getVerifiedIdentity.mockResolvedValue({
      ...identity,
      email: 'verified@example.com',
    });

    await expect(
      service.updateProfile(5, identity.clerkUserId, {
        email: 'not-verified@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
