/**
 * @fileoverview Custom and extensible error types
 * @module @zern/kernel/errors/types/custom-errors
 */

import {
  ZernError,
  type ErrorSuggestion,
  type RecoveryStrategy,
  type ErrorCategory,
  type ErrorSeverity,
} from './base.js';

/**
 * Generic custom error for user-defined error types
 */
export class CustomError extends ZernError {
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly recoverable: boolean;
  readonly code: string;

  constructor(
    code: string,
    message: string,
    options: {
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      recoverable?: boolean;
      suggestions?: ErrorSuggestion[];
      recoveryStrategies?: RecoveryStrategy[];
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, options);

    this.code = code;

    // Set properties with provided options or defaults
    this.category = options.category || 'unknown';
    this.severity = options.severity || 'medium';
    this.recoverable = options.recoverable !== undefined ? options.recoverable : true;

    this._customSuggestions = options.suggestions || [];
    this._customRecoveryStrategies = options.recoveryStrategies || [];
  }

  private _customSuggestions: ErrorSuggestion[];
  private _customRecoveryStrategies: RecoveryStrategy[];

  getSuggestions(): ErrorSuggestion[] {
    return this._customSuggestions;
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return this._customRecoveryStrategies;
  }

  /**
   * Add a suggestion to this error
   */
  addSuggestion(suggestion: ErrorSuggestion): this {
    this._customSuggestions.push(suggestion);
    return this;
  }

  /**
   * Add a recovery strategy to this error
   */
  addRecoveryStrategy(strategy: RecoveryStrategy): this {
    this._customRecoveryStrategies.push(strategy);
    return this;
  }
}

/**
 * Network-related error
 */
export class NetworkError extends ZernError {
  readonly category = 'network' as const;
  readonly severity = 'medium' as const;
  readonly recoverable = true;
  readonly code: string;

  constructor(
    code: string,
    message: string,
    public readonly url?: string,
    public readonly statusCode?: number,
    public readonly timeout?: number,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, options);
    this.code = code;
  }

  getSuggestions(): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [
      {
        type: 'debug',
        title: 'Check network connectivity',
        description: 'Verify that network connection is available',
        confidence: 0.8,
        priority: 100,
      },
    ];

    if (this.url) {
      suggestions.push({
        type: 'debug',
        title: 'Test URL accessibility',
        description: `Test if ${this.url} is accessible`,
        confidence: 0.9,
        priority: 110,
        action: {
          type: 'command',
          payload: `curl -I ${this.url}`,
        },
      });
    }

    if (this.statusCode) {
      if (this.statusCode >= 400 && this.statusCode < 500) {
        suggestions.push({
          type: 'fix',
          title: 'Check request parameters',
          description: `HTTP ${this.statusCode}: Check request format and parameters`,
          confidence: 0.8,
          priority: 105,
        });
      } else if (this.statusCode >= 500) {
        suggestions.push({
          type: 'workaround',
          title: 'Retry request',
          description: `HTTP ${this.statusCode}: Server error, retry may help`,
          confidence: 0.7,
          priority: 90,
        });
      }
    }

    if (this.timeout) {
      suggestions.push({
        type: 'fix',
        title: 'Increase timeout',
        description: `Request timed out after ${this.timeout}ms, consider increasing timeout`,
        confidence: 0.7,
        priority: 80,
        action: {
          type: 'config',
          payload: { networkTimeout: this.timeout * 2 },
        },
      });
    }

    return suggestions;
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'network-retry',
        priority: 90,
        description: 'Retry network request with exponential backoff',
        estimatedTime: 2000,
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'network-retry',
          duration: 1500,
        }),
      },
      {
        name: 'offline-mode',
        priority: 60,
        description: 'Switch to offline mode if available',
        estimatedTime: 500,
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'offline-mode',
          duration: 200,
        }),
      },
    ];
  }
}

/**
 * Filesystem-related error
 */
export class FilesystemError extends ZernError {
  readonly category = 'filesystem' as const;
  readonly severity = 'medium' as const;
  readonly recoverable = true;
  readonly code: string;

