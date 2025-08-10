import type { ErrorMeta, ErrorPolicy } from '@types';
import { retry, timeout, isPlainObject } from '@utils';

export function logPolicy(logger: { error: (...args: unknown[]) => void }): ErrorPolicy {
  return (err: unknown, meta?: ErrorMeta): void => {
    const safe = isPlainObject(err) ? JSON.parse(JSON.stringify(err)) : err;
    logger.error('KernelError', { err: safe, meta });
  };
}

export function sentryPolicy(sdk: {
  captureException: (e: unknown, ctx?: Record<string, unknown>) => void;
}): ErrorPolicy {
  return (err: unknown, meta?: ErrorMeta): void => {
    const safe = isPlainObject(err) ? JSON.parse(JSON.stringify(err)) : err;
    sdk.captureException(safe, { meta } as Record<string, unknown>);
  };
}

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
