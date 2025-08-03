/**
 * @fileoverview Central error management system
 * @module @zern/kernel/errors/core/error-manager
 */

import { EventEmitter } from 'events';
import type {
  ZernError,
  ErrorHandler,
  ErrorFilter,
  ErrorTransformer,
  ErrorContext,
  ErrorBreadcrumb,
  EnvironmentSnapshot,
  RecoveryResult,
  ErrorSuggestion,
  RecoveryStrategy,
  StackFrame,
} from '../types/base.js';
import { CustomError } from '../types/custom-errors.js';

export interface ErrorManagerConfig {
  maxBreadcrumbs: number;
  enableStackTraceEnhancement: boolean;
  enableEnvironmentSnapshot: boolean;
  enableAutoRecovery: boolean;
  recoveryTimeout: number;
  reportingEnabled: boolean;
  debugMode: boolean;
}

export interface ErrorEvent {
  error: ZernError;
  context: ErrorContext;
  timestamp: Date;
  handled: boolean;
}

export interface ErrorStats {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  recovered: number;
  unhandled: number;
  lastError?: ErrorEvent;
}

/**
 * Central error management system
 */
export class ErrorManager extends EventEmitter {
  private readonly config: ErrorManagerConfig;
  private readonly handlers = new Map<string, ErrorHandler>();
  private readonly filters = new Set<ErrorFilter>();
  private readonly transformers = new Set<ErrorTransformer>();
  private readonly breadcrumbs: ErrorBreadcrumb[] = [];
  private readonly errorHistory: ErrorEvent[] = [];
  private readonly stats: ErrorStats = {
    total: 0,
    byCategory: {},
    bySeverity: {},
    recovered: 0,
    unhandled: 0,
  };

  constructor(config: Partial<ErrorManagerConfig> = {}) {
    super();

    this.config = {
      maxBreadcrumbs: 50,
      enableStackTraceEnhancement: true,
      enableEnvironmentSnapshot: true,
      enableAutoRecovery: true,
      recoveryTimeout: 5000,
      reportingEnabled: true,
      debugMode: false,
      ...config,
    };

    // Set up default error handler
    this.addHandler('default', this.defaultErrorHandler.bind(this));

    // Set up global error handlers
    this.setupGlobalHandlers();
  }

  /**
   * Handle an error through the error management system
   */
  async handleError(
    error: Error | ZernError,
    context: Partial<ErrorContext> = {}
  ): Promise<boolean> {
    try {
      // Convert to ZernError if needed
      const zernError = this.ensureZernError(error);

      // Enhance error with context
      const enhancedContext = await this.enhanceContext(zernError, context);

      // Apply filters
      if (!this.shouldProcess(zernError, enhancedContext)) {
        return false;
      }

      // Apply transformers
      const transformedError = await this.transformError(zernError, enhancedContext);

      // Create error event
      const errorEvent: ErrorEvent = {
        error: transformedError,
        context: enhancedContext,
        timestamp: new Date(),
        handled: false,
      };

      // Update statistics
      this.updateStats(errorEvent);

      // Add to history
      this.addToHistory(errorEvent);

      // Add breadcrumb
      this.addBreadcrumb({
        category: transformedError.category,
        message: transformedError.message,
        level: this.mapSeverityToLevel(transformedError.severity),
        timestamp: errorEvent.timestamp.getTime(),
        data: {
          code: transformedError.code,
          recoverable: transformedError.recoverable,
        },
      });

      // Emit error event (safely handle case where no listeners exist)
      try {
        this.emit('error', errorEvent);
      } catch {
        // If no listeners for 'error' event, EventEmitter throws - this is expected
        // Continue with error handling even if no listeners
      }

      // Try to handle the error
      const handled = await this.processError(errorEvent);
      errorEvent.handled = handled;

      // Emit handled event
      this.emit('errorHandled', errorEvent);

      return handled;
    } catch (handlingError) {
      // Error in error handling - emit critical event
      this.emit('errorHandlingFailed', {
        originalError: error,
        handlingError,
        context,
      });

      return false;
    }
  }

