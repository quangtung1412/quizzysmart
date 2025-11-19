/**
 * Prisma Client singleton
 * Separated to avoid circular dependency issues
 */

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Any-cast for newly added models if type generation not up-to-date
export const prismaAny = prisma as any;
