import { PrismaClient } from "@prisma/client";

// Note: query monitoring via $extends is available in queryMonitoring.ts
// but is not applied here to preserve Prisma.TransactionClient compatibility
// in $transaction callbacks throughout the codebase.
const prisma = new PrismaClient();

export default prisma;
