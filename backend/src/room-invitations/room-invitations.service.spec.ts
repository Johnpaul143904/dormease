import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RoomInvitationsService } from './room-invitations.service';

describe('RoomInvitationsService', () => {
  let service: RoomInvitationsService;
  const roomInvitation = {
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const roomAssignment = { count: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomInvitationsService,
        {
          provide: PrismaService,
          useValue: { roomInvitation, roomAssignment },
        },
      ],
    }).compile();

    service = module.get<RoomInvitationsService>(RoomInvitationsService);
  });

  const makeInvitation = (status: string, expiresAt: Date) => ({
    id: 17,
    roomId: 3,
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
    roomInvitation.findUnique.mockResolvedValue(
      makeInvitation('ACTIVE', new Date(Date.now() + 60_000)),
    );
    roomAssignment.count.mockResolvedValue(1);

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
    expect(roomInvitation.findUnique).toHaveBeenCalledWith({
      where: { code: 'DE-SECURETOKEN' },
      include: { room: true },
    });
  });

  it('marks an expired active invitation as expired', async () => {
    roomInvitation.findUnique.mockResolvedValue(
      makeInvitation('ACTIVE', new Date(Date.now() - 60_000)),
    );
    roomInvitation.update.mockResolvedValue({});
    roomAssignment.count.mockResolvedValue(0);

    const invitation = await service.findByCode('DE-SECURETOKEN');

    expect(roomInvitation.update).toHaveBeenCalledWith({
      where: { id: 17 },
      data: { status: 'EXPIRED' },
    });
    expect(invitation.status).toBe('EXPIRED');
  });

  it.each(['REVOKED', 'USED', 'REJECTED', 'EXPIRED'])(
    'preserves the %s status for public validation',
    async (status) => {
      roomInvitation.findUnique.mockResolvedValue(
        makeInvitation(status, new Date(Date.now() + 60_000)),
      );
      roomAssignment.count.mockResolvedValue(0);

      await expect(service.findByCode('DE-SECURETOKEN')).resolves.toMatchObject({
        status,
      });
      expect(roomInvitation.update).not.toHaveBeenCalled();
    },
  );

  it('rejects unknown invitation codes', async () => {
    roomInvitation.findUnique.mockResolvedValue(null);

    await expect(service.findByCode('INVALID')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(roomAssignment.count).not.toHaveBeenCalled();
  });
});
