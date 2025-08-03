/**
 * @fileoverview Event bus integration for error handling
 * @module @zern/kernel/errors/integrations/event-bus-integration
 */

import { EventEmitter } from 'events';
import type {
  ZernError,
  ErrorContext,
  ErrorBreadcrumb,
  EnvironmentSnapshot,
  EnhancedStackTrace,
} from '../types/base.js';
import type { ErrorManager } from '../core/error-manager.js';
import type { KernelState } from '../../types/kernel.js';
import type { PluginId, PluginState } from '../../types/plugin.js';

/**
 * Event data interface for incoming event bus data
 */
export interface EventData {
  error: Error | ZernError;
  pluginId?: string;
  operation?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  environment?: Partial<EnvironmentSnapshot>;
  breadcrumbs?: ErrorBreadcrumb[];
  phase?: string;
  dependency?: string;
  version?: string;
  type?: string;
  field?: string;
  value?: unknown;
}

/**
 * Event handler function type
 */
export type EventHandler = (data: EventData) => void;

/**
 * Error manager event data interface
 */
export interface ErrorManagerEventData {
  error: ZernError;
  context: ErrorContext;
  metadata?: Record<string, unknown>;
  processingTime?: number;
}

/**
 * Recovery event data interface
 */
export interface RecoveryEventData {
  error: ZernError;
  strategy: string;
  result?: unknown;
}

/**
 * Suggestion event data interface
 */
export interface SuggestionEventData {
  error: ZernError;
  suggestions: unknown[];
  appliedSuggestion?: unknown;
}

/**
 * Reporting event data interface
 */
export interface ReportingEventData {
  error: ZernError;
  reportId: string;
  destination?: string;
}

export interface EventBusIntegrationConfig {
  enableErrorEvents: boolean;
  enableRecoveryEvents: boolean;
  enableSuggestionEvents: boolean;
  enableReportingEvents: boolean;
  errorEventPrefix: string;
  autoSubscribe: boolean;
  propagateToGlobal: boolean;
}

export interface EventBusErrorEvent {
  type: 'error' | 'recovery' | 'suggestion' | 'report';
  error: ZernError;
  context: ErrorContext;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface RecoveryEvent {
  type: 'recovery-started' | 'recovery-completed' | 'recovery-failed';
  error: ZernError;
  strategy: string;
  result?: unknown;
  timestamp: Date;
}

export interface SuggestionEvent {
  type: 'suggestions-generated' | 'suggestion-applied';
  error: ZernError;
  suggestions: unknown[];
  appliedSuggestion?: unknown;
  timestamp: Date;
}

export interface ReportingEvent {
  type: 'report-sent' | 'report-failed' | 'report-queued';
  error: ZernError;
  reportId: string;
  destination?: string;
  timestamp: Date;
}

/**
 * Integration between error handling system and event bus
 */
export class EventBusIntegration extends EventEmitter {
  private readonly config: EventBusIntegrationConfig;
  private readonly errorManager: ErrorManager;
  private readonly eventBus: EventEmitter;
  private readonly subscriptions = new Map<string, EventHandler>();

  constructor(
    errorManager: ErrorManager,
    eventBus: EventEmitter,
    config: Partial<EventBusIntegrationConfig> = {}
  ) {
    super();

    this.errorManager = errorManager;
    this.eventBus = eventBus;

    this.config = {
      enableErrorEvents: true,
      enableRecoveryEvents: true,
      enableSuggestionEvents: true,
      enableReportingEvents: true,
      errorEventPrefix: 'zern:error',
      autoSubscribe: true,
      propagateToGlobal: false,
      ...config,
    };

    if (this.config.autoSubscribe) {
      this.setupSubscriptions();
    }
  }

  /**
   * Setup event subscriptions
   */
  setupSubscriptions(): void {
    this.subscribeToErrorManager();
    this.subscribeToEventBus();
  }

