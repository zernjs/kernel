/**
 * Error Middleware
 * Middleware system for intercepting and processing errors
 */

import { EventEmitter } from 'events';
import { ZernError } from '../types/base.js';
import { ErrorUtils } from '../utils/error-utils.js';

/**
 * Error middleware function type
 */
export type ErrorMiddlewareFunction = (
  error: Error | ZernError,
  context: ErrorMiddlewareContext,
  next: (error?: Error | ZernError) => void
) => void | Promise<void>;

/**
 * Error middleware context
 */
export interface ErrorMiddlewareContext {
  /** Original error before any transformations */
  originalError: Error | ZernError;
  /** Request/operation context */
  requestContext?: Record<string, unknown>;
  /** Plugin context */
  pluginContext?: {
    pluginId: string;
    version: string;
    phase: string;
  };
  /** User context */
  userContext?: {
    userId?: string;
    sessionId?: string;
    permissions?: string[];
  };
  /** System context */
  systemContext?: {
    platform: string;
    version: string;
    environment: string;
    timestamp: number;
  };
  /** Custom metadata */
  metadata: Record<string, unknown>;
  /** Middleware execution state */
  state: {
    processed: boolean;
    transformed: boolean;
    handled: boolean;
    recovered: boolean;
  };
}

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /** Enable middleware system */
  enabled: boolean;
  /** Maximum execution time for middleware chain */
  timeout: number;
  /** Continue on middleware errors */
  continueOnError: boolean;
  /** Enable middleware metrics */
  enableMetrics: boolean;
  /** Maximum middleware chain length */
  maxChainLength: number;
}

/**
 * Middleware execution metrics
 */
export interface MiddlewareMetrics {
  /** Total executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
  /** Average execution time */
  averageExecutionTime: number;
  /** Middleware performance stats */
  middlewareStats: Map<
    string,
    {
      executions: number;
      totalTime: number;
      errors: number;
    }
  >;
}

/**
 * Error middleware manager
 */
export class ErrorMiddleware extends EventEmitter {
  private middlewares: Array<{
    name: string;
    fn: ErrorMiddlewareFunction;
    priority: number;
    enabled: boolean;
  }> = [];

  private config: MiddlewareConfig;
  private metrics: MiddlewareMetrics;

