import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyWebhook } from '@clerk/backend/webhooks';
import type { WebhookEvent } from '@clerk/backend/webhooks';

@Injectable()
export class ClerkWebhookVerifier {
  private readonly logger = new Logger(ClerkWebhookVerifier.name);
  private readonly signingSecret: string;

  constructor(configService: ConfigService) {
    this.signingSecret = configService.getOrThrow<string>(
      'CLERK_WEBHOOK_SIGNING_SECRET',
    );
  }

  async verify(request: Request): Promise<WebhookEvent> {
    try {
      return await verifyWebhook(request, {
        signingSecret: this.signingSecret,
      });
    } catch (error) {
      this.logger.warn('Rejected a Clerk webhook with an invalid signature');
      throw new BadRequestException('Invalid Clerk webhook signature', {
        cause: error,
      });
    }
  }
}
