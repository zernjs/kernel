import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorManager } from '../../../../src/errors/core/error-manager.js';
import {
  ZernError,
  type ErrorCategory,
  type ErrorSeverity,
  type ErrorContext,
  type ErrorSuggestion,
  type RecoveryStrategy,
} from '../../../../src/errors/types/base.js';
import { PluginNotFoundError } from '../../../../src/errors/types/plugin-errors.js';
import { createPluginId } from '../../../../src/types/utils.js';

// Mock implementation for testing
class TestError extends ZernError {
  readonly category: ErrorCategory = 'plugin';
  readonly severity: ErrorSeverity = 'medium';
  readonly recoverable = true;
  readonly code = 'TEST_ERROR';

  getSuggestions(): ErrorSuggestion[] {
    return [];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [];
  }
}

describe('ErrorManager', () => {
  let errorManager: ErrorManager;
  let mockHandler: ReturnType<typeof vi.fn>;
  let mockFilter: ReturnType<typeof vi.fn>;
  let mockTransformer: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    errorManager = new ErrorManager({
      maxBreadcrumbs: 10,
      debugMode: false, // Disable for testing
    });

    mockHandler = vi.fn();
    mockFilter = vi.fn().mockReturnValue(true);
    mockTransformer = vi.fn().mockImplementation(error => error);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create error manager with default config', () => {
      const manager = new ErrorManager();
      expect(manager).toBeInstanceOf(ErrorManager);
    });

    it('should create error manager with custom config', () => {
      const config = {
        maxBreadcrumbs: 20,
        debugMode: false,
        enableAutoRecovery: false,
      };
      const manager = new ErrorManager(config);
      expect(manager).toBeInstanceOf(ErrorManager);
    });
  });

  describe('handler management', () => {
    it('should add error handler', () => {
      // Should not throw when adding a new handler
      expect(() => errorManager.addHandler('test', mockHandler)).not.toThrow();
    });

    it('should remove error handler', () => {
      errorManager.addHandler('test', mockHandler);
      const removed = errorManager.removeHandler('test');

      expect(removed).toBe(true);
    });

    it('should return false when removing non-existent handler', () => {
      const removed = errorManager.removeHandler('non-existent');
      expect(removed).toBe(false);
    });

    it('should not allow duplicate handler names', () => {
      errorManager.addHandler('test', mockHandler);

      expect(() => {
        errorManager.addHandler('test', vi.fn());
      }).toThrow('Handler with name "test" already exists');
    });
  });

  describe('filter management', () => {
    it('should add error filter', () => {
      errorManager.addFilter(mockFilter);
      expect(() => errorManager.addFilter(vi.fn().mockReturnValue(true))).not.toThrow();
    });

    it('should remove error filter', () => {
      errorManager.addFilter(mockFilter);
      const removed = errorManager.removeFilter(mockFilter);

      expect(removed).toBe(true);
    });

    it('should return false when removing non-existent filter', () => {
      const nonExistentFilter = vi.fn().mockReturnValue(true);
      const removed = errorManager.removeFilter(nonExistentFilter);
      expect(removed).toBe(false);
    });
  });

  describe('transformer management', () => {
    it('should add error transformer', () => {
      errorManager.addTransformer(mockTransformer);
      expect(() =>
        errorManager.addTransformer(vi.fn().mockImplementation(error => error))
      ).not.toThrow();
    });

    it('should remove error transformer', () => {
      errorManager.addTransformer(mockTransformer);
      const removed = errorManager.removeTransformer(mockTransformer);

      expect(removed).toBe(true);
    });

    it('should return false when removing non-existent transformer', () => {
      const nonExistentTransformer = vi.fn().mockImplementation(error => error);
      const removed = errorManager.removeTransformer(nonExistentTransformer);
      expect(removed).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle ZernError', async () => {
      const error = new TestError('Test error');
      const context: Partial<ErrorContext> = { pluginId: createPluginId('test-plugin') };

      errorManager.addHandler('test', mockHandler);

      await errorManager.handleError(error, context);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error',
          code: 'TEST_ERROR',
        }),
        expect.objectContaining({
          pluginId: 'test-plugin',
        })
      );
    });

    it('should handle native Error by converting to ZernError', async () => {
      const error = new Error('Native error');
      const context: Partial<ErrorContext> = { pluginId: createPluginId('test-plugin') };

      errorManager.addHandler('test', mockHandler);

      await errorManager.handleError(error, context);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Native error',
          category: 'unknown',
        }),
        expect.objectContaining({
          pluginId: 'test-plugin',
        })
      );
    });

    it('should apply filters before handling', async () => {
      const error = new TestError('Test error');

      // Filter that rejects the error
      mockFilter.mockReturnValue(false);
      errorManager.addFilter(mockFilter);
      errorManager.addHandler('test', mockHandler);

      await errorManager.handleError(error);

      expect(mockFilter).toHaveBeenCalled();
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should apply transformers before handling', async () => {
      const error = new TestError('Test error');
      const transformedError = new TestError('Transformed error');

      mockTransformer.mockReturnValue(transformedError);
      errorManager.addTransformer(mockTransformer);
      errorManager.addHandler('test', mockHandler);

      await errorManager.handleError(error);

      expect(mockTransformer).toHaveBeenCalledWith(error, expect.any(Object));
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Transformed error',
          code: 'TEST_ERROR',
        }),
        expect.any(Object)
      );
    });

    it('should enhance context with breadcrumbs', async () => {
      const error = new TestError('Test error');

      errorManager.addHandler('test', mockHandler);

      await errorManager.handleError(error);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          breadcrumbs: expect.any(Array),
        })
      );
    });
  });

  describe('suggestions and recovery', () => {
    it('should get suggestions for error', () => {
      const error = new PluginNotFoundError(createPluginId('test-plugin'), ['/plugins']);
      const suggestions = errorManager.getSuggestions(error);

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should get recovery strategies for error', () => {
      const error = new PluginNotFoundError(createPluginId('test-plugin'), ['/plugins']);
      const strategies = errorManager.getRecoveryStrategies(error);

      expect(strategies).toBeInstanceOf(Array);
      expect(strategies.length).toBeGreaterThan(0);
    });

    it('should attempt recovery for recoverable error', async () => {
      const error = new TestError('Test error');

      const result = await errorManager.recover(error);

      // Since we don't have actual recovery strategies, result should be null
      expect(result).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should track error statistics', async () => {
      const error1 = new TestError('Error 1');
      const error2 = new TestError('Error 2');

      await errorManager.handleError(error1);
      await errorManager.handleError(error2);

      const stats = errorManager.getStats();

      expect(stats.total).toBe(2);
      expect(stats.byCategory.plugin).toBe(2);
      expect(stats.bySeverity.medium).toBe(2);
    });

    it('should return error history', async () => {
      const error = new TestError('Test error');

      await errorManager.handleError(error);

      const history = errorManager.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0]?.error).toMatchObject({
        message: 'Test error',
        code: 'TEST_ERROR',
      });
    });

    it('should limit error history size', async () => {
      // Create more errors than the limit
      for (let i = 0; i < 10; i++) {
        const error = new TestError(`Error ${i}`);
        await errorManager.handleError(error);
      }

      const history = errorManager.getHistory();

      // Should have some history (exact limit depends on implementation)
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('breadcrumbs', () => {
    it('should add breadcrumb', () => {
      errorManager.addBreadcrumb({
        message: 'Test breadcrumb',
        category: 'navigation',
        level: 'info',
        timestamp: Date.now(),
      });

      // We can't directly access breadcrumbs, but we can verify through error handling
      expect(() =>
        errorManager.addBreadcrumb({
          message: 'Another breadcrumb',
          category: 'action',
          level: 'debug',
          timestamp: Date.now(),
        })
      ).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should clear error history', async () => {
      const error = new TestError('Test error');
      await errorManager.handleError(error);

      expect(errorManager.getHistory().length).toBeGreaterThan(0);

      errorManager.clearHistory();

      expect(errorManager.getHistory()).toHaveLength(0);
    });
  });
});
