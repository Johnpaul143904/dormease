import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkIdentityService } from '../auth/clerk-identity.service';

describe('TenantsService', () => {
  let service: TenantsService;
  const tx = {
    tenant: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    user: { update: jest.fn(), delete: jest.fn() },
    maintenanceRequest: { deleteMany: jest.fn(), updateMany: jest.fn() },
    payment: { deleteMany: jest.fn() },
    roomInvitation: { deleteMany: jest.fn() },
    roomAssignment: { deleteMany: jest.fn(), count: jest.fn() },
    room: { findUnique: jest.fn(), update: jest.fn() },
  };
  const prismaMock = {
    user: { findUnique: jest.fn() },
    tenant: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  };
  const clerkIdentity = { getVerifiedIdentity: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ClerkIdentityService, useValue: clerkIdentity },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a tenant account without a local password', async () => {
    prismaMock.tenant.create.mockResolvedValue({
      id: 1,
      user: { id: 2, fullName: 'New Tenant', email: 'tenant@example.com' },
    });

    await expect(
      service.create({
        fullName: ' New Tenant ',
        email: ' TENANT@example.com ',
      }),
    ).resolves.toMatchObject({ id: 1 });
    expect(prismaMock.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user: {
            create: expect.objectContaining({
              email: 'tenant@example.com',
              fullName: 'New Tenant',
              role: 'TENANT',
              password: null,
            }),
          },
        }),
      }),
    );
  });

  it('updates account identity and tenant contact fields together', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: 1,
      user: { id: 2, email: 'old@example.com' },
    });
    prismaMock.user.findUnique.mockResolvedValue({ clerkUserId: null });
    tx.tenant.update.mockResolvedValue({
      id: 1,
      user: { id: 2, fullName: 'Updated Name', email: 'new@example.com' },
    });

    await service.update(1, {
      fullName: 'Updated Name',
      email: 'NEW@example.com',
      contactNumber: '12345',
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { fullName: 'Updated Name', email: 'new@example.com' },
    });
    expect(tx.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { contactNumber: '12345' },
      }),
    );
  });

  it('requires a linked tenant email to be verified in Clerk before changing it', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: 1,
      user: {
        id: 2,
        email: 'old@example.com',
      },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      clerkUserId: 'user_clerk_123',
    });
    clerkIdentity.getVerifiedIdentity.mockResolvedValue({
      email: 'verified@example.com',
    });

    await expect(
      service.update(1, { email: 'unverified@example.com' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('deletes tenant-linked records and keeps a room occupied for remaining tenants', async () => {
    tx.tenant.findUnique.mockResolvedValue({
      id: 1,
      userId: 2,
      assignments: [{ roomId: 7 }],
    });
    tx.room.findUnique.mockResolvedValue({ status: 'OCCUPIED' });
    tx.roomAssignment.count.mockResolvedValue(1);

    await expect(service.remove(1)).resolves.toEqual({ id: 1 });

    expect(tx.maintenanceRequest.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 1 },
    });
    expect(tx.payment.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 1 },
    });
    expect(tx.roomInvitation.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 1 },
    });
    expect(tx.roomAssignment.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 1 },
    });
    expect(tx.tenant.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(tx.room.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { status: 'OCCUPIED' },
    });
  });

  it('does not change a room that is under maintenance when its tenant is deleted', async () => {
    tx.tenant.findUnique.mockResolvedValue({
      id: 1,
      userId: 2,
      assignments: [{ roomId: 7 }],
    });
    tx.room.findUnique.mockResolvedValue({ status: 'MAINTENANCE' });

    await service.remove(1);

    expect(tx.room.update).not.toHaveBeenCalled();
  });
});
