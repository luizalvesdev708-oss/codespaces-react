import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      authUser?: { sub: string; email?: string; name?: string; roles: UserRole[] };
      sessionVersion?: number;
    }
  }
}

export {};