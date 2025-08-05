import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RecoveryManager } from './recovery-manager.js';
import {
  ZernError,
  type ErrorCategory,
  type ErrorSeverity,
  type ErrorContext,
  type RecoveryStrategy,
  type RecoveryResult,
  type ErrorSuggestion,
} from '../types/base.js';
import { createPluginId } from '../../types/plugin.js';

// Mock implementation for testing
class TestError extends ZernError {
  readonly category: ErrorCategory = 'plugin';
  readonly severity: ErrorSeverity = 'medium';
  recoverable = true;
  readonly code = 'TEST_ERROR';

  getSuggestions(): ErrorSuggestion[] {
    return [];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'retry',
        priority: 10,
        description: 'Retry the operation',
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'retry',
          duration: 100,
        }),
      },
      {
        name: 'fallback',
        priority: 5,
        description: 'Use fallback mechanism',
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'fallback',
          duration: 50,
        }),
      },
    ];
  }
}

describe('RecoveryManager', () => {
  let recoveryManager: RecoveryManager;
  let mockContext: ErrorContext;

  beforeEach(() => {
    recoveryManager = new RecoveryManager({
      maxRetries: 3,
      retryDelay: 100,
      enableFallbacks: true,
      circuitBreakerThreshold: 5,
      enableDefaultFallbacks: false, // Disable default fallbacks for testing
    });

    // Create a mock context
    mockContext = {
      timestamp: Date.now(),
      kernelState: 'running',
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
      pluginId: createPluginId('test-plugin'),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create recovery manager with default config', () => {
      const manager = new RecoveryManager();
      expect(manager).toBeInstanceOf(RecoveryManager);
    });

    it('should create recovery manager with custom config', () => {
      const config = {
        maxRetries: 5,
        retryDelay: 200,
        enableFallbacks: false,
        circuitBreakerThreshold: 10,
      };
      const manager = new RecoveryManager(config);
      expect(manager).toBeInstanceOf(RecoveryManager);
    });
  });

  describe('fallback management', () => {
    it('should add fallback strategy', () => {
      const fallback = {
        id: 'test-fallback',
        name: 'Test Fallback',
        description: 'A test fallback strategy',
        priority: 10,
        canHandle: (): boolean => true,
        execute: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'test-fallback',
          duration: 100,
        }),
      };

      recoveryManager.addFallback(fallback);

      const fallbacks = recoveryManager.getFallbacks();
      expect(fallbacks).toHaveLength(1);
      expect(fallbacks[0]?.id).toBe('test-fallback');
    });

    it('should remove fallback strategy', () => {
      const fallback = {
        id: 'test-fallback',
        name: 'Test Fallback',
        description: 'A test fallback strategy',
        priority: 10,
        canHandle: (): boolean => true,
        execute: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'test-fallback',
          duration: 100,
        }),
      };

      recoveryManager.addFallback(fallback);
      expect(recoveryManager.getFallbacks()).toHaveLength(1);

      const removed = recoveryManager.removeFallback('test-fallback');
      expect(removed).toBe(true);
      expect(recoveryManager.getFallbacks()).toHaveLength(0);
    });

    it('should get all fallback strategies sorted by priority', () => {
      const fallback1 = {
        id: 'fallback-1',
        name: 'Fallback 1',
        description: 'First fallback',
        priority: 5,
        canHandle: (): boolean => true,
        execute: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'fallback-1',
          duration: 100,
        }),
      };

      const fallback2 = {
        id: 'fallback-2',
        name: 'Fallback 2',
        description: 'Second fallback',
        priority: 10,
        canHandle: (): boolean => true,
        execute: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'fallback-2',
          duration: 100,
        }),
      };

      recoveryManager.addFallback(fallback1);
      recoveryManager.addFallback(fallback2);

      const fallbacks = recoveryManager.getFallbacks();
      expect(fallbacks).toHaveLength(2);
      expect(fallbacks[0]?.priority).toBe(10); // Higher priority first
      expect(fallbacks[1]?.priority).toBe(5);
    });
  });

  describe('error recovery', () => {
    it('should recover from error using available strategies', async () => {
      const error = new TestError('Test error');

      const result = await recoveryManager.recover(error, mockContext);

      expect(result).toBeDefined();
      if (result) {
        expect(result.success).toBe(true);
        expect(result.strategy).toBe('retry'); // Higher priority strategy should be used first
      }
    });

    it('should return null for non-recoverable errors', async () => {
      const error = new TestError('Test error');
      error.recoverable = false;

      const result = await recoveryManager.recover(error, mockContext);

      expect(result).toBeNull();
    });

    it('should try fallback strategies when recovery strategies fail', async () => {
      // Create an error with failing strategies
      const error = new TestError('Test error');
      error.getRecoveryStrategies = (): RecoveryStrategy[] => [
        {
          name: 'failing-strategy',
          priority: 10,
          description: 'A strategy that fails',
          canRecover: (): boolean => true,
          recover: async (): Promise<RecoveryResult> => ({
            success: false,
            strategy: 'failing-strategy',
            duration: 100,
          }),
        },
      ];

      // Add a fallback strategy
      const fallback = {
        id: 'test-fallback',
        name: 'Test Fallback',
        description: 'A test fallback strategy',
        priority: 10,
        canHandle: (): boolean => true,
        execute: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'test-fallback',
          duration: 100,
        }),
      };

      recoveryManager.addFallback(fallback);

      const result = await recoveryManager.recover(error, mockContext);

      expect(result).toBeDefined();
      if (result) {
        expect(result.success).toBe(true);
        expect(result.strategy).toBe('test-fallback');
      }
    });

    it('should return null when all strategies and fallbacks fail', async () => {
      // Create an error with failing strategies
      const error = new TestError('Test error');
      error.getRecoveryStrategies = (): RecoveryStrategy[] => [
        {
          name: 'failing-strategy',
          priority: 10,
          description: 'A strategy that fails',
          canRecover: (): boolean => true,
          recover: async (): Promise<RecoveryResult> => ({
            success: false,
            strategy: 'failing-strategy',
            duration: 100,
          }),
        },
      ];

      // Add a failing fallback strategy
      const fallback = {
        id: 'failing-fallback',
        name: 'Failing Fallback',
        description: 'A fallback that fails',
        priority: 10,
        canHandle: (): boolean => true,
        execute: async (): Promise<RecoveryResult> => ({
          success: false,
          strategy: 'failing-fallback',
          duration: 100,
        }),
      };

      recoveryManager.addFallback(fallback);

      const result = await recoveryManager.recover(error, mockContext);

      expect(result).toBeNull();
    });

    it('should skip strategies that cannot recover the error', async () => {
      const error = new TestError('Test error');
      error.getRecoveryStrategies = (): RecoveryStrategy[] => [
        {
          name: 'incompatible-strategy',
          priority: 10,
          description: 'A strategy that cannot recover this error',
          canRecover: (): boolean => false, // Cannot recover
          recover: async (): Promise<RecoveryResult> => ({
            success: true,
            strategy: 'incompatible-strategy',
            duration: 100,
          }),
        },
        {
          name: 'compatible-strategy',
          priority: 5,
          description: 'A strategy that can recover this error',
          canRecover: (): boolean => true,
          recover: async (): Promise<RecoveryResult> => ({
            success: true,
            strategy: 'compatible-strategy',
            duration: 100,
          }),
        },
      ];

      const result = await recoveryManager.recover(error, mockContext);

      expect(result).toBeDefined();
      if (result) {
        expect(result.success).toBe(true);
        expect(result.strategy).toBe('compatible-strategy');
      }
    });
  });

  describe('recovery attempts tracking', () => {
    it('should track recovery attempts', async () => {
      const error = new TestError('Test error');

      await recoveryManager.recover(error, mockContext);

      const attempts = recoveryManager.getAllAttempts();
      expect(attempts.length).toBeGreaterThan(0);
      expect(attempts[0]?.error.code).toBe(error.code);
      expect(attempts[0]?.status).toBe('success');
    });

    it('should get attempts for specific error', async () => {
      const error = new TestError('Test error');

      await recoveryManager.recover(error, mockContext);

      const errorAttempts = recoveryManager.getAttemptsForError(error);
      expect(errorAttempts.length).toBeGreaterThan(0);
      expect(errorAttempts[0]?.error.code).toBe(error.code);
    });

    it('should get attempt by ID', async () => {
      const error = new TestError('Test error');

      await recoveryManager.recover(error, mockContext);

      const attempts = recoveryManager.getAllAttempts();
      const attemptId = attempts[0]?.id;
      const attempt = recoveryManager.getAttempt(attemptId!);

      expect(attempt).toBeDefined();
      if (attempt) {
        expect(attempt.id).toBe(attemptId);
      }
    });
  });

  describe('circuit breaker', () => {
    it('should get circuit breaker state', () => {
      const state = recoveryManager.getCircuitBreakerState('test-strategy');
      expect(state.state).toBe('closed');
      expect(state.failureCount).toBe(0);
    });

    it('should reset circuit breaker', () => {
      recoveryManager.resetCircuitBreaker('test-strategy');
      const state = recoveryManager.getCircuitBreakerState('test-strategy');
      expect(state.state).toBe('closed');
      expect(state.failureCount).toBe(0);
    });
  });

  describe('history management', () => {
    it('should clear recovery history', async () => {
      const error = new TestError('Test error');

      await recoveryManager.recover(error, mockContext);
      expect(recoveryManager.getAllAttempts().length).toBeGreaterThan(0);

      recoveryManager.clearHistory();
      expect(recoveryManager.getAllAttempts()).toHaveLength(0);
    });
  });

  describe('recovery statistics', () => {
    beforeEach(async () => {
      // Add some test data
      const error1 = new TestError('Error 1');
      const error2 = new TestError('Error 2');

      await recoveryManager.recover(error1, mockContext);
      await recoveryManager.recover(error2, mockContext);
    });

    it('should return recovery statistics', () => {
      const stats = recoveryManager.getStatistics();

      expect(stats.totalAttempts).toBeGreaterThan(0);
      expect(stats.successfulAttempts).toBeGreaterThan(0);
      expect(stats.successRate).toBeGreaterThan(0);
      expect(stats.topStrategies).toBeDefined();
      expect(Array.isArray(stats.topStrategies)).toBe(true);
    });

    it('should track circuit breaker states in statistics', () => {
      const stats = recoveryManager.getStatistics();
      expect(stats.circuitBreakers).toBeDefined();
      expect(typeof stats.circuitBreakers).toBe('object');
    });

    it('should calculate average recovery time', () => {
      const stats = recoveryManager.getStatistics();
      expect(stats.averageRecoveryTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('recovery timeout', () => {
    it('should handle recovery operations with estimated time', async () => {
      const error = new TestError('Test error');
      error.getRecoveryStrategies = (): RecoveryStrategy[] => [
        {
          name: 'timed-strategy',
          priority: 1,
          description: 'A recovery strategy with estimated time',
          estimatedTime: 100, // 100ms estimated time
          canRecover: (): boolean => true,
          recover: async (): Promise<RecoveryResult> => ({
            success: true,
            strategy: 'timed-strategy',
            duration: 50,
          }),
        },
      ];

      const manager = new RecoveryManager({
        maxRetries: 1,
        retryDelay: 100,
        enableFallbacks: false,
        circuitBreakerThreshold: 5,
        enableDefaultFallbacks: false,
      });

      const result = await manager.recover(error, mockContext);

      expect(result).toBeDefined();
      if (result) {
        expect(result.success).toBe(true);
        expect(result.strategy).toBe('timed-strategy');
      }
    });
  });

  describe('configuration', () => {
    it('should create recovery manager with valid configuration', () => {
      const config = {
        maxRetries: 5,
        retryDelay: 200,
        enableFallbacks: true,
        circuitBreakerThreshold: 10,
      };

      const manager = new RecoveryManager(config);

      // Test that manager was created successfully
      expect(manager).toBeDefined();
      expect(manager.getStatistics).toBeDefined();
    });

    it('should work with default configuration', () => {
      const manager = new RecoveryManager();

      expect(manager).toBeDefined();
      expect(manager.getStatistics).toBeDefined();
      expect(manager.getAllAttempts).toBeDefined();
    });

    it('should setup default fallbacks when enabled', () => {
      const manager = new RecoveryManager({
        enableDefaultFallbacks: true,
      });

      const fallbacks = manager.getFallbacks();
      expect(fallbacks).toHaveLength(3); // Should have 3 default fallbacks

      const fallbackIds = fallbacks.map(f => f.id);
      expect(fallbackIds).toContain('graceful-degradation');
      expect(fallbackIds).toContain('safe-mode');
      expect(fallbackIds).toContain('restart');
    });

    it('should not setup default fallbacks when disabled', () => {
      const manager = new RecoveryManager({
        enableDefaultFallbacks: false,
      });

      const fallbacks = manager.getFallbacks();
      expect(fallbacks).toHaveLength(0); // Should have no fallbacks
    });
  });

  describe('error handling', () => {
    it('should handle strategy execution errors gracefully', async () => {
      const error = new TestError('Test error');
      error.getRecoveryStrategies = (): RecoveryStrategy[] => [
        {
          name: 'error-strategy',
          priority: 1,
          description: 'A strategy that throws an error',
          canRecover: (): boolean => true,
          recover: async (): Promise<RecoveryResult> => {
            throw new Error('Strategy execution failed');
          },
        },
      ];

      const result = await recoveryManager.recover(error, mockContext);

      // When all strategies fail and no fallbacks are available, should return null
      expect(result).toBeNull();
    });

    it('should handle errors with no recovery strategies', async () => {
      const error = new TestError('Test error');
      error.getRecoveryStrategies = (): RecoveryStrategy[] => [];

      const result = await recoveryManager.recover(error, mockContext);

      // When no strategies are available and no fallbacks are available, should return null
      expect(result).toBeNull();
    });

    it('should handle errors with incompatible strategies', async () => {
      const error = new TestError('Test error');
      error.getRecoveryStrategies = (): RecoveryStrategy[] => [
        {
          name: 'incompatible-strategy',
          priority: 1,
          description: 'A strategy that cannot recover this error',
          canRecover: (): boolean => false,
          recover: async (): Promise<RecoveryResult> => ({
            success: true,
            strategy: 'incompatible-strategy',
            duration: 100,
          }),
        },
      ];

      const result = await recoveryManager.recover(error, mockContext);

      // When no compatible strategies are available and no fallbacks are available, should return null
      expect(result).toBeNull();
    });
  });
});
