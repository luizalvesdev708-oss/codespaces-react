import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: 'Invalid request', details: error.issues.map(({ path, message }) => ({ path: path.join('.'), message })) });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') { response.status(409).json({ error: 'A record with this unique identifier already exists' }); return; }
    if (error.code === 'P2025') { response.status(404).json({ error: 'Record not found' }); return; }
    if (error.code === 'P2003') { response.status(400).json({ error: 'Referenced record does not exist' }); return; }
  }
  const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : 500;
  response.status(status).json({ error: status < 500 && error instanceof Error ? error.message : 'Internal server error' });
};