  constructor(config: Partial<MiddlewareConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      timeout: 5000,
      continueOnError: true,
      enableMetrics: true,
      maxChainLength: 20,
      ...config,
    };

    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      middlewareStats: new Map(),
    };

    this.setupBuiltinMiddlewares();
  }

  /**
   * Add middleware to the chain
   */
  use(name: string, middleware: ErrorMiddlewareFunction, priority: number = 0): void {
    if (this.middlewares.length >= this.config.maxChainLength) {
      throw new Error(`Maximum middleware chain length (${this.config.maxChainLength}) exceeded`);
    }

    // Remove existing middleware with same name
    this.remove(name);

    this.middlewares.push({
      name,
      fn: middleware,
      priority,
      enabled: true,
    });

    // Sort by priority (higher priority first)
    this.middlewares.sort((a, b) => b.priority - a.priority);

    this.emit('middlewareAdded', { name, priority });
  }

  /**
   * Remove middleware from the chain
   */
  remove(name: string): boolean {
    const index = this.middlewares.findIndex(m => m.name === name);
    if (index !== -1) {
      this.middlewares.splice(index, 1);
      this.emit('middlewareRemoved', { name });
      return true;
    }
    return false;
  }

  /**
   * Enable/disable specific middleware
   */
  setEnabled(name: string, enabled: boolean): boolean {
    const middleware = this.middlewares.find(m => m.name === name);
    if (middleware) {
      middleware.enabled = enabled;
      this.emit('middlewareToggled', { name, enabled });
      return true;
    }
    return false;
  }

  /**
   * Process error through middleware chain
   */
  async process(
    error: Error | ZernError,
    context: Partial<ErrorMiddlewareContext> = {}
  ): Promise<Error | ZernError> {
    if (!this.config.enabled) {
      return error;
    }

    const startTime = Date.now();
    this.metrics.totalExecutions++;

    const fullContext: ErrorMiddlewareContext = {
      originalError: error,
      requestContext: {},
      ...(context.pluginContext && { pluginContext: context.pluginContext }),
      ...(context.userContext && { userContext: context.userContext }),
      systemContext: {
        platform: typeof window !== 'undefined' ? 'browser' : 'node',
        version: process?.version || 'unknown',
        environment: process?.env?.NODE_ENV || 'unknown',
        timestamp: Date.now(),
      },
      metadata: {},
      state: {
        processed: false,
        transformed: false,
        handled: false,
        recovered: false,
      },
      ...context,
    };

    let currentError = error;
    const enabledMiddlewares = this.middlewares.filter(m => m.enabled);

    try {
      await this.executeMiddlewareChain(currentError, fullContext, enabledMiddlewares);

      this.metrics.successfulExecutions++;
      this.updateAverageExecutionTime(Date.now() - startTime);

      this.emit('processingComplete', {
        originalError: error,
        processedError: currentError,
        context: fullContext,
        executionTime: Date.now() - startTime,
      });

      return currentError;
    } catch (middlewareError) {
      this.metrics.failedExecutions++;

      this.emit('processingError', {
        originalError: error,
        middlewareError,
        context: fullContext,
      });

      if (this.config.continueOnError) {
        return currentError;
      } else {
        throw middlewareError;
      }
    }
  }

  /**
   * Execute middleware chain
   */
  private async executeMiddlewareChain(
    error: Error | ZernError,
    context: ErrorMiddlewareContext,
    middlewares: Array<{
      name: string;
      fn: ErrorMiddlewareFunction;
      priority: number;
      enabled: boolean;
    }>
  ): Promise<void> {
    let currentError = error;
    let index = 0;

    const next = async (nextError?: Error | ZernError): Promise<void> => {
      if (nextError) {
        currentError = nextError;
        context.state.transformed = true;
      }

      if (index >= middlewares.length) {
        return;
      }

      const middleware = middlewares[index++];
      if (!middleware) {
        return;
      }
      const startTime = Date.now();

      try {
        await Promise.race([
          this.executeMiddleware(middleware, currentError, context, next),
          this.createTimeoutPromise(middleware.name),
        ]);

        // Update middleware stats
        if (this.config.enableMetrics) {
          this.updateMiddlewareStats(middleware.name, Date.now() - startTime, false);
        }
      } catch (middlewareError) {
        if (this.config.enableMetrics) {
          this.updateMiddlewareStats(middleware.name, Date.now() - startTime, true);
        }

        this.emit('middlewareError', {
          middlewareName: middleware.name,
          error: middlewareError,
          originalError: currentError,
          context,
        });

        if (!this.config.continueOnError) {
          throw middlewareError;
        }

        // Continue with next middleware
        await next();
      }
    };

    await next();
    context.state.processed = true;
  }

  /**
   * Execute single middleware
   */
  private async executeMiddleware(
    middleware: { name: string; fn: ErrorMiddlewareFunction },
    error: Error | ZernError,
    context: ErrorMiddlewareContext,
    next: (error?: Error | ZernError) => Promise<void>
  ): Promise<void> {
    const result = middleware.fn(error, context, (nextError?: Error | ZernError) => {
      next(nextError).catch(err => {
        this.emit('middlewareError', {
          middlewareName: middleware.name,
          error: err,
          originalError: error,
          context,
        });
      });
    });

    if (result instanceof Promise) {
      await result;
    }
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(middlewareName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(`Middleware '${middlewareName}' timed out after ${this.config.timeout}ms`)
        );
      }, this.config.timeout);
    });
  }

  /**
   * Update middleware statistics
   */
  private updateMiddlewareStats(name: string, executionTime: number, isError: boolean): void {
    let stats = this.metrics.middlewareStats.get(name);
    if (!stats) {
      stats = { executions: 0, totalTime: 0, errors: 0 };
      this.metrics.middlewareStats.set(name, stats);
    }

    stats.executions++;
    stats.totalTime += executionTime;
    if (isError) {
      stats.errors++;
    }
  }

  /**
   * Update average execution time
   */
  private updateAverageExecutionTime(executionTime: number): void {
    const total =
      this.metrics.averageExecutionTime * (this.metrics.successfulExecutions - 1) + executionTime;
    this.metrics.averageExecutionTime = total / this.metrics.successfulExecutions;
  }

  /**
   * Get middleware metrics
   */
  getMetrics(): MiddlewareMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if middleware exists
   */
  has(name: string): boolean {
    return this.middlewares.some(m => m.name === name);
  }

  /**
   * Get middleware function by name
   */
  get(name: string): ErrorMiddlewareFunction | undefined {
    const middleware = this.middlewares.find(m => m.name === name);
    return middleware?.fn;
  }

  /**
   * Get list of middleware names
   */
  list(): string[] {
    return this.middlewares.map(m => m.name);
  }

  /**
   * Get middleware list
   */
  getMiddlewares(): Array<{ name: string; priority: number; enabled: boolean }> {
    return this.middlewares.map(m => ({
      name: m.name,
      priority: m.priority,
      enabled: m.enabled,
    }));
  }

  /**
   * Clear all middlewares
   */
  clear(): void {
    this.middlewares = [];
    this.emit('middlewaresCleared');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MiddlewareConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  /**
   * Setup built-in middlewares
   */
  private setupBuiltinMiddlewares(): void {
    // Error sanitization middleware
    this.use(
      'sanitization',
      (error, context, next) => {
        if (error instanceof ZernError) {
          const sanitized = ErrorUtils.sanitizer.sanitizeError(error) as ZernError;
          next(sanitized);
        } else {
          const sanitized = ErrorUtils.sanitizer.sanitizeError(error);
          next(sanitized);
        }
      },
      1000
    );

    // Error enhancement middleware
    this.use(
      'enhancement',
      (error, context, next) => {
        if (!(error instanceof ZernError)) {
          const enhanced = ErrorUtils.converter.toZernError(
            error,
            undefined,
            ErrorUtils.analyzer.categorizeError(error),
            ErrorUtils.analyzer.determineSeverity(error)
          );
          next(enhanced);
        } else {
          next();
        }
      },
      900
    );

    // Context enrichment middleware
    this.use(
      'contextEnrichment',
      (error, context, next) => {
        if (error instanceof ZernError) {
          const enrichedContext = ErrorUtils.mergeContexts(
            error.context ? (error.context as unknown as Record<string, unknown>) : {},
            context.requestContext,
            context.metadata,
            {
              middleware: {
                processed: true,
                timestamp: Date.now(),
              },
            }
          );

          // Create a new error with enriched context instead of modifying read-only property
          const enhancedError = Object.create(Object.getPrototypeOf(error));
          Object.assign(enhancedError, error, { context: enrichedContext });
          next(enhancedError);
        } else {
          next();
        }
      },
      800
    );

    // Duplicate detection middleware
    this.use(
      'duplicateDetection',
      (error, context, next) => {
        const fingerprint = ErrorUtils.analyzer.getFingerprint(error);
        context.metadata.fingerprint = fingerprint;
        context.metadata.isDuplicate = false; // This would be determined by checking recent errors
        next();
      },
      700
    );

    // Rate limiting middleware
    this.use(
      'rateLimiting',
      (error, context, next) => {
        // Implement rate limiting logic here
        context.metadata.rateLimited = false;
        next();
      },
      600
    );

    // Logging middleware
    this.use(
      'logging',
      (error, context, next) => {
        if (this.config.enableMetrics) {
          console.log(
            `[ErrorMiddleware] Processing error: ${ErrorUtils.formatter.formatError(error)}`
          );
        }
        next();
      },
      100
    );
  }
}

