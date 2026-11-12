import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNLINKED_CLERK_USER_KEY = 'allowUnlinkedClerkUser';
export const AllowUnlinkedClerkUser = () =>
  SetMetadata(ALLOW_UNLINKED_CLERK_USER_KEY, true);