  constructor(
    code: string,
    message: string,
    public readonly path?: string,
    public readonly operation?: 'read' | 'write' | 'delete' | 'create' | 'access',
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, options);
    this.code = code;
  }

  getSuggestions(): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [];

    if (this.path) {
      suggestions.push({
        type: 'debug',
        title: 'Check file/directory existence',
        description: `Verify that ${this.path} exists and is accessible`,
        confidence: 0.9,
        priority: 100,
      });

      suggestions.push({
        type: 'fix',
        title: 'Check permissions',
        description: `Verify read/write permissions for ${this.path}`,
        confidence: 0.8,
        priority: 90,
      });
    }

    if (this.operation === 'write' || this.operation === 'create') {
      suggestions.push({
        type: 'fix',
        title: 'Check disk space',
        description: 'Verify that sufficient disk space is available',
        confidence: 0.7,
        priority: 80,
        action: {
          type: 'command',
          payload: 'df -h',
        },
      });
    }

    if (this.operation === 'read' || this.operation === 'access') {
      suggestions.push({
        type: 'workaround',
        title: 'Use alternative path',
        description: 'Try using an alternative file path if available',
        confidence: 0.6,
        priority: 60,
      });
    }

    return suggestions;
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'filesystem-retry',
        priority: 80,
        description: 'Retry filesystem operation',
        estimatedTime: 1000,
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'filesystem-retry',
          duration: 500,
        }),
      },
      {
        name: 'alternative-path',
        priority: 60,
        description: 'Use alternative file path',
        estimatedTime: 200,
        canRecover: () => this.operation === 'read' || this.operation === 'access',
        recover: async () => ({
          success: true,
          strategy: 'alternative-path',
          duration: 100,
        }),
      },
    ];
  }
}

/**
 * Security-related error
 */
export class SecurityError extends ZernError {
  readonly category = 'security' as const;
  readonly severity: ErrorSeverity;
  readonly recoverable = false;
  readonly code: string;

  constructor(
    code: string,
    message: string,
    public readonly securityContext?: string,
    public readonly threatLevel?: 'low' | 'medium' | 'high' | 'critical',
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, options);
    this.code = code;

    // Set severity based on threat level
    this.severity = this.threatLevel === 'critical' ? 'critical' : 'high';
  }

  getSuggestions(): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [
      {
        type: 'fix',
        title: 'Review security configuration',
        description: 'Check and update security settings',
        confidence: 0.9,
        priority: 120,
      },
      {
        type: 'documentation',
        title: 'Security best practices',
        description: 'Review security documentation and best practices',
        confidence: 0.8,
        priority: 100,
        action: {
          type: 'link',
          payload: 'https://docs.zern.dev/security',
        },
      },
    ];

    if (this.securityContext) {
      suggestions.unshift({
        type: 'fix',
        title: 'Address security context',
        description: `Review security issue in context: ${this.securityContext}`,
        confidence: 0.95,
        priority: 130,
      });
    }

    if (this.threatLevel === 'critical' || this.threatLevel === 'high') {
      suggestions.unshift({
        type: 'fix',
        title: 'Immediate action required',
        description: 'This is a high-priority security issue that requires immediate attention',
        confidence: 1.0,
        priority: 150,
      });
    }

    return suggestions;
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    // Security errors are generally not recoverable automatically
    return [];
  }
}

/**
 * Performance-related error
 */
export class PerformanceError extends ZernError {
  readonly category = 'performance' as const;
  readonly severity = 'medium' as const;
  readonly recoverable = true;
  readonly code: string;

  constructor(
    code: string,
    message: string,
    public readonly metric: string,
    public readonly value: number,
    public readonly threshold: number,
    public readonly unit?: string,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, options);
    this.code = code;
  }

  getSuggestions(): ErrorSuggestion[] {
    const percentage = ((this.value - this.threshold) / this.threshold) * 100;
    const unit = this.unit || '';

    return [
      {
        type: 'debug',
        title: 'Profile performance',
        description: `${this.metric} is ${this.value}${unit} (${percentage.toFixed(1)}% over threshold of ${this.threshold}${unit})`,
        confidence: 0.9,
        priority: 100,
        action: {
          type: 'command',
          payload: 'pnpm run profile',
        },
      },
      {
        type: 'fix',
        title: 'Optimize performance',
        description: `Optimize ${this.metric} to reduce resource usage`,
        confidence: 0.8,
        priority: 90,
      },
      {
        type: 'workaround',
        title: 'Increase threshold',
        description: `Temporarily increase ${this.metric} threshold`,
        confidence: 0.5,
        priority: 50,
        action: {
          type: 'config',
          payload: {
            performanceThresholds: {
              [this.metric]: this.threshold * 1.5,
            },
          },
        },
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'performance-optimization',
        priority: 80,
        description: 'Apply automatic performance optimizations',
        estimatedTime: 2000,
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'performance-optimization',
          duration: 1500,
        }),
      },
      {
        name: 'resource-cleanup',
        priority: 70,
        description: 'Clean up unused resources',
        estimatedTime: 1000,
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'resource-cleanup',
          duration: 800,
        }),
      },
    ];
  }
}
