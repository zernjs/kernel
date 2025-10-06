import { ZernError } from './base';
import type { ErrorSolution, ErrorContext } from './types';
import { ErrorSeverity } from './types';

export function solution(title: string, description: string, code?: string): ErrorSolution {
  return { title, description, code };
}

export function createError<T extends ZernError>(
  ErrorClass: new (context?: ErrorContext) => T,
  context?: ErrorContext,
  overrides?: {
    message?: string;
    severity?: ErrorSeverity;
    solutions?: ErrorSolution[];
    cause?: Error;
  }
): T {
  const error = new ErrorClass(context);

  if (overrides) {
    if (overrides.message) error.message = overrides.message;
    if (overrides.severity) error.severity = overrides.severity;
    if (overrides.solutions) error.solutions = overrides.solutions;
    if (overrides.cause) error.cause = overrides.cause;
  }

  return error;
}

export function throwError<T extends ZernError>(
  ErrorClass: new (context?: ErrorContext) => T,
  context?: ErrorContext,
  overrides?: {
    message?: string;
    severity?: ErrorSeverity;
    solutions?: ErrorSolution[];
    cause?: Error;
  }
): never {
  throw createError(ErrorClass, context, overrides);
}

export class ErrorMatcher<T = unknown> {
  private matched = false;

  constructor(private error: Error) {}

  on<E extends ZernError>(
    ErrorClass: new (...args: unknown[]) => E,
    handler: (error: E) => T
  ): ErrorMatcher<T> {
    if (!this.matched && this.error instanceof ErrorClass) {
      this.matched = true;
      handler(this.error as E);
    }
    return this;
  }

  whenSeverity(severity: ErrorSeverity, handler: (error: ZernError) => T): ErrorMatcher<T> {
    if (!this.matched && this.error instanceof ZernError && this.error.severity === severity) {
      this.matched = true;
      handler(this.error);
    }
    return this;
  }

  otherwise(handler: (error: Error) => T): T | undefined {
    if (!this.matched) {
      return handler(this.error);
    }
    return undefined;
  }
}

export function matchError(error: Error): ErrorMatcher {
  return new ErrorMatcher(error);
}

export function developmentConfig(): { errors: Required<import('./types').ErrorConfig> } {
  return {
    errors: {
      captureStackTrace: true,
      stackTraceLimit: 20,
      filterInternalFrames: false,
      enableColors: true,
      showContext: true,
      showSolutions: true,
      showTimestamp: true,
      severity: ErrorSeverity.ERROR,
    },
  };
}

export function productionConfig(): { errors: Required<import('./types').ErrorConfig> } {
  return {
    errors: {
      captureStackTrace: false,
      stackTraceLimit: 0,
      filterInternalFrames: true,
      enableColors: false,
      showContext: false,
      showSolutions: false,
      showTimestamp: true,
      severity: ErrorSeverity.ERROR,
    },
  };
}
