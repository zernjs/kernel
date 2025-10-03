/**
 * Custom Error Classes
 */

import { MathErrorCode, ERROR_MESSAGES } from './error-codes';

/**
 * Base Math Error - all math errors extend this
 */
export class MathError extends Error {
  constructor(
    message: string,
    public readonly code: MathErrorCode,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MathError';
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Convert error to JSON for logging/debugging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Factory function to create MathError instances
 */
export function createMathError(code: MathErrorCode, context?: Record<string, unknown>): MathError {
  const message = ERROR_MESSAGES[code];
  return new MathError(message, code, context);
}

/**
 * Helper to check if an error is a MathError
 */
export function isMathError(error: unknown): error is MathError {
  return error instanceof MathError;
}
