import type { Request } from 'express';
import type { UserRole } from '../generated/prisma/enums';

export type AuthenticatedRequest = Request & {
  clerkUserId?: string;
  user?: {
    sub: number;
    role: UserRole;
    clerkUserId: string;
  };
};
