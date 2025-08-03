/**
 * @fileoverview Main error handling system facade
 * @module @zern/kernel/errors/error-handling-system
 */

/// <reference lib="dom" />

import { EventEmitter } from 'events';
import { ErrorManager } from './core/error-manager.js';
import { ErrorCollector } from './core/error-collector.js';
import { RecoveryManager } from './recovery/recovery-manager.js';
import { CircuitBreakerRegistry } from './recovery/circuit-breaker.js';
import { ErrorReporter } from './reporting/error-reporter.js';
import { SuggestionEngine } from './suggestions/suggestion-engine.js';
import { ErrorDisplay } from './ui/error-display.js';
import { EventBusIntegration } from './integrations/event-bus-integration.js';
import { PluginIntegration } from './integrations/plugin-integration.js';

import type {
  ZernError,
  ErrorContext,
  ErrorHandler,
  ErrorFilter,
  ErrorTransformer,
  ErrorSuggestion,
} from './types/base.js';
import type { ErrorManagerConfig } from './core/error-manager.js';
import type { ErrorCollectorConfig } from './core/error-collector.js';
import type { RecoveryManagerConfig } from './recovery/recovery-manager.js';
import type { ReportingConfig } from './reporting/error-reporter.js';
import type { SuggestionEngineConfig } from './suggestions/suggestion-engine.js';
import type { ErrorDisplayConfig } from './ui/error-display.js';
import type { EventBusIntegrationConfig } from './integrations/event-bus-integration.js';
import type { PluginIntegrationConfig } from './integrations/plugin-integration.js';

export interface ErrorHandlingSystemConfig {
  // Core configuration
  enableErrorCollection: boolean;
  enableRecovery: boolean;
  enableReporting: boolean;
  enableSuggestions: boolean;
  enableUI: boolean;
  enableEventBusIntegration: boolean;
  enablePluginIntegration: boolean;

  // Component configurations
  errorManager?: Partial<ErrorManagerConfig>;
  errorCollector?: Partial<ErrorCollectorConfig>;
  recoveryManager?: Partial<RecoveryManagerConfig>;
  errorReporter?: Partial<ReportingConfig>;
  suggestionEngine?: Partial<SuggestionEngineConfig>;
  errorDisplay?: Partial<ErrorDisplayConfig>;
  eventBusIntegration?: Partial<EventBusIntegrationConfig>;
  pluginIntegration?: Partial<PluginIntegrationConfig>;

  // Global settings
  globalErrorHandling: boolean;
  unhandledRejectionHandling: boolean;
  consoleErrorCapture: boolean;
  developmentMode: boolean;
}

export interface ErrorHandlingSystemStats {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  recoveryAttempts: number;
  successfulRecoveries: number;
  reportsSent: number;
  suggestionsGenerated: number;
  uptime: number;
  isHealthy: boolean;
}

/**
 * Main error handling system that orchestrates all error handling components
 */
export class ErrorHandlingSystem extends EventEmitter {
  private readonly config: ErrorHandlingSystemConfig;
  private readonly startTime: Date;

  // Core components
  private readonly errorManager: ErrorManager;
  private readonly errorCollector?: ErrorCollector;
  private readonly recoveryManager?: RecoveryManager;
  private readonly circuitBreakerRegistry?: CircuitBreakerRegistry;
  private readonly errorReporter?: ErrorReporter;
  private readonly suggestionEngine?: SuggestionEngine;
  private readonly errorDisplay?: ErrorDisplay;

  // Integrations
  private eventBusIntegration?: EventBusIntegration;
  private pluginIntegration?: PluginIntegration;

  // State
  private initialized = false;
  private destroyed = false;

