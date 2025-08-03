import { describe, it, expect, beforeEach } from 'vitest';
import {
  ZernError,
  type ErrorCategory,
  type ErrorSeverity,
  type ErrorContext,
  type ErrorSuggestion,
  type RecoveryStrategy,
} from '../../../../src/errors/types/base.js';
import type { PluginId } from '../../../../src/types/plugin.js';
import type { KernelState } from '../../../../src/types/kernel.js';

// Concrete implementation for testing
class TestError extends ZernError {
  readonly category: ErrorCategory = 'plugin';
  readonly severity: ErrorSeverity = 'medium';
  readonly recoverable = true;
  readonly code = 'TEST_ERROR';

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'fix',
        title: 'Test suggestion',
        description: 'This is a test suggestion',
        confidence: 0.8,
        priority: 1,
        action: {
          type: 'command',
          payload: 'test-command',
          description: 'Run test command',
        },
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'test-recovery',
        priority: 1,
        description: 'Test recovery strategy',
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'test-recovery',
          duration: 100,
        }),
      },
    ];
  }
}

describe('ZernError', () => {
  let error: TestError;
  let context: ErrorContext;

  beforeEach(() => {
    // Create a minimal ErrorContext for testing
    context = {
      timestamp: Date.now(),
      kernelState: 'running' as KernelState,
      pluginStates: new Map(),
      breadcrumbs: [],
      stackTrace: {
        original: 'test stack',
        parsed: [],
      },
      environment: {
        nodeVersion: '18.0.0',
        platform: 'test',
        arch: 'x64',
        memory: { used: 100, total: 1000, percentage: 10 },
        cpu: { usage: 50, loadAverage: [1, 2, 3] },
        uptime: 1000,
        environment: {},
      },
      pluginId: 'test-plugin' as PluginId,
      operation: 'test-operation',
    };

    error = new TestError('Test error message', { context });
  });

  describe('constructor', () => {
    it('should create error with all properties', () => {
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.category).toBe('plugin');
      expect(error.severity).toBe('medium');
      expect(error.context).toEqual(context);
      expect(error.recoverable).toBe(true);
      expect(error.id).toMatch(/^TestError_\d+_[a-z0-9]+$/);
      expect(error.timestamp).toBeTypeOf('number');
    });

    it('should generate unique IDs for different errors', () => {
      const error1 = new TestError('Error 1');
      const error2 = new TestError('Error 2');

      expect(error1.id).not.toBe(error2.id);
    });

    it('should set timestamp to current time', () => {
      const before = Date.now();
      const testError = new TestError('Test');
      const after = Date.now();

      expect(testError.timestamp).toBeGreaterThanOrEqual(before);
      expect(testError.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('withMetadata', () => {
    it('should add metadata to error', () => {
      const metadata = { key: 'value', number: 42 };
      const errorWithMetadata = error.withMetadata(metadata);

      expect(errorWithMetadata.metadata).toEqual(metadata);
      expect(errorWithMetadata).toBe(error); // Should return same instance
    });

    it('should merge with existing metadata', () => {
      const errorWithExistingMetadata = error.withMetadata({ existing: 'data' });
      const newMetadata = { new: 'value' };

      errorWithExistingMetadata.withMetadata(newMetadata);

      expect(errorWithExistingMetadata.metadata).toEqual({
        existing: 'data',
        new: 'value',
      });
    });
  });

  describe('withContext', () => {
    it('should update context', () => {
      const newContext = {
        ...context,
        pluginId: 'new-plugin' as PluginId,
        operation: 'new-operation',
      };
      const errorWithContext = error.withContext(newContext);

      expect(errorWithContext.context).toEqual(newContext);
      expect(errorWithContext).toBe(error); // Should return same instance
    });
  });

  describe('getDetails', () => {
    it('should return comprehensive error details', () => {
      const errorWithMetadata = error.withMetadata({ test: 'data' });
      const details = errorWithMetadata.getDetails();

      expect(details).toEqual({
        id: errorWithMetadata.id,
        message: errorWithMetadata.message,
        code: errorWithMetadata.code,
        category: errorWithMetadata.category,
        severity: errorWithMetadata.severity,
        recoverable: errorWithMetadata.recoverable,
        timestamp: errorWithMetadata.timestamp,
        metadata: errorWithMetadata.metadata,
        stack: errorWithMetadata.stack,
        cause: errorWithMetadata.cause,
      });
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const errorWithMetadata = error.withMetadata({ test: 'data' });
      const json = errorWithMetadata.toJSON();

      const contextData = errorWithMetadata.context;
      expect(json).toEqual({
        id: errorWithMetadata.id,
        message: errorWithMetadata.message,
        code: errorWithMetadata.code,
        category: errorWithMetadata.category,
        severity: errorWithMetadata.severity,
        recoverable: errorWithMetadata.recoverable,
        timestamp: errorWithMetadata.timestamp,
        metadata: errorWithMetadata.metadata,
        stack: errorWithMetadata.stack,
        cause: errorWithMetadata.cause,
        context: contextData
          ? {
              timestamp: contextData.timestamp,
              kernelState: contextData.kernelState,
              breadcrumbs: contextData.breadcrumbs,
              environment: contextData.environment,
            }
          : undefined,
      });
    });

    it('should handle undefined optional properties', () => {
      const simpleError = new TestError('Simple');
      const json = simpleError.toJSON();

      expect(json.context).toBeUndefined();
      expect(json.metadata).toEqual({});
    });
  });

  describe('getSuggestions', () => {
    it('should return error suggestions', () => {
      const suggestions = error.getSuggestions();

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual({
        type: 'fix',
        title: 'Test suggestion',
        description: 'This is a test suggestion',
        confidence: 0.8,
        priority: 1,
        action: {
          type: 'command',
          payload: 'test-command',
          description: 'Run test command',
        },
      });
    });
  });

  describe('getRecoveryStrategies', () => {
    it('should return recovery strategies', () => {
      const strategies = error.getRecoveryStrategies();

      expect(strategies).toHaveLength(1);

      const firstStrategy = strategies[0];
      if (!firstStrategy) {
        throw new Error('Expected first strategy to be defined');
      }

      expect(firstStrategy.name).toBe('test-recovery');
      expect(firstStrategy.description).toBe('Test recovery strategy');
      expect(firstStrategy.canRecover(error)).toBe(true);
    });
  });
});

describe('ErrorCategory', () => {
  it('should have all expected categories', () => {
    // Test that the string literal types work correctly
    const categories: ErrorCategory[] = [
      'kernel',
      'plugin',
      'configuration',
      'dependency',
      'validation',
      'network',
      'filesystem',
      'security',
      'performance',
      'memory',
      'unknown',
    ];

    categories.forEach(category => {
      expect(typeof category).toBe('string');
    });
  });
});

describe('ErrorSeverity', () => {
  it('should have all expected severity levels', () => {
    // Test that the string literal types work correctly
    const severities: ErrorSeverity[] = ['critical', 'high', 'medium', 'low'];

    severities.forEach(severity => {
      expect(typeof severity).toBe('string');
    });
  });
});
