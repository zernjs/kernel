/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Wrap All Helpers
 * @description Helper functions for common wrap-all patterns like metrics, logging, and error handling
 */

import type {
  AutoTypedAllMethodsWrapperConfig,
  AutoTypedWrapperContext,
  MethodFilter,
} from './wrapper-types';

// Global performance API declaration for Node.js/Browser compatibility
declare const performance: {
  now(): number;
};

// ============================================================================
// METRICS HELPERS
// ============================================================================

export interface MetricsOptions<TPlugin> {
  readonly filter?: MethodFilter<TPlugin>;
  readonly logger?: (message: string) => void;
  readonly trackTiming?: boolean;
  readonly trackArgs?: boolean;
  readonly trackResults?: boolean;
}

export function createMetricsWrapper<TPlugin>(
  options: MetricsOptions<TPlugin> = {}
): AutoTypedAllMethodsWrapperConfig<TPlugin, { startTime: number }> {
  const {
    filter,
    logger = console.log,
    trackTiming = true,
    trackArgs = true,
    trackResults = true,
  } = options;

  return {
    wrapper: {
      before: (context): { shouldCallOriginal: true } => {
        const startTime = trackTiming ? performance.now() : 0;
        context.startTime = startTime;

        const argsStr = trackArgs ? ` with args: ${JSON.stringify(context.args)}` : '';
        logger(`📊 [METRICS] Starting ${context.pluginName}.${context.methodName}${argsStr}`);

        return { shouldCallOriginal: true };
      },

      after: <TMethod extends (...args: any[]) => any>(
        result: Awaited<ReturnType<TMethod>>,
        context: Omit<AutoTypedWrapperContext<TMethod, { startTime: number }>, 'args'>
      ): Awaited<ReturnType<TMethod>> => {
        if (trackTiming) {
          const endTime = performance.now();
          const startTime = context.startTime || endTime;
          const duration = endTime - startTime;
          logger(`📊 [METRICS] ${context.methodName} completed in ${duration.toFixed(2)}ms`);
        }

        if (trackResults) {
          logger(`📊 [METRICS] Result: ${JSON.stringify(result)}`);
        }

        return result;
      },
    },
    filter,
  };
}

// ============================================================================
// ERROR HANDLING HELPERS
// ============================================================================

export interface ErrorHandlingOptions<TPlugin> {
  readonly filter?: MethodFilter<TPlugin>;
  readonly logger?: (error: Error, context: any) => void;
  readonly onError?: (error: Error, context: any) => any;
  readonly retryCount?: number;
  readonly retryDelay?: number;
}

export function createErrorHandlingWrapper<TPlugin>(
  options: ErrorHandlingOptions<TPlugin> = {}
): AutoTypedAllMethodsWrapperConfig<TPlugin> {
  const {
    filter,
    logger = (error, context) => console.error(`🚨 [ERROR] ${context.methodName}:`, error),
    onError,
    retryCount = 0,
    retryDelay = 1000,
  } = options;

  return {
    wrapper: {
      around: async <TMethod extends (...args: any[]) => any>(
        context: AutoTypedWrapperContext<TMethod>
      ): Promise<{ shouldCallOriginal: false; overrideResult: ReturnType<TMethod> }> => {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= retryCount; attempt++) {
          try {
            const result = await context.originalMethod(...context.args);
            return { shouldCallOriginal: false, overrideResult: result };
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            logger(lastError, {
              methodName: context.methodName,
              pluginName: context.pluginName,
              args: context.args,
              attempt: attempt + 1,
            });

            if (attempt < retryCount) {
              console.log(
                `🔄 [ERROR] Retrying ${context.methodName} in ${retryDelay}ms (attempt ${attempt + 2}/${retryCount + 1})`
              );
              await new Promise((resolve): void => void setTimeout(resolve, retryDelay));
            }
          }
        }

        // All retries failed
        if (onError) {
          const fallbackResult = onError(lastError!, {
            methodName: context.methodName,
            pluginName: context.pluginName,
            args: context.args,
          });
          return { shouldCallOriginal: false, overrideResult: fallbackResult };
        }

        throw lastError;
      },
    },
    filter,
  };
}

// ============================================================================
// LOGGING HELPERS
// ============================================================================

