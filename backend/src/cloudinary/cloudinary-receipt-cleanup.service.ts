import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CloudinaryReceiptAsset } from './cloudinary-receipt-asset.type';
import { CloudinaryReceiptStorageService } from './cloudinary-receipt-storage.service';

const CLEANUP_BATCH_SIZE = 25;
const CLEANUP_INTERVAL_MS = 60_000;

@Injectable()
export class CloudinaryReceiptCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CloudinaryReceiptCleanupService.name);
  private timer: NodeJS.Timeout | undefined;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: CloudinaryReceiptStorageService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.processPending();
    }, CLEANUP_INTERVAL_MS);
    this.timer.unref();
    void this.processPending();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(asset: CloudinaryReceiptAsset): Promise<void> {
    await this.prisma.cloudinaryReceiptDeletion.upsert({
      where: { assetId: asset.assetId },
      create: {
        assetId: asset.assetId,
        publicId: asset.publicId,
        resourceType: asset.resourceType,
      },
      update: {},
    });
    await this.processPending();
  }

  async processPending(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      const now = new Date();
      const pending = await this.prisma.cloudinaryReceiptDeletion.findMany({
        where: { nextAttemptAt: { lte: now } },
        orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
        take: CLEANUP_BATCH_SIZE,
      });

      for (const asset of pending) {
        try {
          await this.storage.delete(asset.publicId, asset.resourceType);
          await this.prisma.cloudinaryReceiptDeletion.deleteMany({
            where: { assetId: asset.assetId },
          });
        } catch (error) {
          const attempts = asset.attempts + 1;
          const retryDelaySeconds = Math.min(
            30 * 2 ** Math.min(attempts, 7),
            3600,
          );
          await this.prisma.cloudinaryReceiptDeletion.update({
            where: { assetId: asset.assetId },
            data: {
              attempts,
              nextAttemptAt: new Date(Date.now() + retryDelaySeconds * 1000),
              lastError: 'Cloudinary deletion failed; will retry.',
            },
          });
          this.logger.warn(
            `Receipt asset ${asset.assetId} could not be deleted; retry scheduled.`,
          );
          if (!(error instanceof Error)) {
            this.logger.warn('Cloudinary deletion returned a non-error failure.');
          }
        }
      }
    } catch (error) {
      this.logger.error(
        'Unable to process pending Cloudinary receipt deletions',
        error instanceof Error ? error.name : 'Unknown error',
      );
    } finally {
      this.isProcessing = false;
    }
  }
}
