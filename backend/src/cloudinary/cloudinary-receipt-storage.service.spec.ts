import { ConfigService } from '@nestjs/config';
import { PassThrough } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import { CloudinaryReceiptStorageService } from './cloudinary-receipt-storage.service';

describe('CloudinaryReceiptStorageService', () => {
  const credentials = {
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
  };
  const configService = {
    get: jest.fn((key: string) => credentials[key as keyof typeof credentials]),
  };
  const uploadResponse: UploadApiResponse = {
    asset_id: 'asset-1',
    public_id: 'dormease/payment-receipts/asset-1',
    version: 1,
    signature: 'signature',
    width: 0,
    height: 0,
    format: 'png',
    resource_type: 'image',
    created_at: '2026-11-13T00:00:00Z',
    tags: [],
    pages: 0,
    bytes: 8,
    type: 'authenticated',
    etag: 'etag',
    placeholder: false,
    url: 'http://res.cloudinary.com/test-cloud/image/authenticated/asset-1.png',
    secure_url:
      'https://res.cloudinary.com/test-cloud/image/authenticated/asset-1.png',
    access_mode: 'authenticated',
    original_filename: 'receipt',
    moderation: [],
    access_control: [],
    context: {},
    metadata: {},
  };
  let service: CloudinaryReceiptStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CloudinaryReceiptStorageService(
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses a server-side authenticated upload and returns persisted asset metadata', async () => {
    const uploadStreamSpy = jest
      .spyOn(cloudinary.uploader, 'upload_stream')
      .mockReturnValue(new PassThrough());
    const uploadResult = service.upload(Buffer.from('receipt'));
    const [options, callback] = uploadStreamSpy.mock
      .calls[0] as unknown as [
      Record<string, unknown>,
      (error?: unknown, result?: UploadApiResponse) => void,
    ];
    expect(options).toMatchObject({
      resource_type: 'auto',
      type: 'authenticated',
      overwrite: false,
      use_filename: false,
      unique_filename: false,
    });
    callback(undefined, uploadResponse);

    await expect(uploadResult).resolves.toEqual({
      assetId: 'asset-1',
      publicId: uploadResponse.public_id,
      secureUrl: uploadResponse.secure_url,
      resourceType: 'image',
      format: 'png',
    });
    expect(options).toMatchObject({
      public_id: expect.stringMatching(/^dormease\/payment-receipts\/[0-9a-f-]+$/),
    });
  });

  it('generates a short-lived authenticated download URL on the server', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const downloadUrlSpy = jest
      .spyOn(cloudinary.utils, 'private_download_url')
      .mockReturnValue('https://api.cloudinary.com/signed-download');
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(Buffer.from('receipt'), { status: 200 }),
      );

    await expect(
      service.download(
        'dormease/payment-receipts/asset-1',
        'raw',
        'pdf',
      ),
    ).resolves.toEqual(Buffer.from('receipt'));

    expect(downloadUrlSpy).toHaveBeenCalledWith(
      'dormease/payment-receipts/asset-1',
      'pdf',
      {
        resource_type: 'raw',
        type: 'authenticated',
        expires_at: 1_800_000_060,
      },
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.cloudinary.com/signed-download',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('removes assets using their authenticated delivery type', async () => {
    const destroySpy = jest
      .spyOn(cloudinary.uploader, 'destroy')
      .mockResolvedValue({ result: 'ok' });

    await service.delete('dormease/payment-receipts/asset-1', 'raw');

    expect(destroySpy).toHaveBeenCalledWith(
      'dormease/payment-receipts/asset-1',
      {
        resource_type: 'raw',
        type: 'authenticated',
        invalidate: true,
      },
    );
  });
});
