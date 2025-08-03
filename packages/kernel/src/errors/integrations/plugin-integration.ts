/**
 * @fileoverview Plugin system integration for error handling
 * @module @zern/kernel/errors/integrations/plugin-integration
 */

import { EventEmitter } from 'events';
import type { ErrorContext, ErrorHandler } from '../types/base.js';
import type { PluginError } from '../types/plugin-errors.js';
import type { ErrorManager } from '../core/error-manager.js';

export interface PluginIntegrationConfig {
  enablePluginErrorHandlers: boolean;
  enablePluginErrorReporting: boolean;
  enablePluginRecovery: boolean;
  enablePluginSuggestions: boolean;
  isolatePluginErrors: boolean;
  maxPluginErrorsPerMinute: number;
  pluginErrorTimeout: number;
  enablePluginErrorMetrics: boolean;
}

export interface PluginErrorHandler {
  pluginId: string;
  handler: ErrorHandler;
  priority: number;
  enabled: boolean;
  errorTypes: string[];
  metadata?: Record<string, unknown>;
}

export interface PluginErrorMetrics {
  pluginId: string;
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  lastError: Date | null;
  averageErrorRate: number;
  isHealthy: boolean;
}

export interface PluginErrorContext extends ErrorContext {
  pluginVersion?: string;
  pluginMetadata?: Record<string, unknown>;
  pluginDependencies?: string[];
  pluginLifecyclePhase?: string;
  pluginConfiguration?: Record<string, unknown>;
}

/**
 * Integration between error handling system and plugin system
 */
export class PluginIntegration extends EventEmitter {
  private readonly config: PluginIntegrationConfig;
  private readonly errorManager: ErrorManager;
  private readonly pluginHandlers = new Map<string, PluginErrorHandler[]>();
  private readonly pluginMetrics = new Map<string, PluginErrorMetrics>();
  private readonly pluginErrorCounts = new Map<string, number[]>();

  constructor(errorManager: ErrorManager, config: Partial<PluginIntegrationConfig> = {}) {
    super();

    this.errorManager = errorManager;

    this.config = {
      enablePluginErrorHandlers: true,
      enablePluginErrorReporting: true,
      enablePluginRecovery: true,
      enablePluginSuggestions: true,
      isolatePluginErrors: false,
      maxPluginErrorsPerMinute: 10,
      pluginErrorTimeout: 30000,
      enablePluginErrorMetrics: true,
      ...config,
    };

    this.setupErrorManagerIntegration();
    this.startMetricsCollection();
  }

