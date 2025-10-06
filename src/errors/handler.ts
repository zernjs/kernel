import { ErrorSeverity, type ErrorConfig } from './types';
import { ZernError, GenericError } from './base';
import { formatError } from './formatter';

export class ErrorHandler {
  private config: Required<ErrorConfig>;

  constructor(config?: Partial<ErrorConfig>) {
    this.config = {
      captureStackTrace: config?.captureStackTrace ?? true,
      stackTraceLimit: config?.stackTraceLimit ?? 10,
      filterInternalFrames: config?.filterInternalFrames ?? true,
      enableColors: config?.enableColors ?? true,
      showContext: config?.showContext ?? true,
      showSolutions: config?.showSolutions ?? true,
      showTimestamp: config?.showTimestamp ?? false,
      severity: config?.severity ?? ErrorSeverity.ERROR,
    };

    if (this.config.captureStackTrace && typeof Error.stackTraceLimit !== 'undefined') {
      Error.stackTraceLimit = this.config.stackTraceLimit;
    }
  }

  handle(error: Error | ZernError): void {
    const zernError = this.normalizeError(error);

    const formatted = formatError(zernError, this.config);
    this.display(formatted, zernError.severity);
  }

  private normalizeError(error: Error | ZernError): ZernError {
    if (error instanceof ZernError) {
      return error;
    }

    return new GenericError(error.message, {
      cause: error,
      severity: this.config.severity,
    });
  }

  private display(formatted: string, severity: ErrorSeverity): void {
    switch (severity) {
      case ErrorSeverity.INFO:
        console.info(formatted);
        break;
      case ErrorSeverity.WARN:
        console.warn(formatted);
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.FATAL:
        console.error(formatted);
        break;
    }
  }

  configure(config: Partial<ErrorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): Readonly<Required<ErrorConfig>> {
    return { ...this.config };
  }
}