  /**
   * Subscribe to error manager events
   */
  private subscribeToErrorManager(): void {
    if (this.config.enableErrorEvents) {
      this.errorManager.on('error', data => {
        this.handleErrorEvent(data);
      });

      this.errorManager.on('errorProcessed', data => {
        this.handleErrorProcessedEvent(data);
      });
    }

    if (this.config.enableRecoveryEvents) {
      this.errorManager.on('recoveryStarted', data => {
        this.handleRecoveryEvent('recovery-started', data);
      });

      this.errorManager.on('recoveryCompleted', data => {
        this.handleRecoveryEvent('recovery-completed', data);
      });

      this.errorManager.on('recoveryFailed', data => {
        this.handleRecoveryEvent('recovery-failed', data);
      });
    }

    if (this.config.enableSuggestionEvents) {
      this.errorManager.on('suggestionsGenerated', data => {
        this.handleSuggestionEvent('suggestions-generated', data);
      });

      this.errorManager.on('suggestionApplied', data => {
        this.handleSuggestionEvent('suggestion-applied', data);
      });
    }

    if (this.config.enableReportingEvents) {
      this.errorManager.on('reportSent', data => {
        this.handleReportingEvent('report-sent', data);
      });

      this.errorManager.on('reportFailed', data => {
        this.handleReportingEvent('report-failed', data);
      });

      this.errorManager.on('reportQueued', data => {
        this.handleReportingEvent('report-queued', data);
      });
    }
  }

  /**
   * Subscribe to event bus events
   */
  private subscribeToEventBus(): void {
    // Subscribe to plugin errors
    this.subscribe('plugin:error', data => {
      this.handlePluginError(data);
    });

    // Subscribe to system errors
    this.subscribe('system:error', data => {
      this.handleSystemError(data);
    });

    // Subscribe to lifecycle errors
    this.subscribe('lifecycle:error', data => {
      this.handleLifecycleError(data);
    });

    // Subscribe to dependency errors
    this.subscribe('dependency:error', data => {
      this.handleDependencyError(data);
    });

    // Subscribe to validation errors
    this.subscribe('validation:error', data => {
      this.handleValidationError(data);
    });

    // Subscribe to custom error events
    this.subscribe('error:*', data => {
      this.handleGenericError(data);
    });
  }

  /**
   * Subscribe to an event
   */
  private subscribe(event: string, handler: EventHandler): void {
    this.eventBus.on(event, handler);
    this.subscriptions.set(event, handler);
  }

  /**
   * Unsubscribe from an event
   */
  private unsubscribe(event: string): void {
    const handler = this.subscriptions.get(event);
    if (handler) {
      this.eventBus.off(event, handler);
      this.subscriptions.delete(event);
    }
  }

  /**
   * Handle error events from error manager
   */
  private handleErrorEvent(data: ErrorManagerEventData): void {
    const errorEvent: EventBusErrorEvent = {
      type: 'error',
      error: data.error,
      context: data.context,
      timestamp: new Date(),
      ...(data.metadata && { metadata: data.metadata }),
    };

    this.emitErrorEvent('error', errorEvent);
  }

  /**
   * Handle error processed events
   */
  private handleErrorProcessedEvent(data: ErrorManagerEventData): void {
    const errorEvent: EventBusErrorEvent = {
      type: 'error',
      error: data.error,
      context: data.context,
      timestamp: new Date(),
      metadata: {
        ...data.metadata,
        processed: true,
        processingTime: data.processingTime,
      },
    };

    this.emitErrorEvent('error-processed', errorEvent);
  }

  /**
   * Handle recovery events
   */
  private handleRecoveryEvent(type: RecoveryEvent['type'], data: RecoveryEventData): void {
    const recoveryEvent: RecoveryEvent = {
      type,
      error: data.error,
      strategy: data.strategy,
      result: data.result,
      timestamp: new Date(),
    };

    this.emitErrorEvent('recovery', recoveryEvent);
  }

