import type { RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env, oidcEnabled } from '../config/env.js';
import { prisma } from '../config/db.js';
import type { UserRole } from '@prisma/client';

const validRoles = new Set<UserRole>(['ADMIN', 'OPERATOR', 'AUDITOR', 'MEMBER']);
const oidcJwks = oidcEnabled ? createRemoteJWKSet(new URL(env.OIDC_JWKS_URL!)) : null;
const sessionKey = Buffer.from(env.AUTH_JWT_SECRET, 'hex');

function readCookie(request: Parameters<RequestHandler>[0], cookieName: string) {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return cookie?.slice(cookieName.length + 1);
}

function readClaim(payload: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((value, part) => {
    return value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined;
  }, payload);
}

export const authenticate: RequestHandler = async (request, response, next) => {
  const bearer = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const sessionToken = readCookie(request, 'rpps_session');

  if (bearer) {
    if (!oidcJwks || !env.OIDC_ISSUER || !env.OIDC_AUDIENCE) {
      response.status(401).json({ error: 'Bearer-token authentication is not configured' });
      return;
    }
    try {
      const { payload } = await jwtVerify(bearer, oidcJwks, { issuer: env.OIDC_ISSUER, audience: env.OIDC_AUDIENCE });
      if (typeof payload.sub !== 'string') throw new Error('Token subject is missing');
      const claim = readClaim(payload, env.OIDC_ROLES_CLAIM);
      const roles = (Array.isArray(claim) ? claim : typeof claim === 'string' ? [claim] : [])
        .map((role) => String(role).toUpperCase())
        .filter((role): role is UserRole => validRoles.has(role as UserRole));
      request.authUser = {
        sub: payload.sub,
        ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
        ...(typeof payload.name === 'string' ? { name: payload.name } : {}),
        roles,
      };
      next();
    } catch {
      response.status(401).json({ error: 'Invalid or expired access token' });
    }
    return;
  }

  if (!sessionToken) {
    response.status(401).json({ error: 'Authentication required' });
    return;
  }
  let userId: string;
  try {
    const { payload } = await jwtVerify(sessionToken, sessionKey, {
      issuer: env.AUTH_JWT_ISSUER,
      audience: env.AUTH_JWT_AUDIENCE,
      algorithms: ['HS256'],
    });
    if (typeof payload.sub !== 'string') throw new Error('Session subject is missing');
    userId = payload.sub;
    if (typeof payload.sessionVersion !== 'number' || !Number.isInteger(payload.sessionVersion)) throw new Error('Session version is missing');
    request.sessionVersion = payload.sessionVersion;
  } catch {
    response.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, fullName: true, role: true, active: true, sessionVersion: true } });
    if (!user?.active || user.sessionVersion !== request.sessionVersion) {
      response.status(401).json({ error: 'Session is no longer active' });
      return;
    }
    request.authUser = { sub: user.id, email: user.email, name: user.fullName, roles: [user.role] };
    next();
  } catch (error) {
    next(error);
  }
};
