import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ZernError,
  type RecoveryStrategy,
  type RecoveryResult,
  type ErrorSuggestion,
  type EnvironmentSnapshot,
} from '../types/base.js';
import {
  ErrorMiddleware,
  type ErrorMiddlewareFunction,
  type ErrorMiddlewareContext,
} from './index.js';
import type { PluginId } from '../../types/plugin.js';

/**
 * Test-specific context interface for middleware testing
 */
interface TestErrorMiddlewareContext extends Partial<ErrorMiddlewareContext> {
  middlewareModified?: boolean;
}

/**
 * Test error class for middleware testing
 */
class TestError extends ZernError {
  readonly category = 'unknown' as const;
  readonly severity = 'medium' as const;
  readonly recoverable = true;
  readonly code = 'TEST_ERROR';

  constructor(message: string) {
    const environment: EnvironmentSnapshot = {
      nodeVersion: process.version || 'unknown',
      platform: process.platform || 'unknown',
      arch: process.arch || 'unknown',
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      cpu: {
        usage: 0,
        loadAverage: [],
      },
      uptime: process.uptime?.() || 0,
      environment: { NODE_ENV: 'test' },
    };

    super(message, {
      context: {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: {
          original: '',
          parsed: [],
        },
        environment,
        correlationId: 'test-correlation',
      },
      metadata: {},
    });
  }

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'fix',
        title: 'Retry Operation',
        description: 'Try the operation again',
        confidence: 0.8,
        priority: 1,
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'retry',
        priority: 80,
        description: 'Retry the operation',
        estimatedTime: 1000,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'retry',
          duration: 500,
        }),
      },
      {
        name: 'fallback',
        priority: 60,
        description: 'Use fallback mechanism',
        estimatedTime: 500,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'fallback',
          duration: 200,
        }),
      },
    ];
  }
}

