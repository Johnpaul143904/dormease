import { CloudinaryReceiptCleanupService } from './cloudinary-receipt-cleanup.service';
import { CloudinaryReceiptStorageService } from './cloudinary-receipt-storage.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CloudinaryReceiptCleanupService', () => {
  const pendingAsset = {
    assetId: 'asset-1',
    publicId: 'dormease/payment-receipts/asset-1',
    resourceType: 'image',
    attempts: 0,
    nextAttemptAt: new Date(),
    lastError: null,
    createdAt: new Date(),
  };
  const prismaMock = {
    cloudinaryReceiptDeletion: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const storageMock = { delete: jest.fn() };
  let service: CloudinaryReceiptCleanupService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.cloudinaryReceiptDeletion.upsert.mockResolvedValue({});
    prismaMock.cloudinaryReceiptDeletion.findMany.mockResolvedValue([]);
    prismaMock.cloudinaryReceiptDeletion.deleteMany.mockResolvedValue({
      count: 1,
    });
    prismaMock.cloudinaryReceiptDeletion.update.mockResolvedValue({});
    storageMock.delete.mockResolvedValue(undefined);
    service = new CloudinaryReceiptCleanupService(
      prismaMock as unknown as PrismaService,
      storageMock as unknown as CloudinaryReceiptStorageService,
    );
  });

  it('deletes queued Cloudinary assets and removes their queue records', async () => {
    prismaMock.cloudinaryReceiptDeletion.findMany.mockResolvedValue([
      pendingAsset,
    ]);

    await service.processPending();

    expect(storageMock.delete).toHaveBeenCalledWith(
      pendingAsset.publicId,
      pendingAsset.resourceType,
    );
    expect(prismaMock.cloudinaryReceiptDeletion.deleteMany).toHaveBeenCalledWith(
      { where: { assetId: pendingAsset.assetId } },
    );
  });

  it('retains failed cleanup jobs and schedules a retry', async () => {
    prismaMock.cloudinaryReceiptDeletion.findMany.mockResolvedValue([
      pendingAsset,
    ]);
    storageMock.delete.mockRejectedValue(new Error('Cloudinary is unavailable'));

    await service.processPending();

    expect(prismaMock.cloudinaryReceiptDeletion.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.cloudinaryReceiptDeletion.update).toHaveBeenCalledWith({
      where: { assetId: pendingAsset.assetId },
      data: expect.objectContaining({
        attempts: 1,
        lastError: 'Cloudinary deletion failed; will retry.',
        nextAttemptAt: expect.any(Date),
      }),
    });
  });
});
