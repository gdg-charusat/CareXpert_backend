const SLOW_QUERY_THRESHOLD = 100;

// Prisma v5+ $extends query extension (replaces deprecated $use / Prisma.Middleware)
export const queryMonitoringExtension = {
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: {
        model: string;
        operation: string;
        args: unknown;
        query: (args: unknown) => Promise<unknown>;
      }) {
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
};