  constructor(config: Partial<ErrorHandlingSystemConfig> = {}) {
    super();

    // Set max listeners to prevent warnings in tests
    this.setMaxListeners(0); // 0 means unlimited

    this.startTime = new Date();

    this.config = {
      enableErrorCollection: true,
      enableRecovery: true,
      enableReporting: true,
      enableSuggestions: true,
      enableUI: true,
      enableEventBusIntegration: true,
      enablePluginIntegration: true,
      globalErrorHandling: true,
      unhandledRejectionHandling: true,
      consoleErrorCapture: false,
      developmentMode: process.env.NODE_ENV === 'development',
      ...config,
    };

    // Initialize core components
    this.errorManager = new ErrorManager(this.config.errorManager);

    if (this.config.enableErrorCollection) {
      this.errorCollector = new ErrorCollector(this.config.errorCollector);
    }

    if (this.config.enableRecovery) {
      this.recoveryManager = new RecoveryManager(this.config.recoveryManager);
      this.circuitBreakerRegistry = new CircuitBreakerRegistry();
    }

    if (this.config.enableReporting) {
      this.errorReporter = new ErrorReporter(this.config.errorReporter);
    }

    if (this.config.enableSuggestions) {
      this.suggestionEngine = new SuggestionEngine(this.config.suggestionEngine);
    }

    if (this.config.enableUI && typeof window !== 'undefined') {
      this.errorDisplay = new ErrorDisplay(this.config.errorDisplay);
    }

    this.setupComponentIntegrations();
  }

  /**
   * Initialize the error handling system
   */
  async initialize(eventBus?: EventEmitter): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Setup integrations
      if (this.config.enableEventBusIntegration && eventBus) {
        this.setupEventBusIntegration(eventBus);
      }

      if (this.config.enablePluginIntegration) {
        this.setupPluginIntegration();
      }

      // Setup global error handling
      if (this.config.globalErrorHandling) {
        this.setupGlobalErrorHandling();
      }

      this.initialized = true;
      this.emit('initialized');

      console.log('Zern Error Handling System initialized');
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  /**
   * Handle an error through the system
   */
  async handleError(error: ZernError | Error, context: Partial<ErrorContext> = {}): Promise<void> {
    if (this.destroyed) {
      return;
    }

    try {
      // Convert Error to ZernError if needed
      const zernError = this.ensureZernError(error);

      // Enhance context with system information
      const enhancedContext = this.enhanceContext(context);

      // Collect error if collection is enabled
      if (this.errorCollector) {
        this.errorCollector.collect(zernError, enhancedContext);
      }

      // Generate suggestions if enabled
      let suggestions: ErrorSuggestion[] = [];
      if (this.suggestionEngine) {
        suggestions = this.suggestionEngine.generateSuggestions(zernError, enhancedContext);
      }

      // Display error if UI is enabled
      if (this.errorDisplay) {
        this.errorDisplay.displayError(zernError, enhancedContext, suggestions);
      }

      // Report error if reporting is enabled
      if (this.errorReporter) {
        await this.errorReporter.report(zernError, enhancedContext);
      }

      // Attempt recovery if enabled
      if (this.recoveryManager) {
        await this.recoveryManager.recover(zernError, enhancedContext);
      }

      // Process through error manager
      await this.errorManager.handleError(zernError, enhancedContext);

      this.emit('errorHandled', { error: zernError, context: enhancedContext, suggestions });
    } catch (handlingError) {
      console.error('Error in error handling system:', handlingError);
      this.emit('handlingError', { originalError: error, handlingError });
    }
  }

  /**
   * Add error handler
   */
  addHandler(name: string, handler: ErrorHandler): void {
    this.errorManager.addHandler(name, handler);
  }

  /**
   * Remove error handler
   */
  removeHandler(name: string): void {
    this.errorManager.removeHandler(name);
  }

  /**
   * Add error filter
   */
  addFilter(filter: ErrorFilter): void {
    this.errorManager.addFilter(filter);
  }

  /**
   * Remove error filter
   */
  removeFilter(filter: ErrorFilter): void {
    this.errorManager.removeFilter(filter);
  }

  /**
   * Add error transformer
   */
  addTransformer(transformer: ErrorTransformer): void {
    this.errorManager.addTransformer(transformer);
  }

  /**
   * Remove error transformer
   */
  removeTransformer(transformer: ErrorTransformer): void {
    this.errorManager.removeTransformer(transformer);
  }