  /**
   * Register a plugin error handler
   */
  registerPluginErrorHandler(
    pluginId: string,
    handler: ErrorHandler,
    options: {
      priority?: number;
      errorTypes?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): void {
    const pluginHandler: PluginErrorHandler = {
      pluginId,
      handler,
      priority: options.priority || 50,
      enabled: true,
      errorTypes: options.errorTypes || [],
      ...(options.metadata && { metadata: options.metadata }),
    };

    if (!this.pluginHandlers.has(pluginId)) {
      this.pluginHandlers.set(pluginId, []);
    }

    const handlers = this.pluginHandlers.get(pluginId)!;
    handlers.push(pluginHandler);

    // Sort by priority (higher first)
    handlers.sort((a, b) => b.priority - a.priority);

    this.emit('pluginHandlerRegistered', { pluginId, handler: pluginHandler });
  }

  /**
   * Unregister plugin error handlers
   */
  unregisterPluginErrorHandlers(pluginId: string): void {
    const removed = this.pluginHandlers.delete(pluginId);

    if (removed) {
      this.emit('pluginHandlersUnregistered', { pluginId });
    }
  }

  /**
   * Handle plugin error
   */
  async handlePluginError(error: PluginError, context: PluginErrorContext): Promise<void> {
    const pluginId = error.pluginId || context.pluginId;

    if (!pluginId) {
      throw new Error('Plugin ID is required for plugin error handling');
    }

    // Check error rate limits
    if (!this.checkErrorRateLimit(pluginId)) {
      this.emit('pluginErrorRateLimitExceeded', { pluginId, error });
      return;
    }

    // Update metrics
    if (this.config.enablePluginErrorMetrics) {
      this.updatePluginMetrics(pluginId, error);
    }

    // Isolate plugin errors if configured
    if (this.config.isolatePluginErrors) {
      await this.handleIsolatedPluginError(error, context);
    } else {
      await this.handleIntegratedPluginError(error, context);
    }
  }

  /**
   * Handle isolated plugin error
   */
  private async handleIsolatedPluginError(
    error: PluginError,
    context: PluginErrorContext
  ): Promise<void> {
    const pluginId = error.pluginId!;

    try {
      // Try plugin-specific handlers first
      const handled = await this.tryPluginHandlers(pluginId, error, context);

      if (!handled) {
        // Fallback to default plugin error handling
        await this.handleDefaultPluginError(error, context);
      }
    } catch (handlerError) {
      // If plugin handlers fail, use system error handling
      this.emit('pluginHandlerError', {
        pluginId,
        error: handlerError,
        originalError: error,
      });

      await this.errorManager.handleError(error, context);
    }
  }

  /**
   * Handle integrated plugin error
   */
  private async handleIntegratedPluginError(
    error: PluginError,
    context: PluginErrorContext
  ): Promise<void> {
    const pluginId = error.pluginId!;

    // Try plugin-specific handlers first
    const handled = await this.tryPluginHandlers(pluginId, error, context);

    // Always pass to system error manager for full processing
    await this.errorManager.handleError(error, context);

    if (!handled) {
      this.emit('pluginErrorNotHandled', { pluginId, error });
    }
  }

  /**
   * Try plugin-specific error handlers
   */
  private async tryPluginHandlers(
    pluginId: string,
    error: PluginError,
    context: PluginErrorContext
  ): Promise<boolean> {
    const handlers = this.pluginHandlers.get(pluginId);

    if (!handlers || handlers.length === 0) {
      return false;
    }

    for (const pluginHandler of handlers) {
      if (!pluginHandler.enabled) {
        continue;
      }

      // Check if handler supports this error type
      if (pluginHandler.errorTypes.length > 0) {
        const errorType = `${error.category}:${error.code}`;
        if (!pluginHandler.errorTypes.includes(errorType)) {
          continue;
        }
      }

      try {
        const result = await this.executePluginHandler(pluginHandler, error, context);

        if (
          result &&
          typeof result === 'object' &&
          'handled' in result &&
          (result as { handled: boolean }).handled
        ) {
          this.emit('pluginErrorHandled', {
            pluginId,
            handler: pluginHandler,
            error,
            result,
          });
          return true;
        }
      } catch (handlerError) {
        this.emit('pluginHandlerError', {
          pluginId,
          handler: pluginHandler,
          error: handlerError,
          originalError: error,
        });
      }
    }

    return false;
  }

  /**
   * Execute plugin error handler with timeout
   */
  private async executePluginHandler(
    pluginHandler: PluginErrorHandler,
    error: PluginError,
    context: PluginErrorContext
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Plugin error handler timeout: ${pluginHandler.pluginId}`));
      }, this.config.pluginErrorTimeout);

      try {
        const result = pluginHandler.handler(error, context);

        if (result instanceof Promise) {
          result
            .then(resolve)
            .catch(reject)
            .finally(() => clearTimeout(timeout));
        } else {
          clearTimeout(timeout);
          resolve(result);
        }
      } catch (syncError) {
        clearTimeout(timeout);
        reject(syncError);
      }
    });
  }

  /**
   * Handle default plugin error
   */
  private async handleDefaultPluginError(
    error: PluginError,
    context: PluginErrorContext
  ): Promise<void> {
    // Generate plugin-specific suggestions
    const suggestions = error.getSuggestions();

    // Add plugin-specific recovery strategies
    const recoveryStrategies = error.getRecoveryStrategies();

    // Log plugin error with context
    console.error(`Plugin Error [${error.pluginId}]:`, {
      error: error.message,
      code: error.code,
      phase: error.phase,
      context,
    });

    // Emit plugin error event
    this.emit('pluginError', {
      error,
      context,
      suggestions,
      recoveryStrategies,
    });
  }

  /**
   * Check error rate limit for plugin
   */
  private checkErrorRateLimit(pluginId: string): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    if (!this.pluginErrorCounts.has(pluginId)) {
      this.pluginErrorCounts.set(pluginId, []);
    }

    const errorTimes = this.pluginErrorCounts.get(pluginId)!;

    // Remove old error times
    const recentErrors = errorTimes.filter(time => time > oneMinuteAgo);
    this.pluginErrorCounts.set(pluginId, recentErrors);

    // Check if under limit
    if (recentErrors.length >= this.config.maxPluginErrorsPerMinute) {
      return false;
    }

    // Add current error time
    recentErrors.push(now);

    return true;
  }

  /**
   * Update plugin metrics
   */
  private updatePluginMetrics(pluginId: string, error: PluginError): void {
    if (!this.pluginMetrics.has(pluginId)) {
      this.pluginMetrics.set(pluginId, {
        pluginId,
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
        lastError: null,
        averageErrorRate: 0,
        isHealthy: true,
      });
    }

    const metrics = this.pluginMetrics.get(pluginId)!;

    metrics.totalErrors++;
    metrics.lastError = new Date();

    // Update error type counts
    const errorType = `${error.category}:${error.code}`;
    metrics.errorsByType[errorType] = (metrics.errorsByType[errorType] || 0) + 1;

    // Update severity counts
    metrics.errorsBySeverity[error.severity] = (metrics.errorsBySeverity[error.severity] || 0) + 1;

    // Update health status
    metrics.isHealthy = this.calculatePluginHealth(metrics);

    // Calculate error rate
    this.updateErrorRate(metrics);
  }

  /**
   * Calculate plugin health
   */
  private calculatePluginHealth(metrics: PluginErrorMetrics): boolean {
    // Plugin is unhealthy if:
    // - More than 50 errors in total
    // - More than 5 critical errors
    // - Error rate is too high

    if (metrics.totalErrors > 50) {
      return false;
    }

    if ((metrics.errorsBySeverity.critical || 0) > 5) {
      return false;
    }

    if (metrics.averageErrorRate > this.config.maxPluginErrorsPerMinute) {
      return false;
    }

    return true;
  }

  /**
   * Update error rate calculation
   */
  private updateErrorRate(metrics: PluginErrorMetrics): void {
    const errorTimes = this.pluginErrorCounts.get(metrics.pluginId) || [];
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const recentErrors = errorTimes.filter(time => time > oneMinuteAgo);
    metrics.averageErrorRate = recentErrors.length;
  }

  /**
   * Get plugin metrics
   */
  getPluginMetrics(pluginId?: string): PluginErrorMetrics | PluginErrorMetrics[] {
    if (pluginId) {
      return (
        this.pluginMetrics.get(pluginId) || {
          pluginId,
          totalErrors: 0,
          errorsByType: {},
          errorsBySeverity: {},
          lastError: null,
          averageErrorRate: 0,
          isHealthy: true,
        }
      );
    }

    return Array.from(this.pluginMetrics.values());
  }

  /**
   * Get plugin health status
   */
  getPluginHealth(pluginId: string): boolean {
    const metrics = this.pluginMetrics.get(pluginId);
    return metrics ? metrics.isHealthy : true;
  }

  /**
   * Get unhealthy plugins
   */
  getUnhealthyPlugins(): string[] {
    return Array.from(this.pluginMetrics.values())
      .filter(metrics => !metrics.isHealthy)
      .map(metrics => metrics.pluginId);
  }

  /**
   * Reset plugin metrics
   */
  resetPluginMetrics(pluginId?: string): void {
    if (pluginId) {
      this.pluginMetrics.delete(pluginId);
      this.pluginErrorCounts.delete(pluginId);
    } else {
      this.pluginMetrics.clear();
      this.pluginErrorCounts.clear();
    }

    this.emit('pluginMetricsReset', { pluginId });
  }

  /**
   * Enable/disable plugin error handler
   */
  setPluginHandlerEnabled(pluginId: string, enabled: boolean): void {
    const handlers = this.pluginHandlers.get(pluginId);

    if (handlers) {
      for (const handler of handlers) {
        handler.enabled = enabled;
      }

      this.emit('pluginHandlerToggled', { pluginId, enabled });
    }
  }

  /**
   * Get plugin error handlers
   */
  getPluginHandlers(pluginId?: string): PluginErrorHandler[] {
    if (pluginId) {
      return this.pluginHandlers.get(pluginId) || [];
    }

    const allHandlers: PluginErrorHandler[] = [];
    for (const handlers of this.pluginHandlers.values()) {
      allHandlers.push(...handlers);
    }

    return allHandlers;
  }

  /**
   * Setup error manager integration
   */
  private setupErrorManagerIntegration(): void {
    // Add plugin error handler to error manager
    this.errorManager.addHandler(
      'plugin-integration',
      async (error: Error, context: ErrorContext): Promise<void> => {
        if (error instanceof Error && 'pluginId' in error) {
          await this.handlePluginError(error as PluginError, context as PluginErrorContext);
        }
      }
    );
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (!this.config.enablePluginErrorMetrics) {
      return;
    }

    // Clean up old error counts every minute
    setInterval(() => {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;

      for (const [pluginId, errorTimes] of this.pluginErrorCounts) {
        const recentErrors = errorTimes.filter(time => time > oneMinuteAgo);
        this.pluginErrorCounts.set(pluginId, recentErrors);
      }
    }, 60000);

    // Update error rates every 30 seconds
    setInterval(() => {
      for (const metrics of this.pluginMetrics.values()) {
        this.updateErrorRate(metrics);
        metrics.isHealthy = this.calculatePluginHealth(metrics);
      }
    }, 30000);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PluginIntegrationConfig>): void {
    Object.assign(this.config, newConfig);
    this.emit('configUpdated', this.config);
  }

  /**
   * Get integration statistics
   */
  getStatistics(): Record<string, unknown> {
    return {
      totalPlugins: this.pluginHandlers.size,
      totalHandlers: this.getPluginHandlers().length,
      unhealthyPlugins: this.getUnhealthyPlugins().length,
      totalErrors: Array.from(this.pluginMetrics.values()).reduce(
        (sum, metrics) => sum + metrics.totalErrors,
        0
      ),
      config: this.config,
    };
  }

  /**
   * Cleanup plugin integration
   */
  cleanup(): void {
    this.pluginHandlers.clear();
    this.pluginMetrics.clear();
    this.pluginErrorCounts.clear();
    this.removeAllListeners();
  }

  /**
   * Destroy the integration
   */
  destroy(): void {
    this.cleanup();
    this.emit('destroyed');
  }
}
