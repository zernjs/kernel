/**
 * Error Utilities
 * Utility functions for error handling, formatting, and analysis
 */

import {
  ZernError,
  ErrorSeverity,
  ErrorCategory,
  type ErrorSuggestion,
  type RecoveryStrategy,
} from '../types/base.js';

// Create const objects for ErrorSeverity and ErrorCategory values
const ErrorSeverityValues = {
  LOW: 'low' as const,
  MEDIUM: 'medium' as const,
  HIGH: 'high' as const,
  CRITICAL: 'critical' as const,
} satisfies Record<string, ErrorSeverity>;

const ErrorCategoryValues = {
  KERNEL: 'kernel' as const,
  PLUGIN: 'plugin' as const,
  CONFIGURATION: 'configuration' as const,
  DEPENDENCY: 'dependency' as const,
  VALIDATION: 'validation' as const,
  NETWORK: 'network' as const,
  FILESYSTEM: 'filesystem' as const,
  SECURITY: 'security' as const,
  PERFORMANCE: 'performance' as const,
  MEMORY: 'memory' as const,
  UNKNOWN: 'unknown' as const,
} satisfies Record<string, ErrorCategory>;

// Export the constants for use in tests and other modules
export { ErrorSeverityValues as ErrorSeverity, ErrorCategoryValues as ErrorCategory };

/**
 * Error formatting utilities
 */
export class ErrorFormatter {
  /**
   * Format error for display
   */
  static formatError(error: Error | ZernError): string {
    if (error instanceof ZernError) {
      return `[${error.code}] ${error.message}`;
    }
    return error.message;
  }

  /**
   * Format error with context
   */
  static formatErrorWithContext(
    error: Error | ZernError,
    context?: Record<string, unknown>
  ): string {
    const baseMessage = this.formatError(error);

    if (!context || Object.keys(context).length === 0) {
      return baseMessage;
    }

    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}: ${this.formatValue(value)}`)
      .join(', ');

    return `${baseMessage} (${contextStr})`;
  }

  /**
   * Format stack trace for display
   */
  static formatStackTrace(error: Error): string[] {
    if (!error.stack) {
      return [];
    }

    return error.stack
      .split('\n')
      .slice(1) // Remove the error message line
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  /**
   * Format value for display
   */
  private static formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[Object]';
      }
    }
    return String(value);
  }

  /**
   * Truncate long messages
   */
  static truncateMessage(message: string, maxLength: number = 200): string {
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength - 3) + '...';
  }

  /**
   * Format error for logging
   */
  static formatForLogging(error: Error | ZernError, includeStack: boolean = true): string {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] ${this.formatError(error)}`;

    if (error instanceof ZernError) {
      formatted += `\n  Category: ${error.category}`;
      formatted += `\n  Severity: ${error.severity}`;
      formatted += `\n  Plugin: ${error.context?.pluginId || 'core'}`;

      if (error.context && Object.keys(error.context).length > 0) {
        formatted += `\n  Context: ${JSON.stringify(error.context, null, 2)}`;
      }
    }

    if (includeStack && error.stack) {
      formatted += `\n  Stack:\n${error.stack}`;
    }

    return formatted;
  }
}

/**
 * Error analysis utilities
 */
export class ErrorAnalyzer {
  /**
   * Determine if error is recoverable
   */
  static isRecoverable(error: Error | ZernError): boolean {
    if (error instanceof ZernError) {
      // Critical errors are generally not recoverable
      if (error.severity === ErrorSeverityValues.CRITICAL) {
        return false;
      }

      // Some categories are more likely to be recoverable
      const recoverableCategories = [
        ErrorCategoryValues.NETWORK,
        ErrorCategoryValues.PLUGIN,
        ErrorCategoryValues.VALIDATION,
        ErrorCategoryValues.DEPENDENCY,
      ] as const;

      return (recoverableCategories as readonly ErrorCategory[]).includes(error.category);
    }

    // Check for specific error types
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return false; // Usually programming errors
    }

    if (error.name === 'NetworkError' || error.message.includes('network')) {
      return true; // Network errors are often temporary
    }

