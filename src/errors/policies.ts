/**
 * @file Built-in error handling policies (logging, sentry, retry).
 */
import type { ErrorMeta, ErrorPolicy } from '@types';
import { retry, timeout, isPlainObject } from '@utils';

/**
 * Create a policy that logs errors using the provided logger.
 * @param logger - Target logger (must expose `.error`).
 * @returns ErrorPolicy that logs payload and metadata.
 */
export function logPolicy(logger: { error: (...args: unknown[]) => void }): ErrorPolicy {
  return (err: unknown, meta?: ErrorMeta): void => {
    const safe = isPlainObject(err) ? JSON.parse(JSON.stringify(err)) : err;
    logger.error('KernelError', { err: safe, meta });
  };
}

/**
 * Create a policy that forwards errors to Sentry-like SDK.
 * @param sdk - Object exposing `captureException(error, context?)`.
 * @returns ErrorPolicy that forwards payload and metadata.
 */
export function sentryPolicy(sdk: {
  captureException: (e: unknown, ctx?: Record<string, unknown>) => void;
}): ErrorPolicy {
  return (err: unknown, meta?: ErrorMeta): void => {
    const safe = isPlainObject(err) ? JSON.parse(JSON.stringify(err)) : err;
    sdk.captureException(safe, { meta } as Record<string, unknown>);
  };
}

/**
 * Create a retrying policy around another handler.
 * @param handler - Base handler to execute.
 * @param options - Retries, optional delay, and backoff configuration.
 * @returns ErrorPolicy that retries the handler according to options.
 */
export function retryPolicy(
  handler: (err: unknown, meta?: ErrorMeta) => Promise<void> | void,
  options: { retries: number; delayMs?: number; backoff?: { baseMs?: number; jitter?: number } }
): ErrorPolicy {
  return async (err: unknown, meta?: ErrorMeta): Promise<void> => {
    const exec = async (): Promise<void> => {
      if (options.delayMs && options.delayMs > 0) await timeout(Promise.resolve(), options.delayMs);
      await handler(err, meta);
    };
    await retry(exec, {
      retries: options.retries,
      baseMs: options.backoff?.baseMs,
      jitter: options.backoff?.jitter,
    });
  };
}
