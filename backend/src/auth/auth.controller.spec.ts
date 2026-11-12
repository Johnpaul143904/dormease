import {
  Controller,
  Get,
  INestApplication,
  Req,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard, PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import type { Response } from 'express';

const TEST_JWT_SECRET = 'test-secret-for-auth-controller-specs';

@Controller('protected-test')
class ProtectedTestController {
  @Get()
  @UseGuards(AuthGuard('jwt'))
  get(@Req() req: { user: { sub: number } }) {
    return { userId: req.user.sub };
  }
}

describe('AuthController', () => {
  let controller: AuthController;
  const session = {
    accessToken: 'signed-test-token',
    accessTokenExpiresAt: Date.now() + 15 * 60 * 1000,
    user: {
      id: 21,
      fullName: 'Dorm Admin',
      email: 'user@example.com',
      role: 'ADMIN',
    },
  };
  const authService = {
    isProduction: jest.fn().mockReturnValue(false),
    login: jest.fn().mockResolvedValue(session),
    logout: jest.fn().mockResolvedValue({ success: true }),
    forgotPassword: jest
      .fn()
      .mockResolvedValue({ message: 'Generic password recovery message.' }),
    resetPassword: jest
      .fn()
      .mockResolvedValue({ message: 'Password reset successfully.' }),
  };

  beforeEach(async () => {
    authService.isProduction.mockClear().mockReturnValue(false);
    authService.login.mockClear().mockResolvedValue(session);
    authService.forgotPassword
      .mockClear()
      .mockResolvedValue({ message: 'Generic password recovery message.' });
    authService.resetPassword
      .mockClear()
      .mockResolvedValue({ message: 'Password reset successfully.' });
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ limit: 5, ttl: 60_000 }])],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('sets the JWT in an HTTP-only cookie and returns the user', async () => {
    const response = { cookie: jest.fn() };

    await expect(
      controller.login(
        { email: 'user@example.com', password: 'password' },
        response as unknown as Response,
      ),
    ).resolves.toEqual({ user: session.user });

    expect(response.cookie).toHaveBeenCalledWith(
      'dormease_access_token',
      session.accessToken,
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: expect.any(Number),
      }),
    );
  });

  it('sets the secure cookie flag in production', async () => {
    authService.isProduction.mockReturnValue(true);
    const response = { cookie: jest.fn() };

    await controller.login(
      { email: 'user@example.com', password: 'password' },
      response as unknown as Response,
    );

    expect(response.cookie).toHaveBeenCalledWith(
      'dormease_access_token',
      session.accessToken,
      expect.objectContaining({ secure: true, sameSite: 'lax' }),
    );
  });

  it('clears the session cookie with matching cookie attributes', async () => {
    const response = { clearCookie: jest.fn() };

    await controller.logout(response as unknown as Response);

    expect(response.clearCookie).toHaveBeenCalledWith(
      'dormease_access_token',
      {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
      },
    );
  });

  it('delegates public password recovery requests to the auth service', async () => {
    await expect(
      controller.forgotPassword({ email: 'user@example.com' }),
    ).resolves.toEqual({ message: 'Generic password recovery message.' });
    await expect(
      controller.resetPassword({
        token: 'a'.repeat(64),
        newPassword: 'new-password-123!',
      }),
    ).resolves.toEqual({ message: 'Password reset successfully.' });
    expect(authService.forgotPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
    });
    expect(authService.resetPassword).toHaveBeenCalledWith({
      token: 'a'.repeat(64),
      newPassword: 'new-password-123!',
    });
  });

  it('limits password recovery requests by client IP', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ limit: 5, ttl: 60_000 }])],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();
    const app: INestApplication = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(app.getHttpServer())
          .post('/auth/forgot-password')
          .send({ email: 'user@example.com' })
          .expect(201);
      }

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'user@example.com' })
        .expect(429);
    } finally {
      await app.close();
    }
  });

  it('limits login requests by client IP', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ limit: 5, ttl: 60_000 }])],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();
    const app: INestApplication = module.createNestApplication();
    await app.init();

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'user@example.com', password: 'password' })
          .expect(201);
      }

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'password' })
        .expect(429);
    } finally {
      await app.close();
    }
  });

  it('allows a valid access token to reach a protected API route', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [ProtectedTestController],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => TEST_JWT_SECRET },
        },
      ],
    }).compile();
    const app: INestApplication = module.createNestApplication();
    await app.init();

    try {
      const accessToken = await new JwtService({
        secret: TEST_JWT_SECRET,
      }).signAsync({
        sub: session.user.id,
        email: session.user.email,
        role: session.user.role,
      });

      await request(app.getHttpServer())
        .get('/protected-test')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect({ userId: session.user.id });
    } finally {
      await app.close();
    }
  });
});