  /**
   * Handle suggestion events
   */
  private handleSuggestionEvent(type: SuggestionEvent['type'], data: SuggestionEventData): void {
    const suggestionEvent: SuggestionEvent = {
      type,
      error: data.error,
      suggestions: data.suggestions,
      appliedSuggestion: data.appliedSuggestion,
      timestamp: new Date(),
    };

    this.emitErrorEvent('suggestion', suggestionEvent);
  }

  /**
   * Handle reporting events
   */
  private handleReportingEvent(type: ReportingEvent['type'], data: ReportingEventData): void {
    const reportingEvent: ReportingEvent = {
      type,
      error: data.error,
      reportId: data.reportId,
      timestamp: new Date(),
      ...(data.destination && { destination: data.destination }),
    };

    this.emitErrorEvent('reporting', reportingEvent);
  }

  /**
   * Handle plugin errors from event bus
   */
  private handlePluginError(data: EventData): void {
    try {
      // Convert event bus error to ZernError format
      const context = this.createContextFromEventData(data);
      this.errorManager.handleError(data.error, context);
    } catch (error) {
      console.error('Failed to handle plugin error:', error);
    }
  }

  /**
   * Handle system errors from event bus
   */
  private handleSystemError(data: EventData): void {
    try {
      const context = this.createContextFromEventData(data);
      this.errorManager.handleError(data.error, context);
    } catch (error) {
      console.error('Failed to handle system error:', error);
    }
  }

  /**
   * Handle lifecycle errors from event bus
   */
  private handleLifecycleError(data: EventData): void {
    try {
      const context = this.createContextFromEventData(data);
      // Create a new context with the operation from phase, since ErrorContext is readonly
      const enhancedContext: ErrorContext = {
        ...context,
        operation: data.phase || context.operation || 'unknown',
      };
      this.errorManager.handleError(data.error, enhancedContext);
    } catch (error) {
      console.error('Failed to handle lifecycle error:', error);
    }
  }

  /**
   * Handle dependency errors from event bus
   */
  private handleDependencyError(data: EventData): void {
    try {
      const context = this.createContextFromEventData(data);
      // Since ErrorContext doesn't have metadata, we'll pass it through the error's metadata if it's a ZernError
      if (data.error instanceof Error && 'metadata' in data.error) {
        const zernError = data.error as ZernError;
        const enhancedError = zernError.withMetadata({
          ...zernError.metadata,
          dependency: data.dependency,
          dependencyVersion: data.version,
        });
        this.errorManager.handleError(enhancedError, context);
      } else {
        this.errorManager.handleError(data.error, context);
      }
    } catch (error) {
      console.error('Failed to handle dependency error:', error);
    }
  }

  /**
   * Handle validation errors from event bus
   */
  private handleValidationError(data: EventData): void {
    try {
      const context = this.createContextFromEventData(data);
      // Since ErrorContext doesn't have metadata, we'll pass it through the error's metadata if it's a ZernError
      if (data.error instanceof Error && 'metadata' in data.error) {
        const zernError = data.error as ZernError;
        const enhancedError = zernError.withMetadata({
          ...zernError.metadata,
          validationType: data.type,
          validationField: data.field,
          validationValue: data.value,
        });
        this.errorManager.handleError(enhancedError, context);
      } else {
        this.errorManager.handleError(data.error, context);
      }
    } catch (error) {
      console.error('Failed to handle validation error:', error);
    }
  }

  /**
   * Handle generic errors from event bus
   */
  private handleGenericError(data: EventData): void {
    try {
      const context = this.createContextFromEventData(data);
      this.errorManager.handleError(data.error, context);
    } catch (error) {
      console.error('Failed to handle generic error:', error);
    }
  }

