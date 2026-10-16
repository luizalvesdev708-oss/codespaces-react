import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';

export const requireRoles = (...allowed: UserRole[]): RequestHandler => (request, response, next) => {
  if (!request.authUser || !allowed.some((role) => request.authUser?.roles.includes(role))) {
    response.status(403).json({ error: 'Insufficient permissions' });
    return;
  }
  next();
};