export interface LoggingOptions<TPlugin> {
  readonly filter?: MethodFilter<TPlugin>;
  readonly logger?: (message: string) => void;
  readonly logLevel?: 'debug' | 'info' | 'warn' | 'error';
  readonly logBefore?: boolean;
  readonly logAfter?: boolean;
  readonly logArgs?: boolean;
  readonly logResults?: boolean;
  readonly logTiming?: boolean;
}

export function createLoggingWrapper<TPlugin>(
  options: LoggingOptions<TPlugin> = {}
): AutoTypedAllMethodsWrapperConfig<TPlugin> {
  const {
    filter,
    logger = console.log,
    logLevel = 'info',
    logBefore = true,
    logAfter = true,
    logArgs = true,
    logResults = true,
    logTiming = true,
  } = options;

  const logPrefix = `📝 [${logLevel.toUpperCase()}]`;

  return {
    wrapper: {
      before: logBefore
        ? (context): { shouldCallOriginal: true } => {
            const startTime = logTiming ? performance.now() : 0;
            (context as any).startTime = startTime;

            const argsStr = logArgs ? ` with args: ${JSON.stringify(context.args)}` : '';
            logger(`${logPrefix} Calling ${context.pluginName}.${context.methodName}${argsStr}`);

            return { shouldCallOriginal: true };
          }
        : undefined,

      after: logAfter
        ? <TMethod extends (...args: any[]) => any>(
            result: Awaited<ReturnType<TMethod>>,
            context: Omit<AutoTypedWrapperContext<TMethod>, 'args'>
          ): Awaited<ReturnType<TMethod>> => {
            let message = `${logPrefix} Completed ${context.pluginName}.${context.methodName}`;

            if (logTiming && (context as any).startTime) {
              const duration = performance.now() - (context as any).startTime;
              message += ` in ${duration.toFixed(2)}ms`;
            }

            if (logResults) {
              message += ` -> ${JSON.stringify(result)}`;
            }

            logger(message);
            return result;
          }
        : undefined,
    },
    filter,
  };
}

// ============================================================================
// CACHING HELPERS
// ============================================================================

export interface CachingOptions<TPlugin> {
  readonly filter?: MethodFilter<TPlugin>;
  readonly ttl?: number; // Time to live in milliseconds
  readonly maxSize?: number;
  readonly keyGenerator?: (methodName: string, args: readonly unknown[]) => string;
  readonly cache?: Map<string, { value: any; timestamp: number }>;
}

export function createCachingWrapper<TPlugin>(
  options: CachingOptions<TPlugin> = {}
): AutoTypedAllMethodsWrapperConfig<TPlugin> {
  const {
    filter,
    ttl = 60000, // 1 minute default
    maxSize = 1000,
    keyGenerator = (methodName, args) => `${methodName}:${JSON.stringify(args)}`,
    cache = new Map(),
  } = options;

  return {
    wrapper: {
      around: <TMethod extends (...args: any[]) => any>(
        context: AutoTypedWrapperContext<TMethod>
      ): { shouldCallOriginal: false; overrideResult: ReturnType<TMethod> } => {
        const key = keyGenerator(context.methodName, context.args);
        const cached = cache.get(key);
        const now = Date.now();

        // Check if cached value exists and is not expired
        if (cached && now - cached.timestamp < ttl) {
          console.log(`💾 [CACHE] Cache hit for ${context.methodName}`);
          return { shouldCallOriginal: false, overrideResult: cached.value };
        }

        console.log(`💾 [CACHE] Cache miss for ${context.methodName}`);

        // Call original method and cache result
        const result = context.originalMethod(...context.args);

        // Manage cache size
        if (cache.size >= maxSize) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }

        cache.set(key, { value: result, timestamp: now });

        return { shouldCallOriginal: false, overrideResult: result };
      },
    },
    filter,
  };
}

// ============================================================================
// AUDIT HELPERS
// ============================================================================

export interface AuditOptions<TPlugin> {
  readonly filter?: MethodFilter<TPlugin>;
  readonly logger?: (entry: AuditEntry) => void;
  readonly getUserContext?: () => { userId?: string; sessionId?: string; [key: string]: any };
  readonly includeResults?: boolean;
  readonly sensitiveArgs?: readonly string[]; // Argument names to mask
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly pluginName: string;
  readonly methodName: string;
  readonly args: readonly unknown[];
  result?: unknown;
  readonly userContext?: any;
  readonly duration?: number;
}

