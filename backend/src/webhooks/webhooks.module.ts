import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClerkWebhookController } from './clerk-webhook.controller';
import { ClerkWebhookService } from './clerk-webhook.service';
import { ClerkWebhookVerifier } from './clerk-webhook.verifier';

@Module({
  imports: [ConfigModule],
  controllers: [ClerkWebhookController],
  providers: [ClerkWebhookService, ClerkWebhookVerifier],
})
export class WebhooksModule {}
