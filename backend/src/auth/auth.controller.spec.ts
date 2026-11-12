import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

describe('AuthController', () => {
  const authService = {
    provisionUser: jest.fn(),
    profile: jest.fn(),
    updateProfile: jest.fn(),
  };
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(authService as unknown as AuthService);
  });

  it('provisions an authenticated Clerk identity', async () => {
    const request = { clerkUserId: 'user_clerk_123' };
    const dto: RegisterDto = {};
    authService.provisionUser.mockResolvedValue({ user: { id: 10 } });

    await expect(controller.register(request as never, dto)).resolves.toEqual({
      user: { id: 10 },
    });
    expect(authService.provisionUser).toHaveBeenCalledWith(
      'user_clerk_123',
      dto,
    );
  });

  it('does not provision without a Clerk session', () => {
    expect(() => controller.register({} as never, {})).toThrow(
      UnauthorizedException,
    );
    expect(authService.provisionUser).not.toHaveBeenCalled();
  });
});
