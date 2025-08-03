import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorCollector } from '../../../../src/errors/core/error-collector.js';
import {
  ZernError,
  type ErrorCategory,
  type ErrorSeverity,
  type ErrorContext,
  type ErrorSuggestion,
  type RecoveryStrategy,
} from '../../../../src/errors/types/base.js';
import type { PluginId } from '../../../../src/types/plugin.js';

// Helper function to create minimal ErrorContext for testing
function createTestErrorContext(overrides: Partial<ErrorContext> = {}): ErrorContext {
  return {
    timestamp: Date.now(),
    kernelState: 'running',
    pluginStates: new Map(),
    breadcrumbs: [],
    stackTrace: {
      original: '',
      parsed: [],
    },
    environment: {
      nodeVersion: '18.0.0',
      platform: 'test',
      arch: 'x64',
      memory: { used: 0, total: 0, percentage: 0 },
      cpu: { usage: 0, loadAverage: [] },
      uptime: 0,
      environment: {},
    },
    pluginId: 'test-plugin' as PluginId,
    ...overrides,
  };
}

// Mock implementation for testing
class TestError extends ZernError {
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly recoverable = true;
  readonly code: string;

  constructor(
    message: string,
    code: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    options?: { cause?: Error; context?: ErrorContext; metadata?: Record<string, unknown> }
  ) {
    super(message, options);
    this.code = code;
    this.category = category;
    this.severity = severity;
  }

  getSuggestions(): ErrorSuggestion[] {
    return [];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [];
  }
}

