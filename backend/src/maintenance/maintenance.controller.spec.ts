import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { ROLES_KEY } from '../auth/roles.decorator';
import { UserRole } from '../generated/prisma/enums';

describe('MaintenanceController', () => {
  let controller: MaintenanceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaintenanceController],
      providers: [{ provide: MaintenanceService, useValue: {} }],
    }).compile();

    controller = module.get<MaintenanceController>(MaintenanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('limits public announcements to authenticated tenant roles', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.findPublicAnnouncements)).toEqual([
      UserRole.TENANT,
    ]);
  });

  it('limits review and progress endpoints to admin and staff roles', () => {
    const authorizedRoles = [UserRole.ADMIN, UserRole.STAFF];
    expect(Reflect.getMetadata(ROLES_KEY, controller.findAll)).toEqual(
      authorizedRoles,
    );
    expect(Reflect.getMetadata(ROLES_KEY, controller.approve)).toEqual(
      authorizedRoles,
    );
    expect(Reflect.getMetadata(ROLES_KEY, controller.reject)).toEqual(
      authorizedRoles,
    );
    expect(Reflect.getMetadata(ROLES_KEY, controller.update)).toEqual(
      authorizedRoles,
    );
  });

  it('exposes private requests only to the authenticated tenant endpoint', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.findForUser)).toEqual([
      UserRole.TENANT,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, controller.createForUser)).toEqual([
      UserRole.TENANT,
    ]);
  });
});