  /**
   * Add an error handler
   */
  addHandler(name: string, handler: ErrorHandler): void {
    if (this.handlers.has(name)) {
      throw new Error(`Handler with name "${name}" already exists`);
    }
    this.handlers.set(name, handler);
  }

  /**
   * Remove an error handler
   */
  removeHandler(name: string): boolean {
    return this.handlers.delete(name);
  }

  /**
   * Add an error filter
   */
  addFilter(filter: ErrorFilter): void {
    this.filters.add(filter);
  }

  /**
   * Remove an error filter
   */
  removeFilter(filter: ErrorFilter): boolean {
    return this.filters.delete(filter);
  }

  /**
   * Add an error transformer
   */
  addTransformer(transformer: ErrorTransformer): void {
    this.transformers.add(transformer);
  }

  /**
   * Remove an error transformer
   */
  removeTransformer(transformer: ErrorTransformer): boolean {
    return this.transformers.delete(transformer);
  }

  /**
   * Add a breadcrumb
   */
  addBreadcrumb(breadcrumb: ErrorBreadcrumb): void {
    this.breadcrumbs.push(breadcrumb);

    // Maintain max breadcrumbs limit
    while (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }

    this.emit('breadcrumbAdded', breadcrumb);
  }

  /**
   * Get current breadcrumbs
   */
  getBreadcrumbs(): readonly ErrorBreadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * Clear breadcrumbs
   */
  clearBreadcrumbs(): void {
    this.breadcrumbs.length = 0;
    this.emit('breadcrumbsCleared');
  }

  /**
   * Get error statistics
   */
  getStats(): Readonly<ErrorStats> {
    return { ...this.stats };
  }

  /**
   * Get error history
   */
  getHistory(limit?: number): readonly ErrorEvent[] {
    if (limit) {
      return this.errorHistory.slice(-limit);
    }
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory.length = 0;
    this.emit('historyCleared');
  }

