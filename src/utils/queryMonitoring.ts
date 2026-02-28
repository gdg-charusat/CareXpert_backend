import { Prisma } from "@prisma/client";

const SLOW_QUERY_THRESHOLD = 100;

export const queryMonitoringExtension = Prisma.defineExtension({
  name: "queryMonitoring",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const before = Date.now();
        const result = await query(args);
        const after = Date.now();
        const duration = after - before;

        if (duration > SLOW_QUERY_THRESHOLD) {
          console.warn(`[SLOW QUERY] ${duration}ms - ${model}.${operation}`, {
            args: JSON.stringify(args).slice(0, 200),
          });
        }

        return result;
      },
    },
  },
});