    return true; // Default to recoverable for unknown errors
  }

  /**
   * Determine error priority for handling
   */
  static getPriority(error: Error | ZernError): number {
    if (error instanceof ZernError) {
      switch (error.severity) {
        case ErrorSeverityValues.CRITICAL:
          return 1;
        case ErrorSeverityValues.HIGH:
          return 2;
        case ErrorSeverityValues.MEDIUM:
          return 3;
        case ErrorSeverityValues.LOW:
          return 4;
        default:
          return 5;
      }
    }

    // Analyze error type for priority
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return 1; // High priority for programming errors
    }

    if (error.name === 'NetworkError') {
      return 3; // Medium priority for network errors
    }

    return 4; // Low priority for unknown errors
  }

  /**
   * Extract error fingerprint for deduplication
   */
  static getFingerprint(error: Error | ZernError): string {
    const parts: string[] = [];

    // Add error type
    parts.push(error.name || 'Error');

    // Add error code if available
    if (error instanceof ZernError && error.code) {
      parts.push(error.code);
    }

    // Add normalized message (remove dynamic parts)
    const normalizedMessage = this.normalizeMessage(error.message);
    parts.push(normalizedMessage);

    // Add stack trace signature (first few frames)
    if (error.stack) {
      const stackFrames = error.stack.split('\n').slice(1, 4);
      const stackSignature = stackFrames
        .map((frame: string) => frame.replace(/:\d+:\d+/g, '')) // Remove line numbers
        .join('|');
      parts.push(stackSignature);
    }

    return parts.join('::');
  }

  /**
   * Normalize error message by removing dynamic content
   */
  private static normalizeMessage(message: string): string {
    return message
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID') // Replace UUIDs
      .replace(/https?:\/\/[^\s]+/g, 'URL') // Replace URLs
      .replace(/\/[^\s]+/g, 'PATH') // Replace file paths
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Check if error is a duplicate within time window
   */
  static isDuplicate(
    error: Error | ZernError,
    recentErrors: Array<{ error: Error | ZernError; timestamp: number }>,
    timeWindow: number = 5000
  ): boolean {
    const now = Date.now();
    const fingerprint = this.getFingerprint(error);

    return recentErrors.some(recent => {
      const timeDiff = now - recent.timestamp;
      if (timeDiff > timeWindow) return false;

      const recentFingerprint = this.getFingerprint(recent.error);
      return fingerprint === recentFingerprint;
    });
  }

  /**
   * Categorize error automatically
   */
  static categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors
    if (
      name.includes('network') ||
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('xhr') ||
      message.includes('timeout') ||
      message.includes('connection')
    ) {
      return ErrorCategoryValues.NETWORK;
    }

    // Validation errors
    if (
      name.includes('validation') ||
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      (name === 'typeerror' && message.includes('expected'))
    ) {
      return ErrorCategoryValues.VALIDATION;
    }

    // Plugin errors
    if (
      message.includes('plugin') ||
      message.includes('extension') ||
      message.includes('module not found')
    ) {
      return ErrorCategoryValues.PLUGIN;
    }

    // System errors
    if (
      name.includes('system') ||
      message.includes('system') ||
      message.includes('permission') ||
      message.includes('access')
    ) {
      return ErrorCategoryValues.FILESYSTEM;
    }

    // Security errors
    if (
      name.includes('security') ||
      message.includes('security') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    ) {
      return ErrorCategoryValues.SECURITY;
    }

    // Performance errors
    if (
      message.includes('memory') ||
      message.includes('performance') ||
      message.includes('slow') ||
      message.includes('timeout')
    ) {
      return ErrorCategoryValues.PERFORMANCE;
    }

    return ErrorCategoryValues.UNKNOWN;
  }

  /**
   * Determine error severity automatically
   */
  static determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Critical errors
    if (
      name === 'referenceerror' ||
      name === 'syntaxerror' ||
      message.includes('critical') ||
      message.includes('fatal') ||
      message.includes('crash') ||
      message.includes('segmentation')
    ) {
      return ErrorSeverityValues.CRITICAL;
    }

    // High severity errors
    if (
      name === 'typeerror' ||
      message.includes('error') ||
      message.includes('failed') ||
      message.includes('exception')
    ) {
      return ErrorSeverityValues.HIGH;
    }

    // Medium severity errors
    if (
      message.includes('warning') ||
      message.includes('deprecated') ||
      message.includes('timeout') ||
      message.includes('retry')
    ) {
      return ErrorSeverityValues.MEDIUM;
    }

    // Default to low severity
    return ErrorSeverityValues.LOW;
  }
}

/**
 * Error sanitization utilities
 */
