import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import type { PaymentProofFile } from './payment-proof-file.type';
import { UserRole } from '../generated/prisma/enums';
import { CloudinaryReceiptCleanupService } from '../cloudinary/cloudinary-receipt-cleanup.service';
import { CloudinaryReceiptStorageService } from '../cloudinary/cloudinary-receipt-storage.service';

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
  const receiptAsset = {
    assetId: 'receipt-asset-30',
    publicId: 'dormease/payment-receipts/receipt-asset-30',
    secureUrl:
      'https://res.cloudinary.com/example/image/authenticated/receipt-asset-30.png',
    resourceType: 'image' as const,
    format: 'png',
  };
  const receiptStorageMock = {
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
  };
  const receiptCleanupMock = {
    enqueue: jest.fn(),
    processPending: jest.fn(),
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
    receiptStorageMock.upload.mockReset().mockResolvedValue(receiptAsset);
    receiptStorageMock.download.mockReset();
    receiptStorageMock.delete.mockReset().mockResolvedValue(undefined);
    receiptCleanupMock.enqueue.mockReset().mockResolvedValue(undefined);
    receiptCleanupMock.processPending.mockReset().mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof transactionMock) => unknown) => callback(transactionMock),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: CloudinaryReceiptStorageService,
          useValue: receiptStorageMock,
        },
        {
          provide: CloudinaryReceiptCleanupService,
          useValue: receiptCleanupMock,
        },
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

  it('stores a valid tenant proof in Cloudinary without changing the bill before verification', async () => {
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
          proofData: null,
          cloudinaryAssetId: receiptAsset.assetId,
          cloudinaryPublicId: receiptAsset.publicId,
          cloudinarySecureUrl: receiptAsset.secureUrl,
          cloudinaryResourceType: receiptAsset.resourceType,
          cloudinaryFormat: receiptAsset.format,
        }),
      }),
    );
    expect(receiptStorageMock.upload).toHaveBeenCalledWith(proofData);
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(transactionMock.payment.update).not.toHaveBeenCalled();
  });

  it('does not create a payment submission when Cloudinary upload fails', async () => {
    receiptStorageMock.upload.mockRejectedValue(
      new Error('Cloudinary upload failed'),
    );

    await expect(
      service.submitProof(
        99,
        12,
        {
          amount: 100,
          paymentMethod: 'Cash',
          paymentDate: '2026-11-08',
          referenceNumber: 'ref-cloudinary-error',
        },
        {
          buffer: Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
          ]),
          mimetype: 'image/png',
          originalname: 'receipt.png',
          size: 8,
        },
      ),
    ).rejects.toThrow('Cloudinary upload failed');

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(transactionMock.paymentSubmission.create).not.toHaveBeenCalled();
  });

  it('cleans up a Cloudinary upload when database persistence fails', async () => {
    transactionMock.payment.findFirst.mockResolvedValue({
      id: 12,
      tenantId: 8,
      amount: 1500,
      amountPaid: 0,
      paymentStatus: 'UNPAID',
      submissions: [],
    });
    transactionMock.paymentSubmission.create.mockRejectedValue(
      new Error('Database write failed'),
    );

    await expect(
      service.submitProof(
        99,
        12,
        {
          amount: 100,
          paymentMethod: 'Cash',
          paymentDate: '2026-11-08',
          referenceNumber: 'ref-db-error',
        },
        {
          buffer: Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
          ]),
          mimetype: 'image/png',
          originalname: 'receipt.png',
          size: 8,
        },
      ),
    ).rejects.toThrow('Database write failed');

    expect(receiptStorageMock.delete).toHaveBeenCalledWith(
      receiptAsset.publicId,
      receiptAsset.resourceType,
    );
    expect(receiptCleanupMock.enqueue).not.toHaveBeenCalled();
  });

  it('queues cleanup if an uploaded receipt cannot be removed after a database failure', async () => {
    transactionMock.payment.findFirst.mockResolvedValue({
      id: 12,
      tenantId: 8,
      amount: 1500,
      amountPaid: 0,
      paymentStatus: 'UNPAID',
      submissions: [],
    });
    transactionMock.paymentSubmission.create.mockRejectedValue(
      new Error('Database write failed'),
    );
    receiptStorageMock.delete.mockRejectedValue(
      new Error('Cloudinary delete failed'),
    );

    await expect(
      service.submitProof(
        99,
        12,
        {
          amount: 100,
          paymentMethod: 'Cash',
          paymentDate: '2026-11-08',
          referenceNumber: 'ref-cleanup-error',
        },
        {
          buffer: Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
          ]),
          mimetype: 'image/png',
          originalname: 'receipt.png',
          size: 8,
        },
      ),
    ).rejects.toThrow('Database write failed');

    expect(receiptCleanupMock.enqueue).toHaveBeenCalledWith(receiptAsset);
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

  it('retrieves a new Cloudinary receipt after checking tenant ownership', async () => {
    const bytes = Buffer.from('cloud receipt');
    prismaMock.paymentSubmission.findUnique.mockResolvedValue({
      tenant: { userId: 99 },
      proofData: null,
      proofMimeType: 'application/pdf',
      proofFileName: 'receipt.pdf',
      cloudinaryPublicId: receiptAsset.publicId,
      cloudinaryResourceType: 'raw',
      cloudinaryFormat: 'pdf',
    });
    receiptStorageMock.download.mockResolvedValue(bytes);

    await expect(
      service.getProof(30, 99, UserRole.TENANT),
    ).resolves.toEqual({
      data: bytes,
      mimeType: 'application/pdf',
      fileName: 'receipt.pdf',
    });
    expect(receiptStorageMock.download).toHaveBeenCalledWith(
      receiptAsset.publicId,
      'raw',
      'pdf',
    );
  });

  it('allows authorized staff to retrieve a tenant receipt', async () => {
    prismaMock.paymentSubmission.findUnique.mockResolvedValue({
      tenant: { userId: 99 },
      proofData: null,
      proofMimeType: 'image/png',
      proofFileName: 'receipt.png',
      cloudinaryPublicId: receiptAsset.publicId,
      cloudinaryResourceType: 'image',
      cloudinaryFormat: 'png',
    });
    receiptStorageMock.download.mockResolvedValue(Buffer.from('cloud receipt'));

    await expect(
      service.getProof(30, 101, UserRole.STAFF),
    ).resolves.toMatchObject({
      mimeType: 'image/png',
      fileName: 'receipt.png',
    });
    expect(receiptStorageMock.download).toHaveBeenCalledWith(
      receiptAsset.publicId,
      'image',
      'png',
    );
  });

  it('does not request a Cloudinary receipt for a different tenant', async () => {
    prismaMock.paymentSubmission.findUnique.mockResolvedValue({
      tenant: { userId: 99 },
      proofData: null,
      proofMimeType: 'image/png',
      proofFileName: 'receipt.png',
      cloudinaryPublicId: receiptAsset.publicId,
      cloudinaryResourceType: 'image',
      cloudinaryFormat: 'png',
    });

    await expect(
      service.getProof(30, 101, UserRole.TENANT),
    ).rejects.toThrow('Payment proof was not found');
    expect(receiptStorageMock.download).not.toHaveBeenCalled();
  });

  it('does not include Cloudinary asset URLs or IDs in payment submission listings', async () => {
    prismaMock.paymentSubmission.findMany.mockResolvedValue([]);

    await service.findAllSubmissions();

    const selection = prismaMock.paymentSubmission.findMany.mock.calls[0][0]
      .select;
    expect(selection).not.toHaveProperty('cloudinaryAssetId');
    expect(selection).not.toHaveProperty('cloudinaryPublicId');
    expect(selection).not.toHaveProperty('cloudinarySecureUrl');
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
