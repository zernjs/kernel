/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Retry Plugin Example
 * Demonstrates how to create a retry plugin with exponential backoff
 */

import { plugin } from '../../src';

export interface RetryOptions {
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

export function createRetryPlugin(options: RetryOptions) {
  let retryCount = 0;
  let successAfterRetry = 0;

  return plugin('retry', '1.0.0')
    .proxy('**', {
      around: async (ctx, next) => {
        let attempt = 0;
        let lastError: Error | null = null;

        while (attempt < options.maxAttempts) {
          try {
            const result = await next();
            if (attempt > 0) {
              successAfterRetry++;
            }
            return result;
          } catch (error) {
            attempt++;
            lastError = error as Error;
            retryCount++;

            if (attempt >= options.maxAttempts) {
              throw error;
            }

            if (options.shouldRetry && !options.shouldRetry(error as Error)) {
              throw error;
            }

            const delay =
              options.backoff === 'exponential' ? Math.pow(2, attempt) * 1000 : attempt * 1000;

            if (options.onRetry) {
              options.onRetry(attempt, error as Error);
            }

            console.log(
              `[RETRY] Attempt ${attempt}/${options.maxAttempts} failed for ${ctx.plugin}.${ctx.method}. Retrying in ${delay}ms...`
            );

            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        throw lastError;
      },
    })
    .setup(() => ({
      getStats: () => ({
        totalRetries: retryCount,
        successAfterRetry,
      }),
      resetStats: () => {
        retryCount = 0;
        successAfterRetry = 0;
      },
    }));
}
