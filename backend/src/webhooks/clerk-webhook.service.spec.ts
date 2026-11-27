import type { UserWebhookEvent, WebhookEvent } from '@clerk/backend/webhooks';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkWebhookService } from './clerk-webhook.service';

describe('ClerkWebhookService', () => {
  const tx = {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    clerkWebhookEvent: { create: jest.fn() },
    clerkIdentity: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
    clerkWebhookEvent: { findUnique: jest.fn() },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  let service: ClerkWebhookService;

  function userEvent(
    type: 'user.created' | 'user.updated',
    options: {
      id?: string;
      email?: string;
      updatedAt?: number;
      timestamp?: number;
      emailVerified?: boolean;
    } = {},
  ): UserWebhookEvent {
    const now = Date.now();
    const email = options.email ?? 'tenant@example.com';
    return {
      type,
      object: 'event',
      timestamp: options.timestamp ?? now,
      instance_id: 'ins_test',
      event_attributes: {
        http_request: { client_ip: '127.0.0.1', user_agent: 'test' },
      },
      data: {
        id: options.id ?? 'user_clerk_123',
        object: 'user',
        first_name: 'Tenant',
        last_name: 'Example',
        primary_email_address_id: 'email_primary',
        email_addresses: [
          {
            id: 'email_primary',
            object: 'email_address',
            email_address: email,
            verification:
              options.emailVerified === false
                ? null
                : {
                    status: 'verified',
                    strategy: 'email_code',
                    attempts: 1,
                    expire_at: null,
                  },
            linked_to: [],
          },
        ],
        username: null,
        image_url: '',
        has_image: false,
        primary_phone_number_id: null,
        primary_web3_wallet_id: null,
        password_enabled: true,
        two_factor_enabled: false,
        totp_enabled: false,
        backup_code_enabled: false,
        phone_numbers: [],
        web3_wallets: [],
        organization_memberships: null,
        external_accounts: [],
        enterprise_accounts: [],
        password_last_updated_at: null,
        public_metadata: { role: 'ADMIN', accountType: 'ADMIN' },
        private_metadata: {},
        unsafe_metadata: {},
        external_id: null,
        last_sign_in_at: null,
        banned: false,
        locked: false,
        deprovisioned: false,
        lockout_expires_in_seconds: null,
        verification_attempts_remaining: null,
        created_at: now - 1000,
        updated_at: options.updatedAt ?? now,
        last_active_at: null,
        create_organization_enabled: false,
        create_organizations_limit: null,
        delete_self_enabled: true,
        legal_accepted_at: null,
        locale: null,
        timezone: null,
      },
    } as UserWebhookEvent;
  }

  function deletedEvent(id = 'user_clerk_123', timestamp = Date.now()) {
    return {
      type: 'user.deleted',
      object: 'event',
      timestamp,
      instance_id: 'ins_test',
      event_attributes: {
        http_request: { client_ip: '127.0.0.1', user_agent: 'test' },
      },
      data: { id, object: 'user', deleted: true },
    } as WebhookEvent;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );
    tx.$executeRaw.mockResolvedValue(1);
    tx.clerkWebhookEvent.create.mockResolvedValue({});
    tx.clerkIdentity.findUnique.mockResolvedValue(null);
    tx.clerkIdentity.upsert.mockResolvedValue({});
    service = new ClerkWebhookService(prisma as unknown as PrismaService);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['email/password', 'user_email_123', 'email@example.com'],
    ['Google', 'user_google_123', 'google@example.com'],
  ])(
    'syncs a %s identity without provisioning a DormEase role',
    async (_provider, clerkUserId, email) => {
      const event = userEvent('user.created', {
        id: clerkUserId,
        email,
      });

      await expect(
        service.process(event, `msg_${clerkUserId}`),
      ).resolves.toEqual({
        status: 'processed',
      });

      expect(tx.clerkIdentity.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clerkUserId },
          create: expect.objectContaining({
            clerkUserId,
            email,
            emailVerified: true,
            fullName: 'Tenant Example',
          }),
        }),
      );
      expect(
        tx.clerkIdentity.upsert.mock.calls[0][0].create,
      ).not.toHaveProperty('role');
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.clerkWebhookEvent.create.mock.invocationCallOrder[0],
      );
    },
  );

  it('normalizes second-based timestamps and accepts empty email_addresses', async () => {
    const timestamp = 1_700_000_000;
    const originalEvent = userEvent('user.created');
    const event = {
      ...originalEvent,
      timestamp,
      data: {
        ...originalEvent.data,
        primary_email_address_id: null,
        email_addresses: [],
        updated_at: timestamp + 2,
      },
    } as UserWebhookEvent;

    await expect(
      service.process(event, 'msg_empty_email_addresses'),
    ).resolves.toEqual({ status: 'processed' });

    expect(tx.clerkWebhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventAt: new Date(timestamp * 1000),
        }),
      }),
    );
    expect(tx.clerkIdentity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          email: null,
          emailVerified: false,
          clerkUpdatedAt: new Date((timestamp + 2) * 1000),
          lastEventAt: new Date(timestamp * 1000),
        }),
      }),
    );
  });

  it('does not store an unverified primary email', async () => {
    const event = userEvent('user.created', { emailVerified: false });

    await service.process(event, 'msg_unverified_email');

    expect(tx.clerkIdentity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          email: null,
          emailVerified: false,
        }),
      }),
    );
  });

  it('does not link or overwrite a DormEase account with a matching email', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 9,
      email: 'tenant@example.com',
      clerkUserId: 'user_old_identity',
      role: 'ADMIN',
    });

    await service.process(userEvent('user.created'), 'msg_conflicting_email');

    expect(tx.clerkIdentity.upsert).toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('records and ignores duplicate webhook event IDs', async () => {
    const event = userEvent('user.created');
    tx.clerkWebhookEvent.create
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ code: 'P2002' });
    prisma.clerkWebhookEvent.findUnique.mockResolvedValue({
      eventId: 'msg_duplicate',
    });

    await service.process(event, 'msg_duplicate');
    await expect(service.process(event, 'msg_duplicate')).resolves.toEqual({
      status: 'duplicate',
    });

    expect(tx.clerkIdentity.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.clerkWebhookEvent.findUnique).toHaveBeenCalledWith({
      where: { eventId: 'msg_duplicate' },
      select: { eventId: true },
    });
  });

  it('does not apply an older update after a newer Clerk snapshot', async () => {
    const event = userEvent('user.updated', {
      updatedAt: 1_700_000_000_000,
      timestamp: 1_700_000_000_001,
    });
    tx.clerkIdentity.findUnique.mockResolvedValue({
      clerkUpdatedAt: new Date(1_700_000_001_000),
      lastEventAt: new Date(1_700_000_001_001),
      deletedAt: null,
    });

    await expect(service.process(event, 'msg_stale')).resolves.toEqual({
      status: 'stale',
    });
    expect(tx.clerkIdentity.upsert).not.toHaveBeenCalled();
  });

  it('soft-deletes the synchronized identity without deleting DormEase records', async () => {
    const deletedAt = Date.now();
    tx.clerkIdentity.findUnique.mockResolvedValue({
      clerkUpdatedAt: new Date(deletedAt - 1000),
      lastEventAt: new Date(deletedAt - 900),
      deletedAt: null,
    });

    await expect(
      service.process(deletedEvent('user_clerk_123', deletedAt), 'msg_deleted'),
    ).resolves.toEqual({ status: 'processed' });
    expect(tx.clerkIdentity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          deletedAt: new Date(deletedAt),
        }),
      }),
    );
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it('never restores an identity after a deletion tombstone', async () => {
    tx.clerkIdentity.findUnique.mockResolvedValue({
      clerkUpdatedAt: new Date(Date.now() - 1000),
      lastEventAt: new Date(Date.now() - 500),
      deletedAt: new Date(Date.now() - 500),
    });

    await expect(
      service.process(userEvent('user.updated'), 'msg_after_delete'),
    ).resolves.toEqual({ status: 'stale' });
    expect(tx.clerkIdentity.upsert).not.toHaveBeenCalled();
  });

  it('ignores non-user event types', async () => {
    const event = {
      type: 'session.created',
      object: 'event',
      data: { id: 'sess_test' },
      timestamp: Date.now(),
      instance_id: 'ins_test',
      event_attributes: {
        http_request: { client_ip: '127.0.0.1', user_agent: 'test' },
      },
    } as WebhookEvent;

    await expect(service.process(event, 'msg_session')).resolves.toEqual({
      status: 'ignored',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('logs only safe error codes and stack frames before returning a generic error', async () => {
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const databaseError = Object.assign(
      new Error('Failure contains private@example.com'),
      { code: 'P2010' },
    );
    tx.$executeRaw.mockRejectedValueOnce(databaseError);

    await expect(
      service.process(userEvent('user.created'), 'msg_database_error'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    const logged = JSON.stringify(logger.mock.calls);
    expect(logged).toContain('P2010');
    expect(logged).toContain('clerk-webhook.service.spec.ts');
    expect(logged).not.toContain('private@example.com');
  });
});