export function createAuditWrapper<TPlugin>(
  options: AuditOptions<TPlugin> = {}
): AutoTypedAllMethodsWrapperConfig<TPlugin> {
  const {
    filter,
    logger = entry => console.log(`📋 [AUDIT] ${JSON.stringify(entry)}`),
    getUserContext = () => ({}),
    includeResults = false,
    sensitiveArgs = [],
  } = options;

  const maskSensitiveData = (args: readonly unknown[]): readonly unknown[] => {
    if (sensitiveArgs.length === 0) return args;

    return args.map((arg, index): unknown => {
      if (
        sensitiveArgs.includes(String(index)) ||
        (typeof arg === 'object' &&
          arg !== null &&
          sensitiveArgs.some((key): boolean => key in arg))
      ) {
        return '[MASKED]';
      }
      return arg;
    });
  };

  return {
    wrapper: {
      before: (context): { shouldCallOriginal: true } => {
        (context as any).auditStartTime = performance.now();
        return { shouldCallOriginal: true };
      },

      after: <TMethod extends (...args: any[]) => any>(
        result: Awaited<ReturnType<TMethod>>,
        context: Omit<AutoTypedWrapperContext<TMethod>, 'args'>
      ): Awaited<ReturnType<TMethod>> => {
        const endTime = performance.now();
        const startTime = (context as any).auditStartTime || endTime;
        const duration = endTime - startTime;

        const auditEntry: AuditEntry = {
          timestamp: new Date().toISOString(),
          pluginName: context.pluginName,
          methodName: context.methodName,
          args: maskSensitiveData((context as any).args || []),
          userContext: getUserContext(),
          duration,
        };

        if (includeResults) {
          auditEntry.result = result;
        }

        logger(auditEntry);
        return result;
      },
    },
    filter,
  };
}

// ============================================================================
// COMBINED HELPERS
// ============================================================================

export interface MonitoringOptions<TPlugin> {
  readonly filter?: MethodFilter<TPlugin>;
  readonly enableMetrics?: boolean;
  readonly enableErrorHandling?: boolean;
  readonly enableLogging?: boolean;
  readonly enableAudit?: boolean;
  readonly logger?: (message: string) => void;
  readonly retryCount?: number;
  readonly retryDelay?: number;
  readonly onError?: (error: Error, context: any) => any;
}

export function createMonitoringWrapper<TPlugin>(
  options: MonitoringOptions<TPlugin> = {}
): AutoTypedAllMethodsWrapperConfig<TPlugin> {
  const {
    enableMetrics = true,
    enableErrorHandling = true,
    enableLogging = true,
    enableAudit = false,
    filter,
  } = options;

  return {
    wrapper: {
      before: (context): { shouldCallOriginal: true } => {
        const startTime = performance.now();
        (context as any).monitoringStartTime = startTime;

        if (enableLogging) {
          console.log(`🔍 [MONITOR] Starting ${context.pluginName}.${context.methodName}`);
        }

        if (enableAudit) {
          console.log(`📋 [AUDIT] Method call: ${context.pluginName}.${context.methodName}`);
        }

        return { shouldCallOriginal: true };
      },

      around: enableErrorHandling
        ? async <TMethod extends (...args: any[]) => any>(
            context: AutoTypedWrapperContext<TMethod>
          ): Promise<{ shouldCallOriginal: false; overrideResult: ReturnType<TMethod> }> => {
            try {
              const result = await context.originalMethod(...context.args);
              return { shouldCallOriginal: false, overrideResult: result };
            } catch (error) {
              console.error(`🚨 [MONITOR] Error in ${context.methodName}:`, error);
              throw error;
            }
          }
        : undefined,

      after: <TMethod extends (...args: any[]) => any>(
        result: Awaited<ReturnType<TMethod>>,
        context: Omit<AutoTypedWrapperContext<TMethod>, 'args'>
      ): Awaited<ReturnType<TMethod>> => {
        const endTime = performance.now();
        const startTime = (context as any).monitoringStartTime || endTime;
        const duration = endTime - startTime;

        if (enableMetrics) {
          console.log(`📊 [MONITOR] ${context.methodName} completed in ${duration.toFixed(2)}ms`);
        }

        if (enableLogging) {
          console.log(`🔍 [MONITOR] Completed ${context.pluginName}.${context.methodName}`);
        }

        return result;
      },
    },
    filter,
  };
}
