/**
 * @file Wrapper helper utilities
 * @description Provides convenient functions for creating common wrapper patterns
 */

import type { WrapperConfig, WrapperContext, WrapperResult } from './wrapper-types';

// Helper function to get current time with fallback
function getCurrentTime(): number {
  // eslint-disable-next-line no-undef
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

// Helper to create a simple before wrapper
export function createBeforeWrapper<TArgs extends readonly unknown[], TReturn>(
  beforeFn: (
    args: TArgs,
    context: Omit<WrapperContext<TArgs, TReturn>, 'args'>
  ) => void | Promise<void>
): WrapperConfig {
  return {
    before: async (context): Promise<WrapperResult> => {
      await beforeFn(context.args as TArgs, {
        pluginName: context.pluginName,
        methodName: context.methodName,
        originalMethod: context.originalMethod as (...args: TArgs) => TReturn,
      });
      return { shouldCallOriginal: true };
    },
  };
}

// Helper to create a simple after wrapper
export function createAfterWrapper<TReturn>(
  afterFn: (
    result: TReturn,
    context: { pluginName: string; methodName: string }
  ) => TReturn | Promise<TReturn>
): WrapperConfig {
  return {
    after: async (originalResult, context): Promise<TReturn> => {
      return await afterFn(originalResult as TReturn, {
        pluginName: context.pluginName,
        methodName: context.methodName,
      });
    },
  };
}

// Helper to create a logging wrapper
export function createLoggingWrapper(
  options: {
    logBefore?: boolean;
    logAfter?: boolean;
    logArgs?: boolean;
    logResult?: boolean;
    logger?: (message: string) => void;
  } = {}
): WrapperConfig {
  const {
    logBefore = true,
    logAfter = true,
    logArgs = true,
    logResult = true,
    logger = console.log,
  } = options;

  return {
    before: logBefore
      ? (context): WrapperResult => {
          const argsStr = logArgs ? ` with args: ${JSON.stringify(context.args)}` : '';
          logger(`[${context.pluginName}] Calling ${context.methodName}${argsStr}`);
          return { shouldCallOriginal: true };
        }
      : undefined,
    after: logAfter
      ? (result, context): unknown => {
          const resultStr = logResult ? ` -> ${JSON.stringify(result)}` : '';
          logger(`[${context.pluginName}] Completed ${context.methodName}${resultStr}`);
          return result;
        }
      : undefined,
  };
}

// Helper to create a validation wrapper
export function createValidationWrapper<TArgs extends readonly unknown[]>(
  validator: (args: TArgs) => boolean | string,
  errorMessage?: string
): WrapperConfig {
  return {
    before: async (context): Promise<WrapperResult> => {
      const validationResult = validator(context.args as TArgs);

      if (validationResult === false) {
        throw new Error(errorMessage || `Validation failed for ${context.methodName}`);
      }

      if (typeof validationResult === 'string') {
        throw new Error(validationResult);
      }

      return { shouldCallOriginal: true };
    },
  };
}

// Helper to create a retry wrapper
export function createRetryWrapper(
  options: {
    maxRetries?: number;
    delay?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): WrapperConfig {
  const { maxRetries = 3, delay = 1000, shouldRetry = (): boolean => true } = options;

  return {
    around: async (context): Promise<WrapperResult> => {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await context.originalMethod(...context.args);
          return { shouldCallOriginal: false, overrideResult: result };
        } catch (error) {
          lastError = error as Error;

          if (attempt === maxRetries || !shouldRetry(lastError)) {
            throw lastError;
          }

          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError;
    },
  };
}

// Helper to create a caching wrapper
export function createCachingWrapper<TArgs extends readonly unknown[], TReturn>(
  options: {
    keyGenerator?: (args: TArgs) => string;
    ttl?: number; // Time to live in milliseconds
    cache?: Map<string, { value: TReturn; timestamp: number }>;
  } = {}
): WrapperConfig {
  const {
    keyGenerator = (args): string => JSON.stringify(args),
    ttl = 60000, // 1 minute default
    cache = new Map(),
  } = options;

  return {
    around: async (context): Promise<WrapperResult> => {
      const key = keyGenerator(context.args as TArgs);
      const cached = cache.get(key);

      // Check if cached value exists and is not expired
      if (cached && Date.now() - cached.timestamp < ttl) {
        return { shouldCallOriginal: false, overrideResult: cached.value };
      }

      // Call original method and cache result
      const result = await context.originalMethod(...context.args);
      cache.set(key, { value: result, timestamp: Date.now() });

      return { shouldCallOriginal: false, overrideResult: result };
    },
  };
}

// Helper to create a timing wrapper
export function createTimingWrapper(
  onTiming?: (duration: number, methodName: string, pluginName: string) => void
): WrapperConfig {
  return {
    around: async (context): Promise<WrapperResult> => {
      const startTime = getCurrentTime();

      try {
        const result = await context.originalMethod(...context.args);
        const duration = getCurrentTime() - startTime;

        if (onTiming) {
          onTiming(duration, context.methodName, context.pluginName);
        } else {
          console.log(
            `[${context.pluginName}] ${context.methodName} took ${duration.toFixed(2)}ms`
          );
        }

        return { shouldCallOriginal: false, overrideResult: result };
      } catch (error) {
        const duration = getCurrentTime() - startTime;

        if (onTiming) {
          onTiming(duration, context.methodName, context.pluginName);
        }

        throw error;
      }
    },
  };
}

// Helper to create a transformation wrapper
export function createTransformWrapper<TNewReturn>(
  transformer: (result: unknown) => Promise<TNewReturn>
): WrapperConfig {
  return {
    after: async (result): Promise<TNewReturn> => {
      return await transformer(result);
    },
  };
}

// Helper to combine multiple wrappers
export function combineWrappers(...wrappers: WrapperConfig[]): WrapperConfig {
  const beforeWrappers = wrappers.filter(w => w.before);
  const afterWrappers = wrappers.filter(w => w.after);
  const aroundWrappers = wrappers.filter(w => w.around);

  if (aroundWrappers.length > 1) {
    throw new Error('Cannot combine multiple around wrappers');
  }

  return {
    before:
      beforeWrappers.length > 0
        ? async (context): Promise<WrapperResult> => {
            for (const wrapper of beforeWrappers) {
              const result = await wrapper.before!(context);
              if (!result.shouldCallOriginal) {
                return result;
              }
            }
            return { shouldCallOriginal: true };
          }
        : undefined,
    after:
      afterWrappers.length > 0
        ? async (result, context): Promise<unknown> => {
            let currentResult = result;
            for (const wrapper of afterWrappers) {
              currentResult = await wrapper.after!(currentResult, context);
            }
            return currentResult;
          }
        : undefined,
    around: aroundWrappers[0]?.around,
  };
}
