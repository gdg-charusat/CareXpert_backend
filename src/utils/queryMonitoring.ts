import { Prisma } from '@prisma/client';

const SLOW_QUERY_THRESHOLD = 100; // ms

export const queryMonitoringMiddleware: Prisma.Middleware = async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  const duration = after - before;

  if (duration > SLOW_QUERY_THRESHOLD) {
    console.warn(`[SLOW QUERY] ${duration}ms - ${params.model}.${params.action}`, {
      args: JSON.stringify(params.args).slice(0, 200),
    });
  }

  return result;
};
