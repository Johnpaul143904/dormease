import {
  BadRequestException,
  Controller,
  Headers as Header,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { RawBodyRequest } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { ClerkWebhookService } from './clerk-webhook.service';
import { ClerkWebhookVerifier } from './clerk-webhook.verifier';

@Controller('webhooks')
@Public()
export class ClerkWebhookController {
  constructor(
    private readonly webhookService: ClerkWebhookService,
    private readonly webhookVerifier: ClerkWebhookVerifier,
  ) {}

  @Post('clerk')
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Header('svix-id') eventId: string | undefined,
  ) {
    if (!request.rawBody) {
      throw new BadRequestException('Raw webhook body is required');
    }

    const headers = new Headers();
    for (const headerName of ['svix-id', 'svix-timestamp', 'svix-signature']) {
      const value = request.headers[headerName];
      if (typeof value === 'string') headers.set(headerName, value);
    }

    const webhookRequest = new Request(
      'https://clerk-webhook.invalid/api/webhooks/clerk',
      {
        method: 'POST',
        headers,
        body: request.rawBody.toString('utf8'),
      },
    );
    const event = await this.webhookVerifier.verify(webhookRequest);
    if (!eventId) {
      throw new BadRequestException('Clerk webhook event ID is required');
    }

    return this.webhookService.process(event, eventId);
  }
}
