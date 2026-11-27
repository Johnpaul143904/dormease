import { BadRequestException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { WebhookEvent } from '@clerk/backend/webhooks';
import { ClerkWebhookController } from './clerk-webhook.controller';
import { ClerkWebhookService } from './clerk-webhook.service';
import { ClerkWebhookVerifier } from './clerk-webhook.verifier';

describe('ClerkWebhookController', () => {
  const webhookService = { process: jest.fn() };
  const webhookVerifier = { verify: jest.fn() };
  let controller: ClerkWebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ClerkWebhookController(
      webhookService as unknown as ClerkWebhookService,
      webhookVerifier as unknown as ClerkWebhookVerifier,
    );
  });

  it('passes the exact raw body and verified event ID to processing', async () => {
    const body = '{"type":"user.created","data":{"id":"user_clerk_123"}}';
    const event = {
      type: 'user.created',
      data: { id: 'user_clerk_123' },
    } as WebhookEvent;
    webhookVerifier.verify.mockImplementation(async (request: Request) => {
      expect(await request.text()).toBe(body);
      return event;
    });
    webhookService.process.mockResolvedValue({ status: 'processed' });

    await expect(
      controller.receive(
        {
          rawBody: Buffer.from(body),
          headers: {
            'svix-id': 'msg_raw_body_test',
            'svix-timestamp': '123',
            'svix-signature': 'v1,test',
          },
        } as RawBodyRequest<Request>,
        'msg_raw_body_test',
      ),
    ).resolves.toEqual({ status: 'processed' });
    expect(webhookService.process).toHaveBeenCalledWith(
      event,
      'msg_raw_body_test',
    );
  });

  it('rejects requests when Nest did not capture the raw body', async () => {
    await expect(
      controller.receive(
        { rawBody: undefined, headers: {} } as RawBodyRequest<Request>,
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(webhookVerifier.verify).not.toHaveBeenCalled();
  });
});
