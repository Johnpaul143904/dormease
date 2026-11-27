import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { UserWebhookEvent, WebhookEvent } from '@clerk/backend/webhooks';
import { PrismaService } from '../prisma/prisma.service';

type SyncedUserData = Extract<
  UserWebhookEvent,
  { type: 'user.created' | 'user.updated' }
>['data'];

type ClerkUserSnapshot = {
  clerkUserId: string;
  email: string | null;
  fullName: string | null;
  emailVerified: boolean;
  clerkUpdatedAt: Date;
};

type SyncResult =
  | { status: 'processed' }
  | { status: 'stale' }
  | { status: 'duplicate' }
  | { status: 'ignored' };

@Injectable()
export class ClerkWebhookService {
  private readonly logger = new Logger(ClerkWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async process(event: WebhookEvent, eventId: string): Promise<SyncResult> {
    if (
      event.type !== 'user.created' &&
      event.type !== 'user.updated' &&
      event.type !== 'user.deleted'
    ) {
      return { status: 'ignored' };
    }

    try {
      const eventAt = this.toDate(event.timestamp);
      const clerkUserId = event.data.id;
      if (!clerkUserId) {
        throw new Error('Clerk user webhook did not include a user ID');
      }

      const snapshot =
        event.type === 'user.deleted' ? null : this.toSnapshot(event.data);
      const clerkUpdatedAt = snapshot?.clerkUpdatedAt ?? eventAt;

      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${clerkUserId}, 0))
        `;

        await tx.clerkWebhookEvent.create({
          data: {
            eventId,
            clerkUserId,
            eventType: event.type,
            eventAt,
          },
        });

        const existing = await tx.clerkIdentity.findUnique({
          where: { clerkUserId },
        });
        if (existing?.deletedAt && event.type !== 'user.deleted') {
          return { status: 'stale' };
        }

        if (
          existing &&
          this.isOutOfOrder(
            clerkUpdatedAt,
            eventAt,
            existing.clerkUpdatedAt,
            existing.lastEventAt,
          )
        ) {
          return { status: 'stale' };
        }

        if (event.type === 'user.deleted') {
          await tx.clerkIdentity.upsert({
            where: { clerkUserId },
            create: {
              clerkUserId,
              email: null,
              fullName: null,
              emailVerified: false,
              clerkUpdatedAt,
              lastEventAt: eventAt,
              deletedAt: eventAt,
            },
            update: {
              clerkUpdatedAt,
              lastEventAt: eventAt,
              deletedAt: eventAt,
            },
          });
        } else if (snapshot) {
          await tx.clerkIdentity.upsert({
            where: { clerkUserId },
            create: {
              ...snapshot,
              lastEventAt: eventAt,
              deletedAt: null,
            },
            update: {
              email: snapshot.email,
              fullName: snapshot.fullName,
              emailVerified: snapshot.emailVerified,
              clerkUpdatedAt: snapshot.clerkUpdatedAt,
              lastEventAt: eventAt,
            },
          });
        }

        return { status: 'processed' };
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        try {
          const recordedEvent = await this.prisma.clerkWebhookEvent.findUnique({
            where: { eventId },
            select: { eventId: true },
          });
          if (recordedEvent) return { status: 'duplicate' };
        } catch (lookupError) {
          this.logProcessingError(lookupError);
          throw new InternalServerErrorException(
            'Clerk webhook processing failed',
          );
        }
      }

      this.logProcessingError(error);
      throw new InternalServerErrorException('Clerk webhook processing failed');
    }
  }

  private toSnapshot(user: SyncedUserData): ClerkUserSnapshot {
    const emailAddresses = Array.isArray(user.email_addresses)
      ? user.email_addresses
      : [];
    const primaryEmail = emailAddresses.find(
      (email) =>
        email.id === user.primary_email_address_id &&
        email.verification?.status === 'verified',
    );
    const fullName = [user.first_name, user.last_name]
      .filter((name): name is string => Boolean(name?.trim()))
      .join(' ')
      .trim();

    return {
      clerkUserId: user.id,
      email: primaryEmail?.email_address.trim().toLowerCase() ?? null,
      fullName: fullName || null,
      emailVerified: Boolean(primaryEmail),
      clerkUpdatedAt: this.toDate(user.updated_at),
    };
  }

  private toDate(timestamp: number): Date {
    if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
      throw new Error('Clerk webhook timestamp is invalid');
    }

    const milliseconds =
      timestamp < 100_000_000_000 ? timestamp * 1000 : timestamp;
    if (!Number.isSafeInteger(milliseconds)) {
      throw new Error('Clerk webhook timestamp is invalid');
    }

    const date = new Date(milliseconds);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Clerk webhook timestamp is invalid');
    }
    return date;
  }

  private isOutOfOrder(
    incomingUpdatedAt: Date,
    incomingEventAt: Date,
    storedUpdatedAt: Date | null,
    storedEventAt: Date,
  ) {
    if (!storedUpdatedAt) return incomingEventAt <= storedEventAt;
    if (incomingUpdatedAt < storedUpdatedAt) return true;
    return (
      incomingUpdatedAt.getTime() === storedUpdatedAt.getTime() &&
      incomingEventAt <= storedEventAt
    );
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private logProcessingError(error: unknown): void {
    const code = this.getSafeErrorCode(error);
    const stack =
      error instanceof Error
        ? error.stack
            ?.split('\n')
            .slice(1)
            .filter((line) => /^\s+at\s/.test(line))
            .join('\n')
        : undefined;

    this.logger.error(
      `Clerk webhook processing failed (code: ${code})`,
      stack || undefined,
    );
  }

  private getSafeErrorCode(error: unknown): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string' &&
      /^(?:P\d{4}|[0-9A-Z]{5})$/.test(error.code)
    ) {
      return error.code;
    }
    return 'unknown';
  }
}
