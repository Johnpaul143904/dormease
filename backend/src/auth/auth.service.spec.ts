import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RegistrationAccountType } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetEmailService } from './password-reset-email.service';

const TEST_JWT_SECRET = 'test-secret-for-auth-service-specs';
const SPECIAL_CHARACTER_PASSWORD = 'p@ssword! "quoted" #$%^&*()';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let resetEmailService: { send: jest.Mock };
  let transaction: jest.Mock;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    passwordResetToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      passwordResetToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(),
    };
    const tx = {
      user: prisma.user,
      passwordResetToken: prisma.passwordResetToken,
    };
    transaction = prisma.$transaction.mockImplementation(
      async (operation: (client: typeof tx) => Promise<unknown>) =>
        operation(tx),
    );
    resetEmailService = { send: jest.fn().mockResolvedValue(undefined) };
    jwtService = new JwtService({ secret: TEST_JWT_SECRET });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
            getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
          },
        },
        {
          provide: PasswordResetEmailService,
          useValue: resetEmailService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('authenticates case-insensitive email and preserves special password characters', async () => {
    const passwordHash = await bcrypt.hash(SPECIAL_CHARACTER_PASSWORD, 12);
    const user = {
      id: 21,
      fullName: 'Dorm Admin',
      email: 'user@example.com',
      password: passwordHash,
      role: 'ADMIN',
    };
    prisma.user.findFirst.mockResolvedValue(user);

    const session = await service.login({
      email: 'USER@EXAMPLE.COM',
      password: SPECIAL_CHARACTER_PASSWORD,
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'user@example.com', mode: 'insensitive' } },
    });
    expect(session.user).toEqual({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    });
    await expect(
      jwtService.verifyAsync(session.accessToken),
    ).resolves.toMatchObject({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects an incorrect password with 401', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 21,
      fullName: 'Dorm Admin',
      email: 'user@example.com',
      password: await bcrypt.hash('correct-password', 12),
      role: 'ADMIN',
    });

    await expect(
      service.login({ email: 'user@example.com', password: 'wrong-password' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a nonexistent email with 401', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.com', password: 'any-password' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('stores normalized email and a bcrypt cost-12 hash during registration', async () => {
    const createdUser = {
      id: 22,
      fullName: 'New Tenant',
      email: 'new@example.com',
      password: 'placeholder',
      role: 'TENANT',
    };
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(createdUser);

    await service.register({
      fullName: ' New Tenant ',
      email: 'NEW@EXAMPLE.COM',
      password: SPECIAL_CHARACTER_PASSWORD,
      accountType: RegistrationAccountType.TENANT,
    });

    const createCall = prisma.user.create.mock.calls[0][0];
    expect(createCall.data.email).toBe('new@example.com');
    expect(createCall.data.fullName).toBe('New Tenant');
    expect(await bcrypt.getRounds(createCall.data.password)).toBe(12);
    await expect(
      bcrypt.compare(SPECIAL_CHARACTER_PASSWORD, createCall.data.password),
    ).resolves.toBe(true);
    expect(createCall.data.tenant).toEqual({ create: {} });
  });

  it('sends an expiring reset link and returns a generic response for an existing account', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 21,
      fullName: 'Dorm Admin',
      email: 'user@example.com',
      password: 'stored-hash',
      role: 'ADMIN',
    });
    prisma.passwordResetToken.create.mockResolvedValue({ id: 42 });

    const response = await service.forgotPassword({
      email: ' USER@EXAMPLE.COM ',
    } satisfies ForgotPasswordDto);

    expect(response).toEqual({
      message:
        'If an account with that email exists, you will receive a password reset link shortly.',
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    const tokenData = prisma.passwordResetToken.create.mock.calls[0][0].data;
    expect(tokenData.userId).toBe(21);
    expect(tokenData.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenData.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(tokenData.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 20 * 60 * 1000,
    );
    const resetUrl = resetEmailService.send.mock.calls[0][2] as string;
    const token = new URL(resetUrl).searchParams.get('token');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenData.tokenHash).toBe(
      createHash('sha256').update(token!).digest('hex'),
    );
    expect(response.message).not.toContain(token);
  });

  it('returns the same generic response without sending mail for an unknown account', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    const response = await service.forgotPassword({
      email: 'missing@example.com',
    } satisfies ForgotPasswordDto);

    expect(response).toEqual({
      message:
        'If an account with that email exists, you will receive a password reset link shortly.',
    });
    expect(resetEmailService.send).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('resets the password once and allows login with only the new password', async () => {
    const token = 'a'.repeat(64);
    const now = new Date();
    const user = {
      id: 21,
      fullName: 'Dorm Admin',
      email: 'user@example.com',
      password: await bcrypt.hash('old-password', 12),
      role: 'ADMIN',
    };
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 42,
      userId: user.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(now.getTime() + 60_000),
      usedAt: null,
    });
    prisma.user.update.mockImplementation(
      async ({ data }: { data: { password: string } }) => {
        user.password = data.password;
        return user;
      },
    );
    prisma.user.findFirst.mockImplementation(async () => user);

    await expect(
      service.resetPassword({
        token,
        newPassword: 'new-password-123!',
      } satisfies ResetPasswordDto),
    ).resolves.toEqual({
      message: 'Password reset successfully. Please sign in.',
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { password: user.password },
    });
    expect(await bcrypt.compare('new-password-123!', user.password)).toBe(true);
    await expect(
      service.login({ email: user.email, password: 'new-password-123!' }),
    ).resolves.toMatchObject({ user: { id: user.id } });
    await expect(
      service.login({ email: user.email, password: 'old-password' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it.each([
    ['invalid', null],
    [
      'expired',
      {
        id: 42,
        userId: 21,
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() - 1),
        usedAt: null,
      },
    ],
    [
      'already used',
      {
        id: 42,
        userId: 21,
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
      },
    ],
  ])('rejects an %s reset token', async (_label, resetToken) => {
    prisma.passwordResetToken.findUnique.mockResolvedValue(resetToken);

    await expect(
      service.resetPassword({
        token: 'b'.repeat(64),
        newPassword: 'new-password-123!',
      } satisfies ResetPasswordDto),
    ).rejects.toMatchObject({ status: 401 });
    expect(transaction).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('invalidates the active reset token if mail delivery fails without exposing account state', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 21,
      fullName: 'Dorm Admin',
      email: 'user@example.com',
      password: 'stored-hash',
      role: 'ADMIN',
    });
    resetEmailService.send.mockRejectedValue(new Error('private mail error'));

    await expect(
      service.forgotPassword({ email: 'user@example.com' }),
    ).resolves.toEqual({
      message:
        'If an account with that email exists, you will receive a password reset link shortly.',
    });
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ usedAt: null }),
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      }),
    );
  });
});
