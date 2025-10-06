/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Error Boundary Plugin Example
 * Demonstrates how to create an error boundary that catches errors and returns fallback values
 */

import { plugin, type ProxyContext } from '../../src';

export interface ErrorBoundaryOptions {
  fallback?: Record<string, unknown>;
  onError?: (error: Error, ctx: ProxyContext<any, any>) => void;
  defaultFallbacks?: boolean;
}

export function createErrorBoundaryPlugin(options: ErrorBoundaryOptions) {
  const { fallback = {}, onError, defaultFallbacks = true } = options;
  const caughtErrors: Array<{ plugin: string; method: string; error: Error; timestamp: Date }> = [];

  return plugin('error-boundary', '1.0.0')
    .proxy('**', {
      around: async (ctx, next) => {
        try {
          return await next();
        } catch (error) {
          caughtErrors.push({
            plugin: ctx.plugin,
            method: ctx.method,
            error: error as Error,
            timestamp: new Date(),
          });

          if (onError) {
            onError(error as Error, ctx);
          }

          console.warn(
            `[ERROR BOUNDARY] Caught error in ${ctx.plugin}.${ctx.method}:`,
            (error as Error).message
          );

          const fallbackKey = `${ctx.plugin}.${ctx.method}`;
          if (fallbackKey in fallback) {
            console.log(`[ERROR BOUNDARY] Returning configured fallback for ${fallbackKey}`);
            return fallback[fallbackKey];
          }

          if (defaultFallbacks) {
            if (ctx.method.startsWith('get')) {
              console.log(`[ERROR BOUNDARY] Returning null for get method`);
              return null;
            }
            if (ctx.method.startsWith('is') || ctx.method.startsWith('has')) {
              console.log(`[ERROR BOUNDARY] Returning false for boolean method`);
              return false;
            }
            if (ctx.method.startsWith('list') || ctx.method.startsWith('find')) {
              console.log(`[ERROR BOUNDARY] Returning empty array for list method`);
              return [];
            }
          }

          throw error;
        }
      },
    })
    .setup(() => ({
      getErrors: () => caughtErrors,
      clearErrors: () => {
        caughtErrors.length = 0;
      },
      getErrorCount: () => caughtErrors.length,
      getRecentErrors: (count = 10) => caughtErrors.slice(-count),
    }));
}
