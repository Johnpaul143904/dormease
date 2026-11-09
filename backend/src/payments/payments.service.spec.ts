import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import type { PaymentProofFile } from './payment-proof-file.type';
import { UserRole } from '../generated/prisma/enums';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const transactionMock = {
    payment: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    paymentSubmission: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    paymentVerificationHistory: {
      create: jest.fn(),
    },
  };
  const prismaMock = {
    payment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    paymentSubmission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    tenant: { findUnique: jest.fn() },
    $transaction: jest.fn((callback: (tx: typeof transactionMock) => unknown) =>
      callback(transactionMock),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    transactionMock.payment.findFirst.mockReset();
    transactionMock.payment.update.mockReset();
    transactionMock.paymentSubmission.create.mockReset();
    transactionMock.paymentSubmission.findUnique.mockReset();
    transactionMock.paymentSubmission.findUniqueOrThrow.mockReset();
    transactionMock.paymentSubmission.updateMany.mockReset();
    transactionMock.paymentVerificationHistory.create.mockReset();
    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof transactionMock) => unknown) => callback(transactionMock),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a payment record for an existing tenant', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 8 });
    prismaMock.payment.create.mockResolvedValue({
      id: 12,
      tenantId: 8,
      amount: 1500,
      paymentMethod: 'Cash',
      paymentStatus: 'UNPAID',
    });

    await expect(
      service.create({
        tenantId: 8,
        amount: 1500,
        paymentMethod: ' Cash ',
        description: ' Monthly rent ',
      }),
    ).resolves.toMatchObject({ id: 12, tenantId: 8 });

    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 8,
          amount: 1500,
          paymentMethod: 'Cash',
          description: 'Monthly rent',
          paymentStatus: 'UNPAID',
        }),
      }),
    );
  });

  it('rejects a payment record for a missing tenant', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        tenantId: 8,
        amount: 1500,
        paymentMethod: 'Cash',
      }),
    ).rejects.toThrow('Tenant was not found');
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  it('updates bill details without changing its verification-controlled status', async () => {
    prismaMock.payment.findUnique.mockResolvedValue({
      id: 12,
      amount: 1500,
      amountPaid: 0,
      paymentStatus: 'UNPAID',
    });
    prismaMock.payment.update.mockResolvedValue({
      id: 12,
      paymentStatus: 'UNPAID',
      amount: 1600,
    });

    await service.update(12, { amount: 1600 });

    expect(prismaMock.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 12 },
        data: expect.objectContaining({
          amount: 1600,
        }),
      }),
    );
    expect(prismaMock.payment.update.mock.calls[0][0].data).not.toHaveProperty(
      'paymentStatus',
    );
  });

  it('stores a valid tenant proof without changing the bill before verification', async () => {
    const proofData = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const file: PaymentProofFile = {
      buffer: proofData,
      mimetype: 'image/png',
      originalname: 'receipt.png',
      size: proofData.length,
    };
    transactionMock.payment.findFirst.mockResolvedValue({
      id: 12,
      tenantId: 8,
      amount: 1500,
      amountPaid: 500,
      paymentStatus: 'PARTIAL',
      submissions: [],
    });
    transactionMock.paymentSubmission.create.mockResolvedValue({
      id: 30,
      status: 'PENDING',
    });

    await expect(
      service.submitProof(
        99,
        12,
        {
          amount: 1000,
          paymentMethod: 'GCash',
          paymentDate: '2026-11-08',
          referenceNumber: ' ref-123 ',
        },
        file,
      ),
    ).resolves.toMatchObject({ id: 30, status: 'PENDING' });

    expect(transactionMock.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 12, tenant: { userId: 99 } },
      }),
    );
    expect(transactionMock.paymentSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId: 12,
          tenantId: 8,
          amount: 1000,
          referenceNumber: 'ref-123',
          proofData,
        }),
      }),
    );
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(transactionMock.payment.update).not.toHaveBeenCalled();
  });

  it('does not disclose or allow proof submission for another tenant payment', async () => {
    const proofData = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    transactionMock.payment.findFirst.mockResolvedValue(null);

    await expect(
      service.submitProof(
        99,
        12,
        {
          amount: 100,
          paymentMethod: 'Cash',
          paymentDate: '2026-11-08',
          referenceNumber: 'ref-456',
        },
        {
          buffer: proofData,
          mimetype: 'image/png',
          originalname: 'receipt.png',
          size: proofData.length,
        },
      ),
    ).rejects.toThrow('Payment was not found');
    expect(transactionMock.paymentSubmission.create).not.toHaveBeenCalled();
  });

  it('rejects file content that does not match the declared receipt type', async () => {
    const file: PaymentProofFile = {
      buffer: Buffer.from('not a png'),
      mimetype: 'image/png',
      originalname: 'receipt.png',
      size: 9,
    };

    await expect(
      service.submitProof(
        99,
        12,
        {
          amount: 100,
          paymentMethod: 'Cash',
          paymentDate: '2026-11-08',
          referenceNumber: 'ref-789',
        },
        file,
      ),
    ).rejects.toThrow('does not match');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a proof larger than the upload limit', async () => {
    const file: PaymentProofFile = {
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
      mimetype: 'image/png',
      originalname: 'receipt.png',
      size: 5 * 1024 * 1024 + 1,
    };

    await expect(
      service.submitProof(
        99,
        12,
        {
          amount: 100,
          paymentMethod: 'Cash',
          paymentDate: '2026-11-08',
          referenceNumber: 'ref-large',
        },
        file,
      ),
    ).rejects.toThrow('5 MB or smaller');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an amount above the remaining bill balance', async () => {
    const proofData = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    transactionMock.payment.findFirst.mockResolvedValue({
      id: 12,
      tenantId: 8,
      amount: 1500,
      amountPaid: 500,
      paymentStatus: 'PARTIAL',
      submissions: [],
    });

    await expect(
      service.submitProof(
        99,
        12,
        {
          amount: 1000.01,
          paymentMethod: 'GCash',
          paymentDate: '2026-11-08',
          referenceNumber: 'ref-overdue',
        },
        {
          buffer: proofData,
          mimetype: 'image/png',
          originalname: 'receipt.png',
          size: proofData.length,
        },
      ),
    ).rejects.toThrow('cannot exceed the outstanding balance');
    expect(transactionMock.paymentSubmission.create).not.toHaveBeenCalled();
  });

  it('keeps receipt access limited to its tenant owner', async () => {
    const bytes = Buffer.from('receipt');
    prismaMock.paymentSubmission.findUnique.mockResolvedValue({
      tenant: { userId: 99 },
      proofData: bytes,
      proofMimeType: 'application/pdf',
      proofFileName: 'receipt.pdf',
    });

    await expect(
      service.getProof(30, 101, UserRole.TENANT),
    ).rejects.toThrow('Payment proof was not found');
    await expect(
      service.getProof(30, 99, UserRole.TENANT),
    ).resolves.toMatchObject({
      mimeType: 'application/pdf',
      fileName: 'receipt.pdf',
    });
  });

  it('updates the paid balance and audit trail only when a pending proof is approved', async () => {
    transactionMock.paymentSubmission.findUnique.mockResolvedValue({
      id: 30,
      paymentId: 12,
      amount: 400,
      paymentMethod: 'Bank Transfer',
      paymentDate: new Date('2026-11-08'),
      status: 'PENDING',
      payment: {
        amount: 1500,
        amountPaid: 500,
      },
    });
    transactionMock.paymentSubmission.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.paymentSubmission.findUniqueOrThrow.mockResolvedValue({
      id: 30,
      status: 'APPROVED',
    });

    await expect(
      service.verifySubmission(30, 2, { status: 'APPROVED' }),
    ).resolves.toMatchObject({ id: 30, status: 'APPROVED' });

    expect(transactionMock.payment.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: expect.objectContaining({
        amountPaid: 900,
        paymentStatus: 'PARTIAL',
        paymentMethod: 'Bank Transfer',
      }),
    });
    expect(transactionMock.paymentVerificationHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentSubmissionId: 30,
        status: 'APPROVED',
        changedById: 2,
      }),
    });
  });

  it('rejects a proof with remarks without changing the payment balance', async () => {
    transactionMock.paymentSubmission.findUnique.mockResolvedValue({
      id: 30,
      paymentId: 12,
      amount: 400,
      status: 'PENDING',
      payment: { amount: 1500, amountPaid: 500 },
    });
    transactionMock.paymentSubmission.updateMany.mockResolvedValue({ count: 1 });
    transactionMock.paymentSubmission.findUniqueOrThrow.mockResolvedValue({
      id: 30,
      status: 'REJECTED',
    });

    await service.verifySubmission(30, 2, {
      status: 'REJECTED',
      remarks: 'Receipt is unreadable',
    });

    expect(transactionMock.payment.update).not.toHaveBeenCalled();
    expect(transactionMock.paymentSubmission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          rejectionRemarks: 'Receipt is unreadable',
          verifiedById: 2,
        }),
      }),
    );
  });
});
