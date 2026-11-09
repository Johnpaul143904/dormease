import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  const maintenanceRequest = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  };
  const tenant = { findUnique: jest.fn() };
  const maintenanceStatusHistory = { create: jest.fn() };
  const tx = {
    maintenanceRequest,
    tenant,
    maintenanceStatusHistory,
  };
  const prisma = {
    maintenanceRequest,
    tenant,
    maintenanceStatusHistory,
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<MaintenanceService>(MaintenanceService);
  });

  it('scopes a tenant request list to the authenticated user', async () => {
    maintenanceRequest.findMany.mockResolvedValue([]);

    await service.findForUser(41);

    expect(maintenanceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant: { userId: 41 } },
      }),
    );
  });

  it('lets administrators review all requests with private submitter details and history', async () => {
    maintenanceRequest.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(maintenanceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          tenant: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
          statusHistory: expect.objectContaining({
            include: { changedBy: { select: { fullName: true } } },
          }),
        }),
      }),
    );
  });

  it('queries public announcements without selecting private submitter or room data', async () => {
    maintenanceRequest.findMany.mockResolvedValue([]);

    await service.findPublicAnnouncements();

    const query = maintenanceRequest.findMany.mock.calls[0][0];
    expect(query.where.isPublic).toBe(true);
    expect(query.where.status.in).toEqual([
      MaintenanceStatus.APPROVED,
      MaintenanceStatus.IN_PROGRESS,
      MaintenanceStatus.RESOLVED,
    ]);
    expect(query.select).not.toHaveProperty('tenant');
    expect(query.select).not.toHaveProperty('room');
    expect(query.select).not.toHaveProperty('tenantId');
    expect(query.select).not.toHaveProperty('roomId');
    expect(query.select.statusHistory.select).toEqual({
      status: true,
      createdAt: true,
    });
  });

  it('creates a private pending request using only the authenticated tenant and active room', async () => {
    tenant.findUnique.mockResolvedValue({
      id: 8,
      assignments: [{ roomId: 3 }],
    });
    maintenanceRequest.create.mockResolvedValue({
      id: 12,
      tenantId: 8,
      roomId: 3,
      status: MaintenanceStatus.PENDING,
    });
    maintenanceStatusHistory.create.mockResolvedValue({});

    await service.createForUser(41, {
      title: 'Leaking tap',
      description: 'The sink tap is leaking',
      priority: 'HIGH',
    });

    expect(tenant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 41 } }),
    );
    expect(maintenanceRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 8,
        roomId: 3,
        title: 'Leaking tap',
      }),
    });
    expect(maintenanceStatusHistory.create).toHaveBeenCalledWith({
      data: {
        maintenanceRequestId: 12,
        status: MaintenanceStatus.PENDING,
      },
    });
  });

  it('does not allow a tenant without a profile or active assignment to submit a request', async () => {
    tenant.findUnique.mockResolvedValue(null);
    await expect(
      service.createForUser(41, {
        title: 'Broken light',
        description: 'The hallway light is broken',
        priority: 'MEDIUM',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    tenant.findUnique.mockResolvedValue({ id: 8, assignments: [] });
    await expect(
      service.createForUser(41, {
        title: 'Broken light',
        description: 'The hallway light is broken',
        priority: 'MEDIUM',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('approves only pending requests and records a status history entry', async () => {
    maintenanceRequest.findUnique.mockResolvedValue({
      id: 12,
      status: MaintenanceStatus.PENDING,
    });
    maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
    maintenanceStatusHistory.create.mockResolvedValue({});
    maintenanceRequest.findUniqueOrThrow.mockResolvedValue({
      id: 12,
      status: MaintenanceStatus.APPROVED,
    });

    await service.approve(12, 9, {
      announcementTitle: 'Hallway repairs',
      announcementDescription: 'Repair work is scheduled.',
      publicLocation: 'Main hallway',
    });

    expect(maintenanceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 12, status: MaintenanceStatus.PENDING },
      data: {
        status: MaintenanceStatus.APPROVED,
        isPublic: true,
        announcementTitle: 'Hallway repairs',
        announcementDescription: 'Repair work is scheduled.',
        publicLocation: 'Main hallway',
      },
    });
    expect(maintenanceStatusHistory.create).toHaveBeenCalledWith({
      data: {
        maintenanceRequestId: 12,
        status: MaintenanceStatus.APPROVED,
        changedById: 9,
      },
    });
  });

  it('rejects approval of any request that is not pending', async () => {
    maintenanceRequest.findUnique.mockResolvedValue({
      id: 12,
      status: MaintenanceStatus.REJECTED,
    });

    await expect(service.approve(12, 9, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(maintenanceRequest.updateMany).not.toHaveBeenCalled();
  });

  it('rejects only pending requests and keeps rejection notes private', async () => {
    maintenanceRequest.updateMany.mockResolvedValue({ count: 1 });
    maintenanceStatusHistory.create.mockResolvedValue({});
    maintenanceRequest.findUniqueOrThrow.mockResolvedValue({
      id: 12,
      status: MaintenanceStatus.REJECTED,
    });

    await service.reject(12, 9, { note: 'Duplicate request' });

    expect(maintenanceStatusHistory.create).toHaveBeenCalledWith({
      data: {
        maintenanceRequestId: 12,
        status: MaintenanceStatus.REJECTED,
        note: 'Duplicate request',
        changedById: 9,
      },
    });
  });

  it('restricts progress status updates to approved announcements', async () => {
    maintenanceRequest.findUnique.mockResolvedValue({
      id: 12,
      status: MaintenanceStatus.PENDING,
      isPublic: false,
    });

    await expect(
      service.update(12, 9, { status: MaintenanceStatus.IN_PROGRESS }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(maintenanceRequest.update).not.toHaveBeenCalled();
  });

  it('updates status history when a published request advances', async () => {
    maintenanceRequest.findUnique.mockResolvedValue({
      id: 12,
      status: MaintenanceStatus.APPROVED,
      isPublic: true,
    });
    maintenanceRequest.update.mockResolvedValue({
      id: 12,
      status: MaintenanceStatus.IN_PROGRESS,
    });
    maintenanceStatusHistory.create.mockResolvedValue({});
    maintenanceRequest.findUniqueOrThrow.mockResolvedValue({
      id: 12,
      status: MaintenanceStatus.IN_PROGRESS,
    });

    await service.update(12, 9, { status: MaintenanceStatus.IN_PROGRESS });

    expect(maintenanceRequest.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { status: MaintenanceStatus.IN_PROGRESS },
    });
    expect(maintenanceStatusHistory.create).toHaveBeenCalledWith({
      data: {
        maintenanceRequestId: 12,
        status: MaintenanceStatus.IN_PROGRESS,
        changedById: 9,
      },
    });
  });
});
