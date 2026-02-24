import { PrismaClient } from "@prisma/client";
import { queryMonitoringMiddleware } from './queryMonitoring';

const prisma: PrismaClient = new PrismaClient();

prisma.$use(queryMonitoringMiddleware);

export default prisma;
