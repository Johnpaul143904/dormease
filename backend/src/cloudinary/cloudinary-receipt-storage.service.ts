import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import type { CloudinaryReceiptResourceType } from './cloudinary-receipt-asset.type';

const MAX_PROOF_SIZE = 5 * 1024 * 1024;
const allowedFormats = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']);

@Injectable()
export class CloudinaryReceiptStorageService {
  private readonly logger = new Logger(CloudinaryReceiptStorageService.name);

  constructor(private readonly configService: ConfigService) {}

  async upload(
    buffer: Buffer,
  ): Promise<{
    assetId: string;
    publicId: string;
    secureUrl: string;
    resourceType: CloudinaryReceiptResourceType;
    format: string;
  }> {
    const client = this.getClient();
    return new Promise((resolve, reject) => {
      const uploadStream = client.uploader.upload_stream(
        {
          resource_type: 'auto',
          type: 'authenticated',
          public_id: `dormease/payment-receipts/${randomUUID()}`,
          overwrite: false,
          use_filename: false,
          unique_filename: false,
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error(
              'Cloudinary receipt upload failed',
              error?.name || 'Missing upload response',
            );
            reject(
              new ServiceUnavailableException(
                'Receipt storage is temporarily unavailable. Please try again.',
              ),
            );
            return;
          }

          if (
            !result.asset_id ||
            !result.public_id ||
            !result.secure_url ||
            !this.isResourceType(result.resource_type) ||
            !allowedFormats.has(result.format)
          ) {
            this.logger.error('Cloudinary returned incomplete receipt metadata');
            reject(
              new ServiceUnavailableException(
                'Receipt storage returned invalid asset metadata.',
              ),
            );
            return;
          }

          resolve({
            assetId: result.asset_id,
            publicId: result.public_id,
            secureUrl: result.secure_url,
            resourceType: result.resource_type,
            format: result.format,
          });
        },
      );

      Readable.from([buffer]).pipe(uploadStream);
    });
  }

  async download(
    publicId: string,
    resourceType: string,
    format: string,
  ): Promise<Buffer> {
    const client = this.getClient();
    const validatedResourceType = this.requireResourceType(resourceType);
    if (!allowedFormats.has(format)) {
      throw new BadGatewayException('Stored receipt format is not supported.');
    }

    try {
      const url = client.utils.private_download_url(publicId, format, {
        resource_type: validatedResourceType,
        type: 'authenticated',
        expires_at: Math.floor(Date.now() / 1000) + 60,
      });
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        this.logger.error(
          `Cloudinary receipt download failed with status ${response.status}`,
        );
        throw new Error('Cloudinary returned an unsuccessful response');
      }

      const data = Buffer.from(await response.arrayBuffer());
      if (data.length > MAX_PROOF_SIZE) {
        throw new Error('Cloudinary receipt exceeded the allowed file size');
      }
      return data;
    } catch (error) {
      this.logger.error(
        'Cloudinary receipt download failed',
        error instanceof Error ? error.name : 'Unknown error',
      );
      throw new BadGatewayException(
        'Receipt could not be retrieved from secure storage.',
      );
    }
  }

  async delete(
    publicId: string,
    resourceType: string,
  ): Promise<void> {
    const client = this.getClient();
    const validatedResourceType = this.requireResourceType(resourceType);

    try {
      const result = await client.uploader.destroy(publicId, {
        resource_type: validatedResourceType,
        type: 'authenticated',
        invalidate: true,
      });
      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new Error('Cloudinary did not confirm receipt deletion');
      }
    } catch (error) {
      this.logger.error(
        'Cloudinary receipt deletion failed',
        error instanceof Error ? error.name : 'Unknown error',
      );
      throw new ServiceUnavailableException(
        'Receipt cleanup is temporarily unavailable.',
      );
    }
  }

  private getClient() {
    const cloudName = this.configService
      .get<string>('CLOUDINARY_CLOUD_NAME')
      ?.trim();
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY')?.trim();
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Cloudinary storage is not configured on the backend.',
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    return cloudinary;
  }

  private isResourceType(
    value: string,
  ): value is CloudinaryReceiptResourceType {
    return value === 'image' || value === 'raw';
  }

  private requireResourceType(value: string): CloudinaryReceiptResourceType {
    if (!this.isResourceType(value)) {
      throw new BadGatewayException('Stored receipt resource type is invalid.');
    }
    return value;
  }
}
