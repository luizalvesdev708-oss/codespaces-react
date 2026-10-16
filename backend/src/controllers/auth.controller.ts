import type { RequestHandler } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { hashPassword, verifyPassword } from '../config/password.js';

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLocaleLowerCase('en-US')),
  password: z.string().min(1).max(128),
});
const sessionKey = Buffer.from(env.AUTH_JWT_SECRET, 'hex');
const cookieName = 'rpps_session';
const sessionDurationSeconds = 8 * 60 * 60;
const dummyPasswordHash = hashPassword('not-a-real-user-password');

export const login: RequestHandler = async (request, response, next) => {
  try {
    const { email, password } = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email } });
    const passwordHash = user?.passwordHash ?? await dummyPasswordHash;
    const passwordMatches = await verifyPassword(password, passwordHash);
    if (!user || !user.active || !user.passwordHash || !passwordMatches) {
      response.status(401).json({ error: 'E-mail ou senha inválidos.' });
      return;
    }

    const token = await new SignJWT({ email: user.email, name: user.fullName, role: user.role, sessionVersion: user.sessionVersion })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.id)
      .setIssuer(env.AUTH_JWT_ISSUER)
      .setAudience(env.AUTH_JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${sessionDurationSeconds}s`)
      .sign(sessionKey);

    response.cookie(cookieName, token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: sessionDurationSeconds * 1000,
    });
    response.json({ sub: user.id, email: user.email, name: user.fullName, roles: [user.role] });
  } catch (error) {
    next(error);
  }
};

export const currentUser: RequestHandler = (request, response) => {
  response.json({ sub: request.authUser?.sub, email: request.authUser?.email, name: request.authUser?.name, roles: request.authUser?.roles ?? [] });
};

export const logout: RequestHandler = async (request, response, next) => {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  let userId: string | undefined;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, sessionKey, {
        issuer: env.AUTH_JWT_ISSUER,
        audience: env.AUTH_JWT_AUDIENCE,
        algorithms: ['HS256'],
      });
      if (typeof payload.sub === 'string') userId = payload.sub;
    } catch {
      // An expired or malformed token still needs its browser cookie cleared.
    }
  }
  if (userId) {
    try {
      await prisma.user.updateMany({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
    } catch (error) {
      next(error);
      return;
    }
  }
  response.clearCookie(cookieName, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  response.status(204).end();
};