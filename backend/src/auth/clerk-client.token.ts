import { createClerkClient } from '@clerk/backend';

export const CLERK_CLIENT = Symbol('CLERK_CLIENT');
export type ClerkBackendClient = ReturnType<typeof createClerkClient>;
