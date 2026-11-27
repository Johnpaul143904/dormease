import { createHmac } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClerkWebhookVerifier } from './clerk-webhook.verifier';

describe('ClerkWebhookVerifier', () => {
  const signingSecret = `whsec_${Buffer.from('webhook-secret').toString('base64')}`;
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(signingSecret),
  };
  let verifier: ClerkWebhookVerifier;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.getOrThrow.mockReturnValue(signingSecret);
    verifier = new ClerkWebhookVerifier(
      configService as unknown as ConfigService,
    );
  });

  function signedRequest(body: string) {
    const id = 'msg_webhook_test';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac(
      'sha256',
      Buffer.from(signingSecret.slice('whsec_'.length), 'base64'),
    )
      .update(`${id}.${timestamp}.${body}`)
      .digest('base64');

    return new Request('https://api.example/api/webhooks/clerk', {
      method: 'POST',
      headers: {
        'svix-id': id,
        'svix-timestamp': timestamp,
        'svix-signature': `v1,${signature}`,
      },
      body,
    });
  }

  it('accepts a valid Clerk signature and returns the signed event', async () => {
    const body = JSON.stringify({
      data: { id: 'user_clerk_123' },
      object: 'event',
      type: 'user.created',
      timestamp: Date.now(),
      instance_id: 'ins_test',
    });

    await expect(verifier.verify(signedRequest(body))).resolves.toMatchObject({
      type: 'user.created',
      data: { id: 'user_clerk_123' },
    });
  });

  it('rejects a payload whose body does not match the signature', async () => {
    const request = signedRequest('{"type":"user.created"}');
    const headers = new Headers(request.headers);
    const tampered = new Request(request.url, {
      method: 'POST',
      headers,
      body: '{"type":"user.deleted"}',
    });

    await expect(verifier.verify(tampered)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
