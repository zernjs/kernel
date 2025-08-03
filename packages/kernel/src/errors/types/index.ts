/**
 * @fileoverview Error types barrel export
 * @module @zern/kernel/errors/types
 */

// Base types and interfaces
export * from './base.js';

// Kernel-specific errors
export * from './kernel-errors.js';

// Plugin-specific errors
export * from './plugin-errors.js';

// Dependency-related errors
export * from './dependency-errors.js';

// Validation errors
export * from './validation-errors.js';

// Custom and extensible errors
export * from './custom-errors.js';

// Type guards and utilities
export function isZernError(error: unknown): error is import('./base.js').ZernError {
  return error instanceof Error && 'category' in error && 'severity' in error && 'code' in error;
}

export function isKernelError(error: unknown): error is import('./kernel-errors.js').KernelError {
  return isZernError(error) && error.category === 'kernel';
}

export function isPluginError(error: unknown): error is import('./plugin-errors.js').PluginError {
  return isZernError(error) && error.category === 'plugin';
}

export function isDependencyError(
  error: unknown
): error is import('./dependency-errors.js').DependencyError {
  return isZernError(error) && error.category === 'dependency';
}

export function isValidationError(
  error: unknown
): error is import('./validation-errors.js').ValidationError {
  return isZernError(error) && error.category === 'validation';
}

export function isNetworkError(error: unknown): error is import('./custom-errors.js').NetworkError {
  return isZernError(error) && error.category === 'network';
}

export function isFilesystemError(
  error: unknown
): error is import('./custom-errors.js').FilesystemError {
  return isZernError(error) && error.category === 'filesystem';
}

export function isSecurityError(
  error: unknown
): error is import('./custom-errors.js').SecurityError {
  return isZernError(error) && error.category === 'security';
}

export function isPerformanceError(
  error: unknown
): error is import('./custom-errors.js').PerformanceError {
  return isZernError(error) && error.category === 'performance';
}

export function isCriticalError(error: unknown): boolean {
  return isZernError(error) && error.severity === 'critical';
}

export function isRecoverableError(error: unknown): boolean {
  return isZernError(error) && error.recoverable;
}

/**
 * Get error category from any error
 */
export function getErrorCategory(error: unknown): string {
  if (isZernError(error)) {
    return error.category;
  }
  return 'unknown';
}

/**
 * Get error severity from any error
 */
export function getErrorSeverity(error: unknown): 'low' | 'medium' | 'high' | 'critical' {
  if (isZernError(error)) {
    return error.severity;
  }
  return 'medium';
}

/**
 * Check if error is recoverable
 */
export function canRecover(error: unknown): boolean {
  if (isZernError(error)) {
    return error.recoverable;
  }
  return false;
}
