import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { UserRole } from '@prisma/client';
import { provisionLocalUser } from '../services/accountProvisioning.js';

interface DevelopmentCredentials {
  email: string;
  name: string;
  password: string;
}

async function loadCredentials(): Promise<DevelopmentCredentials> {
  const filePath = fileURLToPath(new URL('../../.local-admin-credentials.json', import.meta.url));
  const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object') throw new Error('Local admin credentials must be a JSON object.');
  const credentials = parsed as Record<string, unknown>;
  if (typeof credentials.email !== 'string' || typeof credentials.name !== 'string'
    || typeof credentials.password !== 'string' || credentials.password.length < 12) {
    throw new Error('Local admin credentials are incomplete or invalid.');
  }
  return {
    email: credentials.email,
    name: credentials.name,
    password: credentials.password,
  };
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The local development account cannot be provisioned in production.');
  }
  const credentials = await loadCredentials();
  const user = await provisionLocalUser({
    email: credentials.email,
    fullName: credentials.name,
    password: credentials.password,
    role: 'ADMIN' satisfies UserRole,
  });
  console.info(`Development administrator is ready: ${user.email}`);
}

main().catch((error: unknown) => {
  console.error('Could not provision the local development administrator.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
