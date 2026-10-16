import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  AUTH_JWT_SECRET: z.string().regex(/^[0-9a-fA-F]{64}$/),
  AUTH_JWT_ISSUER: z.string().default('rpps-censo-api'),
  AUTH_JWT_AUDIENCE: z.string().default('rpps-censo-web'),
  OIDC_ISSUER: z.string().url().optional(),
  OIDC_AUDIENCE: z.string().min(1).optional(),
  OIDC_JWKS_URL: z.string().url().optional(),
  OIDC_ROLES_CLAIM: z.string().default('roles'),
  PII_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  PII_LOOKUP_HMAC_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
});

export const env = schema.parse(process.env);
export const corsOrigins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
export const oidcEnabled = Boolean(env.OIDC_ISSUER && env.OIDC_AUDIENCE && env.OIDC_JWKS_URL);