describe('ErrorMiddleware', () => {
  let manager: ErrorMiddleware;

  beforeEach(() => {
    manager = new ErrorMiddleware();
    // Clear built-in middleware for clean test state
    manager.clear();
  });

  describe('middleware registration', () => {
    it('should add middleware', () => {
      const middleware: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation((error, context, next) => next());

      manager.use('test-middleware', middleware);

      expect(manager.has('test-middleware')).toBe(true);
    });

    it('should remove middleware', () => {
      const middleware: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation((error, context, next) => next());

      manager.use('test-middleware', middleware);
      manager.remove('test-middleware');

      expect(manager.has('test-middleware')).toBe(false);
    });

    it('should get middleware', () => {
      const middleware: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation((error, context, next) => next());

      manager.use('test-middleware', middleware);

      expect(manager.get('test-middleware')).toBe(middleware);
    });

    it('should return undefined for non-existent middleware', () => {
      expect(manager.get('non-existent')).toBeUndefined();
    });

    it('should list all middleware names', () => {
      const middleware1: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation((error, context, next) => next());
      const middleware2: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation((error, context, next) => next());

      manager.use('middleware1', middleware1);
      manager.use('middleware2', middleware2);

      const names = manager.list();
      expect(names).toContain('middleware1');
      expect(names).toContain('middleware2');
      expect(names).toHaveLength(2);
    });

    it('should clear all middleware', () => {
      const middleware1: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation((error, context, next) => next());
      const middleware2: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation((error, context, next) => next());

      manager.use('middleware1', middleware1);
      manager.use('middleware2', middleware2);

      manager.clear();

      expect(manager.list()).toHaveLength(0);
    });
  });

  describe('middleware execution', () => {
    it('should execute middleware in order', async () => {
      const executionOrder: string[] = [];

      const middleware1: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation(async (error, context, next) => {
          executionOrder.push('middleware1');
          return next();
        });

      const middleware2: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation(async (error, context, next) => {
          executionOrder.push('middleware2');
          return next();
        });

      manager.use('middleware1', middleware1);
      manager.use('middleware2', middleware2);

      const error = new TestError('Test error');
      const context: Partial<ErrorMiddlewareContext> = {
        pluginContext: {
          pluginId: 'test-plugin' as PluginId,
          version: '1.0.0',
          phase: 'runtime',
        },
      };

      await manager.process(error, context);

      expect(executionOrder).toEqual(['middleware1', 'middleware2']);
    });

    it('should stop execution if middleware does not call next', async () => {
      const executionOrder: string[] = [];

      const middleware1: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation(async (_error, _context, _next) => {
          executionOrder.push('middleware1');
          // Don't call next()
        });

      const middleware2: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation(async (error, context, next) => {
          executionOrder.push('middleware2');
          return next();
        });

      manager.use('middleware1', middleware1);
      manager.use('middleware2', middleware2);

      const error = new TestError('Test error');
      const context: Partial<ErrorMiddlewareContext> = {
        pluginContext: {
          pluginId: 'test-plugin' as PluginId,
          version: '1.0.0',
          phase: 'runtime',
        },
      };

      await manager.process(error, context);

      expect(executionOrder).toEqual(['middleware1']);
    });

    it('should handle middleware errors gracefully', async () => {
      const faultyMiddleware: ErrorMiddlewareFunction = vi.fn().mockImplementation(async () => {
        throw new Error('Middleware error');
      });

      const goodMiddleware: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation(async (_error, _context, next) => {
          return next();
        });

      manager.use('faulty', faultyMiddleware);
      manager.use('good', goodMiddleware);

      const error = new TestError('Test error');
      const context: Partial<ErrorMiddlewareContext> = {
        pluginContext: {
          pluginId: 'test-plugin' as PluginId,
          version: '1.0.0',
          phase: 'runtime',
        },
      };

      // Should not throw
      await expect(manager.process(error, context)).resolves.not.toThrow();

      // Good middleware should still execute
      expect(goodMiddleware).toHaveBeenCalled();
    });

    it('should allow middleware to modify context', async () => {
      let capturedContext: TestErrorMiddlewareContext | undefined;

      const middleware: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation(async (_error, context, next) => {
          (context as TestErrorMiddlewareContext).middlewareModified = true;
          capturedContext = context as TestErrorMiddlewareContext;
          return next();
        });

      manager.use('modifier', middleware);

      const error = new TestError('Test error');
      const context: TestErrorMiddlewareContext = {
        pluginContext: {
          pluginId: 'test-plugin' as PluginId,
          version: '1.0.0',
          phase: 'runtime',
        },
      };

      await manager.process(error, context);

      expect(capturedContext).toBeDefined();
      expect(capturedContext!.middlewareModified).toBe(true);
    });

    it('should execute with empty middleware list', async () => {
      const error = new TestError('Test error');
      const context: Partial<ErrorMiddlewareContext> = {
        pluginContext: {
          pluginId: 'test-plugin' as PluginId,
          version: '1.0.0',
          phase: 'runtime',
        },
      };

      // Should not throw
      await expect(manager.process(error, context)).resolves.not.toThrow();
    });
  });

  describe('middleware priority', () => {
    it('should execute middleware in priority order', async () => {
      const executionOrder: string[] = [];

      const lowPriorityMiddleware: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation(async (error, context, next) => {
          executionOrder.push('low');
          return next();
        });

      const highPriorityMiddleware: ErrorMiddlewareFunction = vi
        .fn()
        .mockImplementation(async (error, context, next) => {
          executionOrder.push('high');
          return next();
        });

      manager.use('low', lowPriorityMiddleware, 1);
      manager.use('high', highPriorityMiddleware, 10);

      const error = new TestError('Test error');
      const context: Partial<ErrorMiddlewareContext> = {
        pluginContext: {
          pluginId: 'test-plugin' as PluginId,
          version: '1.0.0',
          phase: 'runtime',
        },
      };

      await manager.process(error, context);

      expect(executionOrder).toEqual(['high', 'low']);
    });
  });
});
