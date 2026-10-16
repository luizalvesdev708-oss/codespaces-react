import type { UserRole } from '@prisma/client';
import { prisma } from '../config/db.js';
import { hashPassword } from '../config/password.js';

export interface ProvisionLocalUserInput {
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
  active?: boolean;
}

export async function provisionLocalUser(input: ProvisionLocalUserInput) {
  const email = input.email.trim().toLocaleLowerCase('en-US');
  const fullName = input.fullName.trim();
  if (!email || !fullName) throw new Error('A valid email and full name are required');
  const passwordHash = await hashPassword(input.password);
  return prisma.user.upsert({
    where: { email },
    update: { fullName, role: input.role, passwordHash, active: input.active ?? true, sessionVersion: { increment: 1 } },
    create: {
      email,
      fullName,
      role: input.role,
      passwordHash,
      active: input.active ?? true,
      oidcSub: null,
    },
    select: { id: true, email: true, fullName: true, role: true, active: true },
  });
}