/**
 * Built-in middleware functions
 */
export const BuiltinMiddlewares = {
  /**
   * Error transformation middleware
   */
  transform: (
    transformer: (error: Error | ZernError, context: ErrorMiddlewareContext) => Error | ZernError
  ): ErrorMiddlewareFunction => {
    return (error, context, next) => {
      try {
        const transformed = transformer(error, context);
        next(transformed);
      } catch {
        next(error); // Continue with original error if transformation fails
      }
    };
  },

  /**
   * Conditional middleware
   */
  conditional: (
    condition: (error: Error | ZernError, context: ErrorMiddlewareContext) => boolean,
    middleware: ErrorMiddlewareFunction
  ): ErrorMiddlewareFunction => {
    return (error, context, next) => {
      if (condition(error, context)) {
        middleware(error, context, next);
      } else {
        next();
      }
    };
  },

  /**
   * Async middleware wrapper
   */
  async: (
    asyncFn: (
      error: Error | ZernError,
      context: ErrorMiddlewareContext
    ) => Promise<Error | ZernError | void>
  ): ErrorMiddlewareFunction => {
    return async (error, context, next) => {
      try {
        const result = await asyncFn(error, context);
        next(result || error);
      } catch {
        next(error); // Continue with original error if async operation fails
      }
    };
  },

  /**
   * Error filtering middleware
   */
  filter: (
    predicate: (error: Error | ZernError, context: ErrorMiddlewareContext) => boolean
  ): ErrorMiddlewareFunction => {
    return (error, context, next) => {
      if (predicate(error, context)) {
        next();
      } else {
        context.state.handled = true;
        // Don't call next() to stop the chain
      }
    };
  },

  /**
   * Context injection middleware
   */
  injectContext: (
    contextProvider: (
      error: Error | ZernError,
      context: ErrorMiddlewareContext
    ) => Record<string, unknown>
  ): ErrorMiddlewareFunction => {
    return (error, context, next) => {
      const additionalContext = contextProvider(error, context);
      Object.assign(context.metadata, additionalContext);
      next();
    };
  },
};
