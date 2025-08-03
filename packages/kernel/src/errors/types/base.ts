/**
 * @fileoverview Base error classes and interfaces for the Zern Kernel error handling system
 * @module @zern/kernel/errors/types/base
 */

import type { KernelState } from '../../types/kernel.js';
import type { PluginId, PluginState } from '../../types/plugin.js';

/**
 * Unique identifier for error instances
 */
export type ErrorId = string;

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | 'kernel'
  | 'plugin'
  | 'configuration'
  | 'dependency'
  | 'validation'
  | 'network'
  | 'filesystem'
  | 'security'
  | 'performance'
  | 'memory'
  | 'unknown';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Plugin lifecycle phases where errors can occur
 */
export type PluginLifecyclePhase =
  | 'discovery'
  | 'validation'
  | 'initialization'
  | 'configuration'
  | 'startup'
  | 'runtime'
  | 'shutdown'
  | 'cleanup';

/**
 * Kernel operations where errors can occur
 */
export type KernelOperation =
  | 'initialization'
  | 'plugin-loading'
  | 'plugin-resolution'
  | 'state-management'
  | 'event-handling'
  | 'shutdown';

/**
 * Enhanced stack trace with additional context
 */
export interface EnhancedStackTrace {
  readonly original: string;
  readonly parsed: StackFrame[];
  readonly sourceMap?: SourceMapInfo;
}

/**
 * Individual stack frame information
 */
export interface StackFrame {
  readonly functionName?: string;
  readonly fileName?: string;
  readonly lineNumber?: number;
  readonly columnNumber?: number;
  readonly source?: string;
}

/**
 * Source map information for better debugging
 */
export interface SourceMapInfo {
  readonly file: string;
  readonly mappings: string;
  readonly sources: string[];
}

/**
 * Error breadcrumb for tracking error context
 */
export interface ErrorBreadcrumb {
  readonly timestamp: number;
  readonly category: string;
  readonly message: string;
  readonly level: 'debug' | 'info' | 'warning' | 'error';
  readonly data?: Record<string, unknown>;
}

/**
 * Environment snapshot at error time
 */
export interface EnvironmentSnapshot {
  readonly nodeVersion: string;
  readonly platform: string;
  readonly arch: string;
  readonly memory: {
    used: number;
    total: number;
    percentage: number;
  };
  readonly cpu: {
    usage: number;
    loadAverage: number[];
  };
  readonly uptime: number;
  readonly environment: Record<string, string>;
}

/**
 * Rich error context with comprehensive information
 */
export interface ErrorContext {
  readonly timestamp: number;
  readonly kernelState: KernelState;
  readonly pluginStates: Map<PluginId, PluginState>;
  readonly breadcrumbs: ErrorBreadcrumb[];
  readonly stackTrace: EnhancedStackTrace;
  readonly environment: EnvironmentSnapshot;
  readonly requestId?: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly correlationId?: string;
  readonly pluginId?: PluginId;
  readonly operation?: string;
}

/**
 * Error suggestion types
 */
export type ErrorSuggestionType = 'fix' | 'workaround' | 'documentation' | 'debug';

/**
 * Error suggestion action types
 */
export type ErrorSuggestionActionType = 'command' | 'config' | 'code' | 'link';

/**
 * Error suggestion action
 */
export interface ErrorSuggestionAction {
  readonly type: ErrorSuggestionActionType;
  readonly payload: unknown;
  readonly description?: string;
}

/**
 * Intelligent error suggestion
 */
export interface ErrorSuggestion {
  readonly type: ErrorSuggestionType;
  readonly title: string;
  readonly description: string;
  readonly confidence: number; // 0-1
  readonly action?: ErrorSuggestionAction;
  readonly priority: number; // Higher = more important
  readonly tags?: string[];
}

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  readonly name: string;
  readonly priority: number;
  readonly description: string;
  readonly estimatedTime?: number; // milliseconds

  canRecover(error: ZernError): boolean;
  recover(error: ZernError, context: ErrorContext): Promise<RecoveryResult>;
}

/**
 * Recovery attempt result
 */
export interface RecoveryResult {
  readonly success: boolean;
  readonly strategy: string;
  readonly duration: number;
  readonly error?: Error;
  readonly message?: string;
  readonly retryAfter?: number; // milliseconds
}

/**
 * Error handling result
 */
export interface ErrorResult<T extends ZernError = ZernError> {
  readonly error: T;
  readonly context: ErrorContext;
  readonly suggestions: ErrorSuggestion[];
  readonly recovered: boolean;
  readonly recoveryResults: RecoveryResult[];
  readonly reportId?: string;
  readonly handled: boolean;
}

/**
 * Base abstract error class with rich typing and context
 */
export abstract class ZernError extends Error {
  abstract readonly category: ErrorCategory;
  abstract readonly severity: ErrorSeverity;
  abstract readonly recoverable: boolean;
  abstract readonly code: string;

  readonly id: ErrorId;
  readonly timestamp: number;
  readonly context: ErrorContext | undefined;
  readonly metadata: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      cause?: Error;
      context?: ErrorContext;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, { cause: options.cause });

    this.id = this.generateId();
    this.timestamp = Date.now();
    this.context = options.context;
    this.metadata = options.metadata || {};

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }

  /**
   * Generate unique error ID
   */
  private generateId(): ErrorId {
    return `${this.constructor.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get intelligent suggestions for resolving this error
   */
  abstract getSuggestions(): ErrorSuggestion[];

  /**
   * Get available recovery strategies for this error
   */
  abstract getRecoveryStrategies(): RecoveryStrategy[];

  /**
   * Get error details for reporting
   */
  getDetails(): Record<string, unknown> {
    return {
      id: this.id,
      code: this.code,
      category: this.category,
      severity: this.severity,
      recoverable: this.recoverable,
      message: this.message,
      timestamp: this.timestamp,
      metadata: this.metadata,
      stack: this.stack,
      cause: this.cause,
    };
  }

  /**
   * Convert error to JSON for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      ...this.getDetails(),
      context: this.context
        ? {
            timestamp: this.context.timestamp,
            kernelState: this.context.kernelState,
            breadcrumbs: this.context.breadcrumbs,
            environment: this.context.environment,
          }
        : undefined,
    };
  }

  /**
   * Add additional context to this error
   */
  withContext(context: ErrorContext): this {
    (this as { context: ErrorContext | undefined }).context = context;
    return this;
  }

  /**
   * Add additional metadata to this error
   */
  withMetadata(metadata: Record<string, unknown>): this {
    Object.assign(this.metadata, metadata);
    return this;
  }
}

/**
 * Error handler function type
 */
export type ErrorHandler<T extends ZernError = ZernError> = (
  error: T,
  context: ErrorContext
) => Promise<void> | void;

/**
 * Error filter function type
 */
export type ErrorFilter<T extends ZernError = ZernError> = (
  error: T,
  context: ErrorContext
) => boolean;

/**
 * Error transformer function type
 */
export type ErrorTransformer<T extends ZernError = ZernError, R extends ZernError = ZernError> = (
  error: T,
  context: ErrorContext
) => R;
