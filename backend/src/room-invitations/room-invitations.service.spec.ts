import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RoomInvitationsService } from './room-invitations.service';

describe('RoomInvitationsService', () => {
  let service: RoomInvitationsService;
  const prismaMock = {
    roomInvitation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    roomAssignment: {
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    room: { findUnique: jest.fn(), update: jest.fn() },
    tenant: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
        callback(prismaMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomInvitationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<RoomInvitationsService>(RoomInvitationsService);
  });

  const makeInvitation = (
    status: string,
    expiresAt = new Date(Date.now() + 60_000),
  ) => ({
    id: 17,
    roomId: 3,
    tenantId: null as number | null,
    code: 'DE-SECURETOKEN',
    status,
    expiresAt,
    room: {
      id: 3,
      roomNumber: '101',
      building: 'A',
      floor: 1,
      roomType: 'SINGLE',
      capacity: 2,
      monthlyRent: 5000,
      description: null,
      status: 'AVAILABLE',
    },
  });

  it('returns only public invitation and room details for active invitations', async () => {
    prismaMock.roomInvitation.findUnique.mockResolvedValue(
      makeInvitation('ACTIVE'),
    );
    prismaMock.roomAssignment.count.mockResolvedValue(1);

    await expect(service.findByCode('de-securetoken')).resolves.toEqual({
      code: 'DE-SECURETOKEN',
      status: 'ACTIVE',
      expiresAt: expect.any(Date),
      room: {
        roomNumber: '101',
        building: 'A',
        floor: 1,
        roomType: 'SINGLE',
        capacity: 2,
        currentOccupants: 1,
        monthlyRent: 5000,
        description: null,
        status: 'AVAILABLE',
      },
    });
    expect(prismaMock.roomInvitation.findUnique).toHaveBeenCalledWith({
      where: { code: 'DE-SECURETOKEN' },
      include: { room: true },
    });
  });

  it('marks an expired active invitation as expired', async () => {
    prismaMock.roomInvitation.findUnique.mockResolvedValue(
      makeInvitation('ACTIVE', new Date(Date.now() - 60_000)),
    );
    prismaMock.roomInvitation.update.mockResolvedValue({});
    prismaMock.roomAssignment.count.mockResolvedValue(0);

    const invitation = await service.findByCode('DE-SECURETOKEN');

    expect(prismaMock.roomInvitation.update).toHaveBeenCalledWith({
      where: { id: 17 },
      data: { status: 'EXPIRED' },
    });
    expect(invitation.status).toBe('EXPIRED');
  });

  it.each(['PENDING', 'APPROVED', 'REVOKED', 'USED', 'REJECTED', 'EXPIRED'])(
    'preserves the %s status for public validation',
    async (status) => {
      prismaMock.roomInvitation.findUnique.mockResolvedValue(
        makeInvitation(status),
      );
      prismaMock.roomAssignment.count.mockResolvedValue(0);

      await expect(service.findByCode('DE-SECURETOKEN')).resolves.toMatchObject({
        status,
      });
      expect(prismaMock.roomInvitation.update).not.toHaveBeenCalled();
    },
  );

  it('rejects unknown invitation codes', async () => {
    prismaMock.roomInvitation.findUnique.mockResolvedValue(null);

    await expect(service.findByCode('INVALID')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prismaMock.roomAssignment.count).not.toHaveBeenCalled();
  });

  it('lists only invitations associated with the authenticated tenant', async () => {
    prismaMock.roomInvitation.findMany.mockResolvedValue([]);

    await expect(service.findForTenant(42)).resolves.toEqual([]);

    expect(prismaMock.roomInvitation.findMany).toHaveBeenCalledWith({
      where: { tenant: { is: { userId: 42 } } },
      include: { room: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('creates a pending request without assigning the tenant', async () => {
    const activeInvitation = makeInvitation('ACTIVE');
    const pendingInvitation = {
      ...activeInvitation,
      tenantId: 9,
      status: 'PENDING',
    };
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 9 });
    prismaMock.roomInvitation.findUnique
      .mockResolvedValueOnce(activeInvitation)
      .mockResolvedValueOnce(pendingInvitation);
    prismaMock.roomAssignment.findFirst.mockResolvedValue(null);
    prismaMock.roomAssignment.count.mockResolvedValue(0);
    prismaMock.roomInvitation.findFirst.mockResolvedValue(null);
    prismaMock.roomInvitation.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.requestToJoin('de-securetoken', 42),
    ).resolves.toMatchObject({ status: 'PENDING', tenantId: 9 });

    expect(prismaMock.roomInvitation.updateMany).toHaveBeenCalledWith({
      where: {
        id: 17,
        status: 'ACTIVE',
        tenantId: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { status: 'PENDING', tenantId: 9 },
    });
    expect(prismaMock.roomAssignment.create).not.toHaveBeenCalled();
  });

  it('returns an existing pending request instead of creating a duplicate', async () => {
    const existingRequest = {
      ...makeInvitation('PENDING'),
      tenantId: 9,
    };
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 9 });
    prismaMock.roomInvitation.findUnique.mockResolvedValue(existingRequest);

    await expect(
      service.requestToJoin('DE-SECURETOKEN', 42),
    ).resolves.toBe(existingRequest);
    expect(prismaMock.roomInvitation.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.roomAssignment.create).not.toHaveBeenCalled();
  });

  it('does not allow a tenant to submit a second pending room request', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 9 });
    prismaMock.roomInvitation.findUnique.mockResolvedValue(
      makeInvitation('ACTIVE'),
    );
    prismaMock.roomAssignment.findFirst.mockResolvedValue(null);
    prismaMock.roomAssignment.count.mockResolvedValue(0);
    prismaMock.roomInvitation.findFirst.mockResolvedValue({ id: 22 });

    await expect(
      service.requestToJoin('DE-SECURETOKEN', 42),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prismaMock.roomInvitation.updateMany).not.toHaveBeenCalled();
  });

  it('approves a pending request and assigns its tenant in the same transaction', async () => {
    const pending = {
      ...makeInvitation('PENDING'),
      tenantId: 9,
      tenant: { id: 9 },
    };
    const approved = { ...pending, status: 'APPROVED' };
    prismaMock.roomInvitation.findUnique
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(approved);
    prismaMock.roomAssignment.findFirst.mockResolvedValue(null);
    prismaMock.roomAssignment.count.mockResolvedValue(1);
    prismaMock.roomInvitation.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.roomAssignment.create.mockResolvedValue({ id: 31 });

    await expect(service.approve(17)).resolves.toEqual({
      invitation: approved,
      assignment: { id: 31 },
    });
    expect(prismaMock.roomAssignment.create).toHaveBeenCalledWith({
      data: {
        tenantId: 9,
        roomId: 3,
        moveInDate: expect.any(Date),
      },
    });
    expect(prismaMock.room.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { status: 'OCCUPIED' },
    });
  });

  it('does not approve a request when the room has reached capacity', async () => {
    prismaMock.roomInvitation.findUnique.mockResolvedValue({
      ...makeInvitation('PENDING'),
      tenantId: 9,
      tenant: { id: 9 },
    });
    prismaMock.roomAssignment.findFirst.mockResolvedValue(null);
    prismaMock.roomAssignment.count.mockResolvedValue(2);

    await expect(service.approve(17)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prismaMock.roomInvitation.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.roomAssignment.create).not.toHaveBeenCalled();
  });

  it('does not create a duplicate assignment for an already assigned tenant', async () => {
    prismaMock.roomInvitation.findUnique.mockResolvedValue({
      ...makeInvitation('PENDING'),
      tenantId: 9,
      tenant: { id: 9 },
    });
    prismaMock.roomAssignment.findFirst.mockResolvedValue({ id: 30 });

    await expect(service.approve(17)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prismaMock.roomAssignment.create).not.toHaveBeenCalled();
    expect(prismaMock.roomInvitation.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a pending request without assigning the tenant', async () => {
    const pending = { ...makeInvitation('PENDING'), tenantId: 9 };
    const rejected = { ...pending, status: 'REJECTED' };
    prismaMock.roomInvitation.findUnique
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(rejected);
    prismaMock.roomInvitation.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.reject(17)).resolves.toBe(rejected);
    expect(prismaMock.roomInvitation.updateMany).toHaveBeenCalledWith({
      where: { id: 17, status: 'PENDING', tenantId: 9 },
      data: { status: 'REJECTED' },
    });
    expect(prismaMock.roomAssignment.create).not.toHaveBeenCalled();
  });

  it('prevents already processed requests from being approved again', async () => {
    prismaMock.roomInvitation.findUnique.mockResolvedValue({
      ...makeInvitation('APPROVED'),
      tenantId: 9,
      tenant: { id: 9 },
    });

    await expect(service.approve(17)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prismaMock.roomAssignment.create).not.toHaveBeenCalled();
  });
});