  /**
   * Filter undefined values from environment variables
   */
  private filterEnvironmentVariables(
    env: Record<string, string | undefined>
  ): Record<string, string> {
    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  /**
   * Create error context from event data
   */
  private createContextFromEventData(data: EventData): ErrorContext {
    // Create default values for required properties
    const defaultEnvironment: EnvironmentSnapshot = {
      nodeVersion: process.version || 'unknown',
      platform: process.platform || 'unknown',
      arch: process.arch || 'unknown',
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      cpu: {
        usage: 0,
        loadAverage: [],
      },
      uptime: process.uptime?.() || 0,
      environment: this.filterEnvironmentVariables(process.env),
      ...data.environment,
    };

    const defaultStackTrace: EnhancedStackTrace = {
      original: data.error.stack || '',
      parsed: [],
    };

    // Build context with only defined optional properties
    const context: ErrorContext = {
      timestamp: Date.now(),
      kernelState: 'unknown' as KernelState,
      pluginStates: new Map<PluginId, PluginState>(),
      breadcrumbs: data.breadcrumbs || [],
      stackTrace: defaultStackTrace,
      environment: defaultEnvironment,
      ...(data.requestId && { requestId: data.requestId }),
      ...(data.userId && { userId: data.userId }),
      ...(data.sessionId && { sessionId: data.sessionId }),
      ...(data.pluginId && { pluginId: data.pluginId as PluginId }),
      ...(data.operation && { operation: data.operation }),
    };

    return context;
  }

  /**
   * Emit error event to event bus
   */
  private emitErrorEvent(
    eventType: string,
    event: EventBusErrorEvent | RecoveryEvent | SuggestionEvent | ReportingEvent
  ): void {
    const eventName = `${this.config.errorEventPrefix}:${eventType}`;

    // Emit to event bus
    this.eventBus.emit(eventName, event);

    // Emit to this integration instance
    this.emit(eventType, event);

    // Propagate to global if configured
    if (this.config.propagateToGlobal && typeof process !== 'undefined') {
      // Use process.nextTick to schedule error logging instead of process.emit
      // to avoid type compatibility issues with Node.js process signals
      process.nextTick(() => {
        console.error(`Zern Error: ${event.error.message}`, event.error);
      });
    }
  }

  /**
   * Send error to event bus
   */
  sendError(error: ZernError, context: ErrorContext): void {
    const errorEvent: EventBusErrorEvent = {
      type: 'error',
      error,
      context,
      timestamp: new Date(),
    };

    this.emitErrorEvent('external', errorEvent);
  }

  /**
   * Send recovery notification to event bus
   */
  sendRecoveryNotification(error: ZernError, strategy: string, result: unknown): void {
    const recoveryEvent: RecoveryEvent = {
      type: 'recovery-completed',
      error,
      strategy,
      result,
      timestamp: new Date(),
    };

    this.emitErrorEvent('recovery-notification', recoveryEvent);
  }

  /**
   * Send suggestion notification to event bus
   */
  sendSuggestionNotification(
    error: ZernError,
    suggestions: unknown[],
    appliedSuggestion?: unknown
  ): void {
    const suggestionEvent: SuggestionEvent = {
      type: appliedSuggestion ? 'suggestion-applied' : 'suggestions-generated',
      error,
      suggestions,
      appliedSuggestion,
      timestamp: new Date(),
    };

    this.emitErrorEvent('suggestion-notification', suggestionEvent);
  }

  /**
   * Get integration statistics
   */
  getStatistics(): Record<string, unknown> {
    return {
      subscriptions: this.subscriptions.size,
      eventsHandled: this.listenerCount('error'),
      config: this.config,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<EventBusIntegrationConfig>): void {
    Object.assign(this.config, newConfig);

    // Re-setup subscriptions if needed
    if (newConfig.autoSubscribe !== undefined) {
      if (newConfig.autoSubscribe) {
        this.setupSubscriptions();
      } else {
        this.cleanup();
      }
    }
  }

  /**
   * Cleanup subscriptions
   */
  cleanup(): void {
    for (const [event] of this.subscriptions) {
      this.unsubscribe(event);
    }

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
