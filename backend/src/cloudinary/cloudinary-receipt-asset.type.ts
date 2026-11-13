export type CloudinaryReceiptResourceType = 'image' | 'raw';

export interface CloudinaryReceiptAsset {
  assetId: string;
  publicId: string;
  secureUrl: string;
  resourceType: CloudinaryReceiptResourceType;
  format: string;
}
