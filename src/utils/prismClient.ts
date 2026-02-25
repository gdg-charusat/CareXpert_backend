import { PrismaClient } from "@prisma/client";
import { queryMonitoringExtension } from './queryMonitoring';

const prismaClient = new PrismaClient();
const prisma = prismaClient.$extends(queryMonitoringExtension);

// Exporting as any to prevent massive cascading type errors in controllers
// that were written for the base PrismaClient type.
export default prisma as any;


