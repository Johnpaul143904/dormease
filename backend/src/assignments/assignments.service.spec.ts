import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentsService } from './assignments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AssignmentsService', () => {
  let service: AssignmentsService;
  const tx = {
    tenant: { findUnique: jest.fn() },
    room: { findUnique: jest.fn(), update: jest.fn() },
    roomAssignment: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const prismaMock = {
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates an assignment when the room has a free slot', async () => {
    tx.tenant.findUnique.mockResolvedValue({ id: 1 });
    tx.room.findUnique.mockResolvedValue({
      id: 2,
      capacity: 2,
      status: 'OCCUPIED',
    });
    tx.roomAssignment.count.mockResolvedValue(1);
    tx.roomAssignment.findFirst.mockResolvedValue(null);
    tx.roomAssignment.create.mockResolvedValue({ id: 3 });

    await expect(
      service.create({ tenantId: 1, roomId: 2, moveInDate: '2026-11-09' }),
    ).resolves.toEqual({ id: 3 });
    expect(tx.room.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { status: 'OCCUPIED' },
    });
  });

  it('rejects assignments when the room is at capacity', async () => {
    tx.tenant.findUnique.mockResolvedValue({ id: 1 });
    tx.room.findUnique.mockResolvedValue({
      id: 2,
      capacity: 2,
      status: 'OCCUPIED',
    });
    tx.roomAssignment.count.mockResolvedValue(2);

    await expect(
      service.create({ tenantId: 1, roomId: 2, moveInDate: '2026-11-09' }),
    ).rejects.toThrow('Room has no available slots');
    expect(tx.roomAssignment.create).not.toHaveBeenCalled();
  });

  it('marks a room available after its last active assignment ends', async () => {
    tx.roomAssignment.findUnique.mockResolvedValue({
      id: 3,
      roomId: 2,
      status: 'ACTIVE',
    });
    tx.roomAssignment.update.mockResolvedValue({ id: 3, status: 'COMPLETED' });
    tx.roomAssignment.count.mockResolvedValue(0);
    tx.room.findUnique.mockResolvedValue({ id: 2, status: 'OCCUPIED' });

    await service.terminate(3);

    expect(tx.room.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { status: 'AVAILABLE' },
    });
  });

  it('preserves maintenance status after an assignment ends', async () => {
    tx.roomAssignment.findUnique.mockResolvedValue({
      id: 3,
      roomId: 2,
      status: 'ACTIVE',
    });
    tx.roomAssignment.update.mockResolvedValue({ id: 3, status: 'COMPLETED' });
    tx.roomAssignment.count.mockResolvedValue(0);
    tx.room.findUnique.mockResolvedValue({ id: 2, status: 'MAINTENANCE' });

    await service.terminate(3);

    expect(tx.room.update).not.toHaveBeenCalled();
  });
});