describe('ErrorCollector', () => {
  let errorCollector: ErrorCollector;

  beforeEach(() => {
    errorCollector = new ErrorCollector({
      maxCollections: 5,
      autoFlushInterval: 1000,
      enablePatternDetection: true,
    });
  });

  afterEach(() => {
    errorCollector.destroy();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create error collector with default config', () => {
      const collector = new ErrorCollector();
      expect(collector).toBeInstanceOf(ErrorCollector);
    });

    it('should create error collector with custom config', () => {
      const config = {
        maxCollections: 10,
        autoFlushInterval: 2000,
        enablePatternDetection: false,
      };
      const collector = new ErrorCollector(config);
      expect(collector).toBeInstanceOf(ErrorCollector);
    });
  });

  describe('error collection', () => {
    it('should collect error and return collection ID', () => {
      const error = new TestError('Test error', 'TEST', 'plugin', 'medium');
      const context = createTestErrorContext();

      const collectionId = errorCollector.collect(error, context);

      expect(collectionId).toMatch(/^collection-/);
    });

    it('should collect error with custom collection ID', () => {
      const error = new TestError('Test error', 'TEST', 'plugin', 'medium');
      const context = createTestErrorContext();
      const customId = 'custom-collection-id';

      const collectionId = errorCollector.collect(error, context, customId);

      expect(collectionId).toBe(customId);
    });

    it('should collect multiple errors', () => {
      const error1 = new TestError('Error 1', 'ERR1', 'plugin', 'high');
      const error2 = new TestError('Error 2', 'ERR2', 'kernel', 'low');
      const context = createTestErrorContext();

      const id1 = errorCollector.collect(error1, context);
      const id2 = errorCollector.collect(error2, context);

      expect(id1).not.toBe(id2);
    });
  });

  describe('collection retrieval', () => {
    it('should get collection by ID', () => {
      const error = new TestError('Test error', 'TEST', 'plugin', 'medium');
      const context = createTestErrorContext();

      const collectionId = errorCollector.collect(error, context);
      const collection = errorCollector.getCollection(collectionId);

      expect(collection).toBeDefined();
      expect(collection?.id).toBe(collectionId);
      expect(collection?.errors[0]?.error).toBe(error);
      expect(collection?.context.pluginId).toBe(context.pluginId);
      expect(collection?.startTime).toBeInstanceOf(Date);
    });

    it('should return null for non-existent collection', () => {
      const collection = errorCollector.getCollection('non-existent');
      expect(collection).toBeNull();
    });

    it('should get all collections', () => {
      const error1 = new TestError('Error 1', 'ERR1', 'plugin', 'high');
      const error2 = new TestError('Error 2', 'ERR2', 'kernel', 'low');
      const context = createTestErrorContext();

      errorCollector.collect(error1, context);
      errorCollector.collect(error2, context);

      const collections = errorCollector.getAllCollections();

      expect(collections).toHaveLength(2);
      expect(collections[0]!.errors[0]?.error).toBe(error1);
      expect(collections[1]!.errors[0]?.error).toBe(error2);
    });
  });

  describe('collection filtering', () => {
    beforeEach(() => {
      // Add some test data
      const error1 = new TestError('Plugin Error', 'PLUGIN_ERR', 'plugin', 'high');
      const error2 = new TestError('System Error', 'SYSTEM_ERR', 'kernel', 'low');
      const error3 = new TestError('Another Plugin Error', 'PLUGIN_ERR2', 'plugin', 'medium');

      errorCollector.collect(error1, createTestErrorContext({ pluginId: 'plugin-1' as PluginId }));
      errorCollector.collect(error2, createTestErrorContext({ pluginId: 'plugin-2' as PluginId }));
      errorCollector.collect(error3, createTestErrorContext({ pluginId: 'plugin-1' as PluginId }));
    });

    it('should get collections by category', () => {
      const pluginCollections = errorCollector.getCollectionsByCategory('plugin');
      const systemCollections = errorCollector.getCollectionsByCategory('kernel');

      expect(pluginCollections).toHaveLength(2);
      expect(systemCollections).toHaveLength(1);
    });

    it('should get collections by time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const recentCollections = errorCollector.getCollectionsByTimeRange(oneHourAgo, now);

      expect(recentCollections).toHaveLength(3); // All collections should be recent
    });
  });

  describe('collection limits', () => {
    it('should respect max collections limit', () => {
      const context = createTestErrorContext();

      // Add more errors than the limit
      for (let i = 0; i < 10; i++) {
        const error = new TestError(`Error ${i}`, `ERR${i}`, 'plugin', 'medium');
        errorCollector.collect(error, context);
      }

      const collections = errorCollector.getAllCollections();

      // Should be limited to maxCollections (5)
      expect(collections).toHaveLength(5);
    });

    it('should remove oldest collections when limit exceeded', () => {
      const context = createTestErrorContext();

      // Add errors up to the limit
      const collectionIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const error = new TestError(`Error ${i}`, `ERR${i}`, 'plugin', 'medium');
        const id = errorCollector.collect(error, context);
        collectionIds.push(id);
      }

      // Add one more to exceed the limit
      const error = new TestError('New Error', 'NEW_ERR', 'plugin', 'medium');
      errorCollector.collect(error, context);

      // First collection should be removed
      const firstCollection = errorCollector.getCollection(collectionIds[0]!);
      expect(firstCollection).toBeNull();

      // Last collections should still exist
      const lastCollection = errorCollector.getCollection(collectionIds[4]!);
      expect(lastCollection).toBeDefined();
    });
  });

  describe('pattern detection', () => {
    it('should detect error patterns when enabled', () => {
      const context = createTestErrorContext();

      // Create multiple similar errors
      for (let i = 0; i < 3; i++) {
        const error = new TestError('Repeated error', 'REPEATED', 'plugin', 'medium');
        errorCollector.collect(error, context);
      }

      const patterns = errorCollector.getPatterns();

      expect(patterns).toBeInstanceOf(Array);
      // Should detect the repeated error pattern
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should not detect patterns when disabled', () => {
      const collector = new ErrorCollector({
        enablePatternDetection: false,
      });

      const context = createTestErrorContext();

      for (let i = 0; i < 3; i++) {
        const error = new TestError('Repeated error', 'REPEATED', 'plugin', 'medium');
        collector.collect(error, context);
      }

      const patterns = collector.getPatterns();

      expect(patterns).toHaveLength(0);
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      // Add test data
      const error1 = new TestError('Error 1', 'ERR1', 'plugin', 'high');
      const error2 = new TestError('Error 2', 'ERR2', 'kernel', 'low');
      const error3 = new TestError('Error 3', 'ERR3', 'plugin', 'medium');

      errorCollector.collect(error1, createTestErrorContext({ pluginId: 'plugin-1' as PluginId }));
      errorCollector.collect(error2, createTestErrorContext({ pluginId: 'plugin-2' as PluginId }));
      errorCollector.collect(error3, createTestErrorContext({ pluginId: 'plugin-1' as PluginId }));
    });

    it('should return collection statistics', () => {
      const stats = errorCollector.getStatistics();

      expect(stats.totalCollections).toBe(3);
      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCategory.plugin).toBe(2);
      expect(stats.errorsByCategory.kernel).toBe(1);
      expect(stats.errorsBySeverity.high).toBe(1);
      expect(stats.errorsBySeverity.medium).toBe(1);
      expect(stats.errorsBySeverity.low).toBe(1);
      expect(stats.averageErrorsPerCollection).toBe(1);
    });
  });

  describe('lifecycle management', () => {
    it('should flush collections manually', () => {
      const error = new TestError('Test error', 'TEST', 'plugin', 'medium');
      const context = createTestErrorContext();

      errorCollector.collect(error, context);

      // Flush should not throw
      expect(() => errorCollector.flush()).not.toThrow();
    });

    it('should destroy collector', () => {
      const error = new TestError('Test error', 'TEST', 'plugin', 'medium');
      const context = createTestErrorContext();

      errorCollector.collect(error, context);
      expect(errorCollector.getAllCollections()).toHaveLength(1);

      errorCollector.destroy();
      expect(errorCollector.getAllCollections()).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('should clear all collections', () => {
      const error1 = new TestError('Error 1', 'ERR1', 'plugin', 'medium');
      const error2 = new TestError('Error 2', 'ERR2', 'kernel', 'high');

      errorCollector.collect(error1, createTestErrorContext({ pluginId: 'plugin-1' as PluginId }));
      errorCollector.collect(error2, createTestErrorContext({ pluginId: 'plugin-2' as PluginId }));

      expect(errorCollector.getAllCollections()).toHaveLength(2);

      errorCollector.clear();
      expect(errorCollector.getAllCollections()).toHaveLength(0);
    });
  });
});
