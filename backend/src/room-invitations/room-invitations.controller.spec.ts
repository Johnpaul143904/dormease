import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../generated/prisma/enums';
import { RolesGuard } from '../auth/roles.guard';
import { RoomInvitationsController } from './room-invitations.controller';

describe('RoomInvitationsController authorization', () => {
  const guard = new RolesGuard(new Reflector());

  function context(
    handler: Function,
    role: UserRole,
  ): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => RoomInvitationsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role } }),
      }),
    } as unknown as ExecutionContext;
  }

  it.each([
    ['approve', RoomInvitationsController.prototype.approve],
    ['reject', RoomInvitationsController.prototype.reject],
  ])('allows only ADMIN to %s room requests', (_name, handler) => {
    expect(guard.canActivate(context(handler, UserRole.ADMIN))).toBe(true);
    expect(() =>
      guard.canActivate(context(handler, UserRole.TENANT)),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(context(handler, UserRole.STAFF)),
    ).toThrow(ForbiddenException);
  });

  it('allows TENANT to submit a request but not decide it', () => {
    expect(
      guard.canActivate(
        context(
          RoomInvitationsController.prototype.requestToJoin,
          UserRole.TENANT,
        ),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        context(
          RoomInvitationsController.prototype.requestToJoin,
          UserRole.ADMIN,
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows TENANT to view their own requests and restricts that route from other roles', () => {
    const handler = RoomInvitationsController.prototype.findMine;
    expect(guard.canActivate(context(handler, UserRole.TENANT))).toBe(true);
    expect(() =>
      guard.canActivate(context(handler, UserRole.ADMIN)),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(context(handler, UserRole.STAFF)),
    ).toThrow(ForbiddenException);
  });
});