export class ErrorSanitizer {
  private static readonly SENSITIVE_PATTERNS = [
    /password[=:]\s*[^\s]+/gi,
    /token[=:]\s*[^\s]+/gi,
    /key[=:]\s*[^\s]+/gi,
    /secret[=:]\s*[^\s]+/gi,
    /authorization:\s*[^\s]+/gi,
    /bearer\s+[^\s]+/gi,
    /api[_-]?key[=:]\s*[^\s]+/gi,
    /access[_-]?token[=:]\s*[^\s]+/gi,
  ];

  private static readonly SENSITIVE_KEYS = [
    'password',
    'token',
    'key',
    'secret',
    'authorization',
    'apiKey',
    'accessToken',
    'refreshToken',
    'privateKey',
    'publicKey',
    'sessionId',
    'cookie',
    'auth',
  ];

  /**
   * Sanitize error message
   */
  static sanitizeMessage(message: string): string {
    let sanitized = message;

    for (const pattern of this.SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, match => {
        const parts = match.split(/[=:]/);
        return parts[0] + (parts[1] ? '=***' : '');
      });
    }

    return sanitized;
  }

  /**
   * Sanitize error context
   */
  static sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(context)) {
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '***';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeMessage(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize entire error object
   */
  static sanitizeError(error: Error | ZernError): Error | ZernError {
    if (error instanceof ZernError) {
      // Create a new ZernError-like object with sanitized properties
      const sanitized = Object.create(Object.getPrototypeOf(error));
      Object.assign(sanitized, error, {
        message: this.sanitizeMessage(error.message),
        context: error.context
          ? this.sanitizeContext(error.context as unknown as Record<string, unknown>)
          : undefined,
      });
      return sanitized;
    } else {
      // For regular errors, just sanitize the message
      const sanitized = { ...error };
      sanitized.message = this.sanitizeMessage(error.message);
      return sanitized;
    }
  }

  /**
   * Check if key is sensitive
   */
  private static isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return this.SENSITIVE_KEYS.some(sensitiveKey => lowerKey.includes(sensitiveKey.toLowerCase()));
  }

  /**
   * Sanitize object recursively
   */
  private static sanitizeObject(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map(item =>
        typeof item === 'object' && item !== null ? this.sanitizeObject(item) : item
      );
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (this.isSensitiveKey(key)) {
          sanitized[key] = '***';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeObject(value);
        } else if (typeof value === 'string') {
          sanitized[key] = this.sanitizeMessage(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return obj;
  }
}

/**
 * Error conversion utilities
 */
export class ErrorConverter {
  /**
   * Convert native Error to ZernError
   */
  static toZernError(
    error: Error,
    code?: string,
    category?: ErrorCategory,
    severity?: ErrorSeverity,
    pluginId?: string,
    context?: Record<string, unknown>
  ): ZernError {
    // Note: This creates a basic ZernError-like object since ZernError is abstract
    // In practice, you would use a concrete implementation
    const zernError = Object.create(ZernError.prototype);
    zernError.message = error.message;
    zernError.code = code || 'UNKNOWN_ERROR';
    zernError.category = category || ErrorAnalyzer.categorizeError(error);
    zernError.severity = severity || ErrorAnalyzer.determineSeverity(error);
    zernError.recoverable = true;
    zernError.id = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    zernError.timestamp = Date.now();

    // Store pluginId in context if provided
    const mergedContext = { ...context };
    if (pluginId) {
      mergedContext.pluginId = pluginId;
    }
    zernError.context = Object.keys(mergedContext).length > 0 ? mergedContext : undefined;

    zernError.metadata = {};
    zernError.stack = error.stack;
    zernError.cause = error;
    zernError.name = 'ZernError';

    // Add required abstract methods
    zernError.getSuggestions = (): ErrorSuggestion[] => [];
    zernError.getRecoveryStrategies = (): RecoveryStrategy[] => [];

    return zernError;
  }

  /**
   * Convert ZernError to plain object for serialization
   */
  static toPlainObject(error: ZernError): Record<string, unknown> {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      category: error.category,
      severity: error.severity,
      pluginId: error.context?.pluginId,
      context: error.context,
      timestamp: error.timestamp,
      stack: error.stack,
      cause:
        error.cause && error.cause instanceof Error
          ? this.errorToPlainObject(error.cause)
          : undefined,
    };
  }

  /**
   * Convert plain object back to ZernError
   */
  static fromPlainObject(obj: Record<string, unknown>): ZernError {
    // Note: This creates a basic ZernError-like object since ZernError is abstract
    // In practice, you would use a concrete implementation
    const error = Object.create(ZernError.prototype);
    error.message = obj.message as string;
    error.code = obj.code as string;
    error.category = obj.category as ErrorCategory;
    error.severity = obj.severity as ErrorSeverity;
    error.recoverable = true;
    error.id = (obj.id as string) || `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    error.timestamp = (obj.timestamp as number) || Date.now();

    // Handle context and pluginId
    const context = (obj.context as Record<string, unknown>) || {};
    if (obj.pluginId) {
      context.pluginId = obj.pluginId as string;
    }
    error.context = Object.keys(context).length > 0 ? context : undefined;

    error.metadata = (obj.metadata as Record<string, unknown>) || {};
    error.stack = obj.stack as string;
    error.name = (obj.name as string) || 'ZernError';

    if (obj.cause) {
      error.cause = this.plainObjectToError(obj.cause as Record<string, unknown>);
    }

    // Add required abstract methods
    error.getSuggestions = (): ErrorSuggestion[] => [];
    error.getRecoveryStrategies = (): RecoveryStrategy[] => [];

    return error;
  }

  /**
   * Convert any error to plain object
   */
  private static errorToPlainObject(error: Error): Record<string, unknown> {
    if (error instanceof ZernError) {
      return this.toPlainObject(error);
    }

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  /**
   * Convert plain object to Error
   */
  private static plainObjectToError(obj: Record<string, unknown>): Error {
    if (obj.code && obj.category && obj.severity) {
      return this.fromPlainObject(obj);
    }

    const error = new Error(obj.message as string);
    error.name = obj.name as string;
    error.stack = obj.stack as string;
    return error;
  }
}

/**
 * Error validation utilities
 */
export class ErrorValidator {
  /**
   * Validate error object structure
   */
  static isValidError(error: unknown): error is Error {
    return (
      error instanceof Error ||
      (typeof error === 'object' &&
        error !== null &&
        typeof (error as Record<string, unknown>).message === 'string' &&
        typeof (error as Record<string, unknown>).name === 'string')
    );
  }

  /**
   * Validate ZernError structure
   */
  static isValidZernError(error: unknown): error is ZernError {
    if (error instanceof ZernError) {
      return true;
    }

    if (!this.isValidError(error)) {
      return false;
    }

    const errorRecord = error as unknown as Record<string, unknown>;
    return (
      typeof errorRecord.code === 'string' &&
      typeof errorRecord.category === 'string' &&
      typeof errorRecord.severity === 'string' &&
      typeof errorRecord.timestamp === 'number'
    );
  }

  /**
   * Validate error context
   */
  static isValidContext(context: unknown): context is Record<string, unknown> {
    return typeof context === 'object' && context !== null && !Array.isArray(context);
  }

  /**
   * Validate error severity
   */
  static isValidSeverity(severity: unknown): severity is ErrorSeverity {
    return Object.values(ErrorSeverityValues).includes(severity as ErrorSeverity);
  }

  /**
   * Validate error category
   */
  static isValidCategory(category: unknown): category is ErrorCategory {
    return Object.values(ErrorCategoryValues).includes(category as ErrorCategory);
  }
}

/**
 * Utility functions for common error operations
 */
export const ErrorUtils = {
  formatter: ErrorFormatter,
  analyzer: ErrorAnalyzer,
  sanitizer: ErrorSanitizer,
  converter: ErrorConverter,
  validator: ErrorValidator,

  /**
   * Create a standardized error ID
   */
  createErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Get error age in milliseconds
   */
  getErrorAge(error: ZernError): number {
    return Date.now() - error.timestamp;
  },

  /**
   * Check if error is stale
   */
  isStale(error: ZernError, maxAge: number = 300000): boolean {
    return this.getErrorAge(error) > maxAge;
  },

  /**
   * Merge error contexts
   */
  mergeContexts(...contexts: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
    return Object.assign({}, ...contexts.filter(Boolean));
  },

  /**
   * Extract error chain
   */
  getErrorChain(error: Error): Error[] {
    const chain: Error[] = [error];
    let current = error;

    while (current.cause && current.cause instanceof Error) {
      chain.push(current.cause);
      current = current.cause;
    }

    return chain;
  },

  /**
   * Get root cause of error
   */
  getRootCause(error: Error): Error {
    const chain = this.getErrorChain(error);
    return chain[chain.length - 1]!; // Safe because chain always has at least one element
  },
};
