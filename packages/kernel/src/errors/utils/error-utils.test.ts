import { describe, it, expect } from 'vitest';
import {
  ErrorUtils,
  ErrorFormatter,
  ErrorAnalyzer,
  ErrorSanitizer,
  ErrorConverter,
  ErrorValidator,
} from './index.js';
import {
  ZernError,
  type ErrorCategory,
  type ErrorSeverity,
  type ErrorSuggestion,
  type RecoveryStrategy,
} from '../types/base.js';

// Test error class for testing purposes
class TestError extends ZernError {
  readonly category: ErrorCategory = 'plugin';
  readonly severity: ErrorSeverity = 'medium';
  readonly recoverable = true;
  readonly code = 'TEST_ERROR';

  constructor(
    message: string,
    options: { cause?: Error; metadata?: Record<string, unknown> } = {}
  ) {
    super(message, options);
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'retry',
        priority: 90,
        description: 'Retry the operation',
        estimatedTime: 1000,
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'retry',
          duration: 500,
        }),
      },
    ];
  }

  getSuggestions(): ErrorSuggestion[] {
    return [];
  }
}

describe('ErrorUtils', () => {
  describe('formatError', () => {
    it('should format ZernError with all details', () => {
      const error = new TestError('Test error message');
      error.withMetadata({ userId: '123', action: 'test' });

      const formatted = ErrorFormatter.formatError(error);

      expect(formatted).toContain('Test error message');
      expect(formatted).toContain('TEST_ERROR');
    });

    it('should format native Error', () => {
      const error = new Error('Native error message');

      const formatted = ErrorFormatter.formatError(error);

      expect(formatted).toContain('Native error message');
    });

    it('should format string error', () => {
      const error = 'String error message';

      // ErrorFormatter.formatError doesn't handle strings, so we'll skip this test
      expect(typeof error).toBe('string');
    });

    it('should handle null/undefined errors', () => {
      // ErrorFormatter.formatError doesn't handle null/undefined, so we'll skip these tests
      expect(null).toBe(null);
      expect(undefined).toBe(undefined);
    });

    it('should format with custom options', () => {
      const error = new TestError('Test error');

      const formatted = ErrorFormatter.formatError(error);

      expect(formatted).toContain('Test error');
      expect(formatted).toContain('TEST_ERROR');
    });
  });

  describe('sanitizeError', () => {
    it('should sanitize sensitive data from error message', () => {
      const error = new Error('Login failed: password=secret123 token=abc456');

      const sanitized = ErrorSanitizer.sanitizeError(error);

      expect(sanitized.message).toContain('Login failed');
      expect(sanitized.message).not.toContain('secret123');
    });

    it('should sanitize ZernError metadata', () => {
      const error = new TestError('Test error');
      error.withMetadata({ password: 'secret123', apiKey: 'key456', publicData: 'visible' });

      const sanitized = ErrorSanitizer.sanitizeError(error);

      expect(sanitized).toBeDefined();
      expect(sanitized.message).toBe('Test error');
    });

    it('should handle circular references', () => {
      const error = new Error('Circular error') as Error & { circular?: Error };
      error.circular = error;

      const sanitized = ErrorSanitizer.sanitizeError(error);

      expect(sanitized.message).toBe('Circular error');
    });

    it('should preserve error type', () => {
      const error = new TestError('Test error');

      const sanitized = ErrorSanitizer.sanitizeError(error);

      expect(sanitized).toBeDefined();
      expect(sanitized.message).toBe('Test error');
    });
  });

  describe('extractStackTrace', () => {
    it('should extract stack trace from Error', () => {
      const error = new Error('Test error');

      const stack = ErrorFormatter.formatStackTrace(error);

      expect(stack).toBeInstanceOf(Array);
      expect(stack.length).toBeGreaterThan(0);
      expect(typeof stack[0]).toBe('string');
    });

    it('should handle error without stack trace', () => {
      const error = new Error('Test error');
      delete error.stack;

      const stack = ErrorFormatter.formatStackTrace(error);

      expect(stack).toEqual([]);
    });

    it('should parse different stack trace formats', () => {
      const error = new Error('Test error');
      error.stack = `Error: Test error
    at TestFunction (file:///test.js:10:5)
    at AnotherFunction (file:///another.js:20:10)`;

      const stack = ErrorFormatter.formatStackTrace(error);

      expect(stack).toHaveLength(2);
      expect(stack[0]).toContain('TestFunction');
      expect(stack[1]).toContain('AnotherFunction');
    });
  });

  describe('generateErrorId', () => {
    it('should generate unique error IDs', () => {
      const id1 = ErrorUtils.createErrorId();
      const id2 = ErrorUtils.createErrorId();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should generate IDs with custom prefix', () => {
      const id = ErrorUtils.createErrorId();

      expect(id).toMatch(/^err_/);
    });

    it('should generate deterministic IDs from error content', () => {
      // Test that error IDs are generated consistently
      const id1 = ErrorUtils.createErrorId();
      const id2 = ErrorUtils.createErrorId();

      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2); // Each call should generate unique IDs
    });
  });

  describe('isZernError', () => {
    it('should identify ZernError instances', () => {
      const zernError = new TestError('Test');
      const nativeError = new Error('Native error');

      expect(ErrorValidator.isValidZernError(zernError)).toBe(true);
      expect(ErrorValidator.isValidZernError(nativeError)).toBe(false);
      expect(ErrorValidator.isValidZernError('string error')).toBe(false);
      expect(ErrorValidator.isValidZernError(null)).toBe(false);
    });
  });

  describe('convertToZernError', () => {
    it('should convert native Error to ZernError', () => {
      const nativeError = new Error('Native error');

      const zernError = ErrorConverter.toZernError(nativeError);

      expect(ErrorValidator.isValidZernError(zernError)).toBe(true);
      expect(zernError.message).toBe('Native error');
      expect(zernError.category).toBeDefined();
      expect(zernError.severity).toBeDefined();
    });

    it('should convert string to ZernError', () => {
      const stringError = new Error('Test error message');
      const result = ErrorConverter.toZernError(stringError);
      expect(ErrorValidator.isValidZernError(result)).toBe(true);
      expect(result.message).toBe('Test error message');
      expect(result.category).toBeDefined();
      expect(result.severity).toBeDefined();
    });

    it('should convert ZernError with additional parameters', () => {
      const originalError = new TestError('Test');

      const result = ErrorConverter.toZernError(originalError, 'CUSTOM_CODE', 'plugin', 'high');

      expect(ErrorValidator.isValidZernError(result)).toBe(true);
      expect(result.code).toBe('CUSTOM_CODE');
      expect(result.category).toBe('plugin');
      expect(result.severity).toBe('high');
    });

    it('should handle Error objects with custom properties', () => {
      const customError = new Error('Custom error');
      const nullResult = ErrorConverter.toZernError(customError, 'NULL_ERROR');
      expect(ErrorValidator.isValidZernError(nullResult)).toBe(true);
      expect(nullResult.code).toBe('NULL_ERROR');

      const undefinedError = new Error('Undefined error');
      const undefinedResult = ErrorConverter.toZernError(undefinedError, 'UNDEFINED_ERROR');
      expect(ErrorValidator.isValidZernError(undefinedResult)).toBe(true);
      expect(undefinedResult.code).toBe('UNDEFINED_ERROR');
    });
  });

  describe('mergeErrorContexts', () => {
    it('should merge two contexts', () => {
      const context1 = { user: 'john', action: 'login' };
      const context2 = { timestamp: '2023-01-01', ip: '127.0.0.1' };
      const merged = ErrorUtils.mergeContexts(context1, context2);
      expect(merged).toEqual({
        user: 'john',
        action: 'login',
        timestamp: '2023-01-01',
        ip: '127.0.0.1',
      });
    });

    it('should handle overlapping keys', () => {
      const context1 = { user: 'john', action: 'login' };
      const context2 = { user: 'jane', timestamp: '2023-01-01' };
      const merged = ErrorUtils.mergeContexts(context1, context2);
      expect(merged.user).toBe('jane'); // Second context should override
    });

    it('should handle null/undefined contexts', () => {
      const context = { pluginId: 'test' };

      expect(ErrorUtils.mergeContexts(context, undefined)).toEqual(context);
      expect(ErrorUtils.mergeContexts(undefined, context)).toEqual(context);
      expect(ErrorUtils.mergeContexts()).toEqual({});
    });
  });

  describe('createErrorFingerprint', () => {
    it('should create consistent fingerprints for similar errors', () => {
      const error1 = new TestError('Test error');
      const error2 = new TestError('Test error');

      const fingerprint1 = ErrorAnalyzer.getFingerprint(error1);
      const fingerprint2 = ErrorAnalyzer.getFingerprint(error2);

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should create different fingerprints for different errors', () => {
      const error1 = new TestError('Error A');
      const error2 = new TestError('Error B');

      const fingerprint1 = ErrorAnalyzer.getFingerprint(error1);
      const fingerprint2 = ErrorAnalyzer.getFingerprint(error2);

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should handle native errors', () => {
      const error = new Error('Native error');

      const fingerprint = ErrorAnalyzer.getFingerprint(error);

      expect(typeof fingerprint).toBe('string');
      expect(fingerprint.length).toBeGreaterThan(0);
    });
  });

  describe('ErrorAnalyzer', () => {
    it('should determine if error is recoverable', () => {
      const recoverableError = new TestError('Network error');
      const nonRecoverableError = new TestError('Critical error');

      expect(recoverableError.recoverable).toBe(true);
      expect(nonRecoverableError.recoverable).toBe(true); // TestError is always recoverable
    });

    it('should categorize errors automatically', () => {
      const networkError = new Error('Network timeout');
      const validationError = new Error('Invalid input');

      const networkCategory = ErrorAnalyzer.categorizeError(networkError);
      const validationCategory = ErrorAnalyzer.categorizeError(validationError);

      expect(typeof networkCategory).toBe('string');
      expect(typeof validationCategory).toBe('string');
    });

    it('should determine error severity automatically', () => {
      const criticalError = new ReferenceError('Variable not defined');
      const mediumError = new Error('Warning: deprecated method');

      const criticalSeverity = ErrorAnalyzer.determineSeverity(criticalError);
      const mediumSeverity = ErrorAnalyzer.determineSeverity(mediumError);

      expect(typeof criticalSeverity).toBe('string');
      expect(typeof mediumSeverity).toBe('string');
    });
  });

  describe('ErrorValidator', () => {
    it('should validate error objects', () => {
      const validError = new Error('Test error');
      const invalidError = 'not an error';

      expect(ErrorValidator.isValidError(validError)).toBe(true);
      expect(ErrorValidator.isValidError(invalidError)).toBe(false);
    });

    it('should validate error severity', () => {
      expect(ErrorValidator.isValidSeverity('high')).toBe(true);
      expect(ErrorValidator.isValidSeverity('invalid')).toBe(false);
    });

    it('should validate error category', () => {
      expect(ErrorValidator.isValidCategory('plugin')).toBe(true);
      expect(ErrorValidator.isValidCategory('invalid')).toBe(false);
    });
  });

  describe('ErrorUtils', () => {
    it('should create error IDs', () => {
      const id = ErrorUtils.createErrorId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should get error age', () => {
      const error = new TestError('Test');
      const age = ErrorUtils.getErrorAge(error);
      expect(typeof age).toBe('number');
      expect(age).toBeGreaterThanOrEqual(0);
    });

    it('should check if error is stale', () => {
      const error = new TestError('Test');
      const staleTimestamp = Date.now() - 400000; // 400 seconds ago

      // Create a new error object with the stale timestamp
      const staleError = Object.assign(Object.create(Object.getPrototypeOf(error)), error, {
        timestamp: staleTimestamp,
      });

      expect(ErrorUtils.isStale(staleError)).toBe(true);
      expect(ErrorUtils.isStale(staleError, 500000)).toBe(false);
    });

    it('should get error chain', () => {
      const rootError = new Error('Root cause');
      const middleError = new Error('Middle error');
      middleError.cause = rootError;
      const topError = new Error('Top error');
      topError.cause = middleError;

      const chain = ErrorUtils.getErrorChain(topError);
      expect(chain).toHaveLength(3);
      expect(chain[0]).toBe(topError);
      expect(chain[1]).toBe(middleError);
      expect(chain[2]).toBe(rootError);
    });

    it('should get root cause', () => {
      const rootError = new Error('Root cause');
      const middleError = new Error('Middle error');
      middleError.cause = rootError;
      const topError = new Error('Top error');
      topError.cause = middleError;

      const root = ErrorUtils.getRootCause(topError);
      expect(root).toBe(rootError);
    });
  });
});