  /**
   * Get suggestions for an error
   */
  getSuggestions(error: ZernError): ErrorSuggestion[] {
    const suggestions = error.getSuggestions();

    // Add context-aware suggestions
    const contextSuggestions = this.getContextualSuggestions(error);

    // Combine and sort by priority
    return [...suggestions, ...contextSuggestions].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );
  }

  /**
   * Get recovery strategies for an error
   */
  getRecoveryStrategies(error: ZernError): RecoveryStrategy[] {
    const strategies = error.getRecoveryStrategies();

    // Add context-aware strategies
    const contextStrategies = this.getContextualRecoveryStrategies(error);

    // Combine and sort by priority
    return [...strategies, ...contextStrategies].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Attempt to recover from an error
   */
  async recover(error: ZernError): Promise<RecoveryResult | null> {
    if (!error.recoverable) {
      return null;
    }

    const strategies = this.getRecoveryStrategies(error);

    for (const strategy of strategies) {
      if (!strategy.canRecover(error)) {
        continue;
      }

      try {
        this.emit('recoveryAttempt', { error, strategy });

        // Create a minimal context for recovery if not available
        const recoveryContext = error.context || {
          timestamp: Date.now(),
          breadcrumbs: [...this.getBreadcrumbs()],
          kernelState: 'unknown' as 'initializing',
          pluginStates: new Map(),
          stackTrace: {
            original: error.stack || '',
            parsed: [],
          },
          environment: this.createEnvironmentSnapshot(),
        };

        const result = await Promise.race([
          strategy.recover(error, recoveryContext),
          new Promise<RecoveryResult>((_, reject) =>
            setTimeout(() => reject(new Error('Recovery timeout')), this.config.recoveryTimeout)
          ),
        ]);

        if (result.success) {
          this.stats.recovered++;
          this.emit('recoverySuccess', { error, strategy, result });
          return result;
        }
      } catch (recoveryError) {
        this.emit('recoveryFailed', { error, strategy, recoveryError });
      }
    }

    return null;
  }

  /**
   * Create environment snapshot
   */
  private createEnvironmentSnapshot(): EnvironmentSnapshot {
    const memoryInfo = this.getMemoryInfo();
    return {
      nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
      platform: typeof process !== 'undefined' ? process.platform : 'unknown',
      arch: typeof process !== 'undefined' ? process.arch : 'unknown',
      memory: {
        used: memoryInfo.used || 0,
        total: memoryInfo.total || 0,
        percentage: memoryInfo.total ? (memoryInfo.used / memoryInfo.total) * 100 : 0,
      },
      cpu: {
        usage: 0, // Would need actual CPU monitoring
        loadAverage:
          typeof process !== 'undefined' &&
          'loadavg' in process &&
          typeof process.loadavg === 'function'
            ? process.loadavg()
            : [],
      },
      uptime: typeof process !== 'undefined' ? process.uptime() : 0,
      environment:
        typeof process !== 'undefined'
          ? (Object.fromEntries(
              Object.entries(process.env).filter(([_, value]) => value !== undefined)
            ) as Record<string, string>)
          : {},
    };
  }

  /**
   * Ensure error is a ZernError
   */
  private ensureZernError(error: Error | ZernError): ZernError {
    if (error instanceof Error && 'category' in error) {
      return error as ZernError;
    }

    return new CustomError('UNKNOWN_ERROR', error.message || 'Unknown error occurred', {
      category: 'unknown',
      cause: error,
      metadata: {
        originalType: error.constructor.name,
        stack: error.stack,
      },
    });
  }

  /**
   * Enhance error context
   */
  private async enhanceContext(
    error: ZernError,
    context: Partial<ErrorContext>
  ): Promise<ErrorContext> {
    // Create enhanced stack trace
    const stackTrace =
      this.config.enableStackTraceEnhancement && error.stack
        ? {
            original: error.stack,
            parsed: error.stack
              .split('\n')
              .slice(1)
              .map((line, index) => {
                const functionName = this.extractFunctionName(line);
                const fileName = this.extractFileName(line);

                const frame: StackFrame = {
                  lineNumber: index + 1,
                  columnNumber: 0,
                  source: line.trim(),
                  ...(functionName && { functionName }),
                  ...(fileName && { fileName }),
                };

                return frame;
              }),
          }
        : {
            original: error.stack || '',
            parsed: [],
          };

    const enhanced: ErrorContext = {
      timestamp: Date.now(),
      breadcrumbs: [...this.getBreadcrumbs()],
      environment: this.createEnvironmentSnapshot(), // Always provide environment as it's required
      kernelState: 'unknown' as 'initializing', // Use specific state instead of any
      pluginStates: new Map(),
      stackTrace,
      ...context,
    };

    return enhanced;
  }

  /**
   * Check if error should be processed
   */
  private shouldProcess(error: ZernError, context: ErrorContext): boolean {
    for (const filter of this.filters) {
      if (!filter(error, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Transform error through transformers
   */
  private async transformError(error: ZernError, context: ErrorContext): Promise<ZernError> {
    let transformed = error;

    for (const transformer of this.transformers) {
      transformed = await transformer(transformed, context);
    }

    return transformed;
  }

  /**
   * Process error through handlers
   */
  private async processError(errorEvent: ErrorEvent): Promise<boolean> {
    let handled = false;

    for (const [name, handler] of this.handlers) {
      try {
        await handler(errorEvent.error, errorEvent.context);
        handled = true;
        this.emit('handlerSuccess', { handler: name, errorEvent });
      } catch (handlerError) {
        this.emit('handlerError', { handler: name, errorEvent, handlerError });
      }
    }

    // Try auto-recovery if enabled and no handler succeeded
    if (!handled && this.config.enableAutoRecovery && errorEvent.error.recoverable) {
      const recoveryResult = await this.recover(errorEvent.error);
      if (recoveryResult?.success) {
        handled = true;
      }
    }

    return handled;
  }

  /**
   * Default error handler
   */
  private async defaultErrorHandler(error: ZernError, context: ErrorContext): Promise<void> {
    if (this.config.debugMode) {
      console.error('Zern Error:', {
        code: error.code,
        message: error.message,
        category: error.category,
        severity: error.severity,
        context,
      });
    }

    // Always handle critical errors
    if (error.severity === 'critical') {
      console.error('CRITICAL ERROR:', error.message);
    }
  }

  /**
   * Update error statistics
   */
  private updateStats(errorEvent: ErrorEvent): void {
    this.stats.total++;
    this.stats.byCategory[errorEvent.error.category] =
      (this.stats.byCategory[errorEvent.error.category] || 0) + 1;
    this.stats.bySeverity[errorEvent.error.severity] =
      (this.stats.bySeverity[errorEvent.error.severity] || 0) + 1;
    this.stats.lastError = errorEvent;
  }

  /**
   * Add error to history
   */
  private addToHistory(errorEvent: ErrorEvent): void {
    this.errorHistory.push(errorEvent);

    // Maintain reasonable history size
    if (this.errorHistory.length > 1000) {
      this.errorHistory.splice(0, 100);
    }
  }

  /**
   * Map error severity to breadcrumb level
   */
  private mapSeverityToLevel(severity: string): 'debug' | 'info' | 'warning' | 'error' {
    switch (severity) {
      case 'low':
        return 'debug';
      case 'medium':
        return 'info';
      case 'high':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'error';
    }
  }

  /**
   * Get contextual suggestions
   */
  private getContextualSuggestions(error: ZernError): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [];

    // Add suggestions based on recent errors
    const recentErrors = this.errorHistory.slice(-5);
    const similarErrors = recentErrors.filter(
      e => e.error.category === error.category && e.error.code === error.code
    );

    if (similarErrors.length > 2) {
      suggestions.push({
        type: 'debug',
        title: 'Recurring error detected',
        description: `This error has occurred ${similarErrors.length} times recently`,
        confidence: 0.9,
        priority: 120,
      });
    }

    return suggestions;
  }

  /**
   * Get contextual recovery strategies
   */
  private getContextualRecoveryStrategies(_error: ZernError): RecoveryStrategy[] {
    // Add context-aware recovery strategies based on error patterns
    return [];
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalHandlers(): void {
    // Check for browser environment
    if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
      const window = globalThis.window;
      // Browser environment
      window.addEventListener('error', event => {
        this.handleError(event.error || new Error(event.message));
      });

      window.addEventListener('unhandledrejection', event => {
        this.handleError(event.reason);
      });
    } else if (typeof process !== 'undefined') {
      // Node.js environment
      process.on('uncaughtException', error => {
        this.handleError(error);
      });

      process.on('unhandledRejection', reason => {
        this.handleError(reason instanceof Error ? reason : new Error(String(reason)));
      });
    }
  }

  /**
   * Extract function name from stack trace line
   */
  private extractFunctionName(line: string): string | undefined {
    const match = line.match(/at\s+([^(]+)/);
    return match && match[1] ? match[1].trim() : undefined;
  }

  /**
   * Extract file name from stack trace line
   */
  private extractFileName(line: string): string | undefined {
    const match = line.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      const path = match[1];
      const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
      return lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
    }
    return undefined;
  }

  /**
   * Get memory information
   */
  private getMemoryInfo(): { used: number; total: number; [key: string]: unknown } {
    // Check for browser performance API
    if (typeof globalThis !== 'undefined' && 'performance' in globalThis) {
      const performance = globalThis.performance;
      if ('memory' in performance) {
        const memory = (
          performance as unknown as {
            memory: { usedJSHeapSize?: number; totalJSHeapSize?: number; jsHeapSizeLimit?: number };
          }
        ).memory;
        return {
          used: memory.usedJSHeapSize || 0,
          total: memory.totalJSHeapSize || 0,
          limit: memory.jsHeapSizeLimit || 0,
        };
      }
    }

    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        used: usage.heapUsed,
        total: usage.heapTotal,
        rss: usage.rss,
        external: usage.external,
      };
    }

    return { used: 0, total: 0 };
  }
}
