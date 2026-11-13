import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryReceiptCleanupService } from './cloudinary-receipt-cleanup.service';
import { CloudinaryReceiptStorageService } from './cloudinary-receipt-storage.service';

@Module({
  imports: [PrismaModule],
  providers: [
    CloudinaryReceiptStorageService,
    CloudinaryReceiptCleanupService,
  ],
  exports: [
    CloudinaryReceiptStorageService,
    CloudinaryReceiptCleanupService,
  ],
})
export class CloudinaryModule {}