  /**
   * Get system statistics
   */
  getStatistics(): ErrorHandlingSystemStats {
    const errorManagerStats = this.errorManager.getStats();
    const recoveryStats = this.recoveryManager?.getStatistics();
    const reporterStats = this.errorReporter?.getStatistics();
    const suggestionStats = this.suggestionEngine?.getStatistics();

    return {
      totalErrors: errorManagerStats.total,
      errorsByCategory: errorManagerStats.byCategory,
      errorsBySeverity: errorManagerStats.bySeverity,
      recoveryAttempts: recoveryStats?.totalAttempts || 0,
      successfulRecoveries: recoveryStats?.successfulAttempts || 0,
      reportsSent: reporterStats?.totalReports || 0,
      suggestionsGenerated: suggestionStats?.totalSuggestions || 0,
      uptime: Date.now() - this.startTime.getTime(),
      isHealthy: this.checkSystemHealth(),
    };
  }

  /**
   * Get error history
   */
  getErrorHistory(limit?: number): readonly ZernError[] {
    const errorEvents = this.errorManager.getHistory(limit);
    return errorEvents.map(event => event.error);
  }

  /**
   * Get error patterns
   */
  getErrorPatterns(): unknown[] {
    return this.errorCollector?.getPatterns() || [];
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStatistics(): unknown {
    return this.recoveryManager?.getStatistics();
  }

  /**
   * Get reporting statistics
   */
  getReportingStatistics(): unknown {
    return this.errorReporter?.getStatistics();
  }

  /**
   * Get suggestion statistics
   */
  getSuggestionStatistics(): unknown {
    return this.suggestionEngine?.getStatistics();
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorManager.clearHistory();
    this.errorCollector?.clear();
  }

  /**
   * Update system configuration
   */
  updateConfig(newConfig: Partial<ErrorHandlingSystemConfig>): void {
    Object.assign(this.config, newConfig);
    this.emit('configUpdated', this.config);
  }

  /**
   * Check system health
   */
  checkSystemHealth(): boolean {
    const stats = this.errorManager.getStats();

    // System is unhealthy if:
    // - Too many critical errors
    // - High error rate
    // - Components are failing

    const criticalErrors = stats.bySeverity.critical || 0;
    if (criticalErrors > 10) {
      return false;
    }

    const errorRate = (stats.total / (Date.now() - this.startTime.getTime())) * 60000; // errors per minute
    if (errorRate > 50) {
      return false;
    }

    return true;
  }

  /**
   * Setup component integrations
   */
  private setupComponentIntegrations(): void {
    // Connect error manager to other components
    this.errorManager.on('error', async data => {
      // Forward to collector
      if (this.errorCollector) {
        this.errorCollector.collect(data.error, data.context);
      }

      // Forward to reporter
      if (this.errorReporter) {
        await this.errorReporter.report(data.error, data.context);
      }
    });

    // Connect recovery manager to error manager
    if (this.recoveryManager) {
      this.errorManager.on('error', async data => {
        await this.recoveryManager?.recover(data.error, data.context);
      });
    }

    // Connect suggestion engine to error manager
    if (this.suggestionEngine) {
      this.errorManager.on('error', data => {
        const suggestions = this.suggestionEngine!.generateSuggestions(data.error, data.context);
        this.emit('suggestionsGenerated', { ...data, suggestions });
      });
    }

    // Connect error display to error manager
    if (this.errorDisplay) {
      this.errorManager.on('error', data => {
        const suggestions =
          this.suggestionEngine?.generateSuggestions(data.error, data.context) || [];
        this.errorDisplay!.displayError(data.error, data.context, suggestions);
      });
    }
  }

  /**
   * Setup event bus integration
   */
  private setupEventBusIntegration(eventBus: EventEmitter): void {
    if (!this.config.enableEventBusIntegration) {
      return;
    }

    const integration = new EventBusIntegration(
      this.errorManager,
      eventBus,
      this.config.eventBusIntegration
    );

    this.eventBusIntegration = integration;

    this.emit('eventBusIntegrationSetup', integration);
  }

  /**
   * Setup plugin integration
   */
  private setupPluginIntegration(): void {
    if (!this.config.enablePluginIntegration) {
      return;
    }

    const integration = new PluginIntegration(this.errorManager, this.config.pluginIntegration);

    this.pluginIntegration = integration;

    this.emit('pluginIntegrationSetup', integration);
  }

  /**
   * Setup global error handling
   */
  private setupGlobalErrorHandling(): void {
    // Handle uncaught exceptions
    if (typeof process !== 'undefined') {
      process.on('uncaughtException', (error): void => {
        this.handleError(error, {
          operation: 'uncaughtException',
        });
      });
    }

    // Handle unhandled promise rejections
    if (this.config.unhandledRejectionHandling) {
      if (typeof process !== 'undefined') {
        process.on('unhandledRejection', (reason, _promise): void => {
          const error = reason instanceof Error ? reason : new Error(String(reason));
          this.handleError(error, {
            operation: 'unhandledRejection',
          });
        });
      }

      if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
        const window = (globalThis as { window: Window }).window;
        window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
          const error =
            event.reason instanceof Error ? event.reason : new Error(String(event.reason));
          this.handleError(error, {
            operation: 'unhandledRejection',
          });
        });
      }
    }

    // Handle window errors
    if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
      const window = (globalThis as { window: Window }).window;
      window.addEventListener('error', (event: ErrorEvent) => {
        this.handleError(event.error || new Error(event.message), {
          operation: 'windowError',
        });
      });
    }

    // Capture console errors if enabled
    if (this.config.consoleErrorCapture) {
      this.setupConsoleErrorCapture();
    }
  }

  /**
   * Setup console error capture
   */
  private setupConsoleErrorCapture(): void {
    const originalConsoleError = console.error;

    console.error = (...args: unknown[]): void => {
      // Call original console.error
      originalConsoleError.apply(console, args);

      // Create error from console arguments
      const message = args
        .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
        .join(' ');

      const error = new Error(message);

      this.handleError(error, {
        operation: 'consoleError',
      });
    };
  }

  /**
   * Ensure error is a ZernError
   */
  private ensureZernError(error: ZernError | Error): ZernError {
    if ('category' in error && 'code' in error) {
      return error as ZernError;
    }

    // Convert Error to ZernError
    const zernError = Object.create(error);
    zernError.category = 'system';
    zernError.code = 'UNKNOWN_ERROR';
    zernError.severity = 'medium';
    zernError.getSuggestions = (): ErrorSuggestion[] => [];
    zernError.getRecoveryStrategies = (): unknown[] => [];

    return zernError;
  }

  /**
   * Enhance context with system information
   */
  private enhanceContext(context: Partial<ErrorContext>): ErrorContext {
    const now = Date.now();
    return {
      timestamp: now,
      kernelState: 'running' as const,
      pluginStates: new Map(),
      breadcrumbs: [],
      stackTrace: {
        original: '',
        parsed: [],
      },
      environment: {
        nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
        platform: typeof process !== 'undefined' ? process.platform : 'unknown',
        arch: typeof process !== 'undefined' ? process.arch : 'unknown',
        memory: {
          used: 0,
          total: 0,
          percentage: 0,
        },
        cpu: {
          usage: 0,
          loadAverage: [],
        },
        uptime: typeof process !== 'undefined' ? process.uptime() : 0,
        environment:
          typeof process !== 'undefined'
            ? (Object.fromEntries(
                Object.entries(process.env).filter(([_, value]) => value !== undefined)
              ) as Record<string, string>)
            : {},
      },
      sessionId: this.generateSessionId(),
      ...context,
    };
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Destroy the error handling system
   */
  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    // Cleanup components
    // Note: errorManager and recoveryManager don't have destroy methods
    this.errorCollector?.destroy();
    this.errorReporter?.destroy();
    this.suggestionEngine?.clearCache();
    this.errorDisplay?.clearAll();

    // Cleanup integrations
    this.eventBusIntegration?.destroy();
    this.pluginIntegration?.destroy();

    this.removeAllListeners();
    this.emit('destroyed');

    console.log('Zern Error Handling System destroyed');
  }
}
