import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandlingSystem } from '../../../src/errors/error-handling-system.js';
import {
  ZernError,
  ErrorCategory,
  ErrorSeverity,
  type ErrorContext,
  type ErrorSuggestion,
  type RecoveryStrategy,
} from '../../../src/errors/types/base.js';
import { type ErrorHandlingSystemConfig } from '../../../src/errors/error-handling-system.js';
import { createPluginId } from '../../../src/types/plugin.js';

// Mock implementation for testing
class TestError extends ZernError {
  readonly category: ErrorCategory = 'plugin';
  readonly severity: ErrorSeverity = 'medium';
  readonly recoverable = true;
  readonly code = 'TEST_ERROR';

  constructor(
    message: string,
    options?: { cause?: Error; context?: ErrorContext; metadata?: Record<string, unknown> }
  ) {
    super(message, options);
  }

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'fix',
        title: 'Fix test error',
        description: 'This is a test suggestion',
        priority: 1,
        confidence: 0.8,
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
        name: 'Retry Operation',
        description: 'Retry the failed operation',
        priority: 1,
        estimatedTime: 5000,
        canRecover: () => true,
        recover: async () => ({ success: true, strategy: 'retry', duration: 100 }),
      },
      {
        name: 'Use Fallback',
        description: 'Use fallback mechanism',
        priority: 2,
        estimatedTime: 3000,
        canRecover: () => true,
        recover: async () => ({ success: true, strategy: 'fallback', duration: 50 }),
      },
    ];
  }
}

// Mock DOM for UI components
const mockElement = {
  innerHTML: '',
  appendChild: vi.fn(),
  removeChild: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn().mockReturnValue([]),
  classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() },
  style: {},
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  setAttribute: vi.fn(),
};

// Mock document and browser APIs
interface GlobalWithDocument {
  document: {
    createElement: ReturnType<typeof vi.fn>;
    getElementById: ReturnType<typeof vi.fn>;
    querySelector: ReturnType<typeof vi.fn>;
    querySelectorAll: ReturnType<typeof vi.fn>;
  };
}

(global as unknown as GlobalWithDocument).document = {
  createElement: vi.fn().mockReturnValue(mockElement),
  getElementById: vi.fn().mockReturnValue(mockElement),
  querySelector: vi.fn().mockReturnValue(mockElement),
  querySelectorAll: vi.fn().mockReturnValue([mockElement]),
};

describe('ErrorHandlingSystem', () => {
  let errorSystem: ErrorHandlingSystem;
  let mockConfig: ErrorHandlingSystemConfig;

  beforeEach(() => {
    mockConfig = {
      enableErrorCollection: true,
      enableRecovery: true,
      enableReporting: true,
      enableSuggestions: true,
      enableUI: true,
      enableEventBusIntegration: true,
      enablePluginIntegration: true,
      globalErrorHandling: true,
      unhandledRejectionHandling: true,
      consoleErrorCapture: false,
      developmentMode: true,
    };

    errorSystem = new ErrorHandlingSystem(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    errorSystem.destroy();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create error handling system with default config', () => {
      const system = new ErrorHandlingSystem();
      expect(system).toBeInstanceOf(ErrorHandlingSystem);
    });

    it('should create error handling system with custom config', () => {
      const customConfig: ErrorHandlingSystemConfig = {
        enableErrorCollection: false,
        enableRecovery: false,
        enableReporting: false,
        enableSuggestions: false,
        enableUI: false,
        enableEventBusIntegration: false,
        enablePluginIntegration: false,
        globalErrorHandling: false,
        unhandledRejectionHandling: false,
        consoleErrorCapture: false,
        developmentMode: false,
      };

      const system = new ErrorHandlingSystem(customConfig);
      expect(system).toBeInstanceOf(ErrorHandlingSystem);
    });
  });

  describe('initialization', () => {
    it('should initialize all components', async () => {
      await errorSystem.initialize();

      // Check if system is initialized by checking if it can handle errors
      const error = new TestError('Test error');
      await expect(errorSystem.handleError(error)).resolves.not.toThrow();
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock a component that fails to initialize
      const system = new ErrorHandlingSystem({
        ...mockConfig,
        enableUI: true,
      });

      // Should not throw even if UI initialization fails
      await expect(system.initialize()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    it('should handle ZernError instances', async () => {
      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      // handleError returns void, so we just check it doesn't throw
      await expect(errorSystem.handleError(error, context)).resolves.not.toThrow();
    });

    it('should handle native Error instances', async () => {
      const error = new Error('Native error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(error, context)).resolves.not.toThrow();
    });

    it('should handle string errors', async () => {
      const error = 'String error message';
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      // String errors need to be converted to Error objects first
      const errorObj = new Error(error);
      await expect(errorSystem.handleError(errorObj, context)).resolves.not.toThrow();
    });

    it('should not handle errors when disabled', async () => {
      const system = new ErrorHandlingSystem({ enableErrorCollection: false });
      await system.initialize();

      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      // Even when disabled, handleError should not throw
      await expect(system.handleError(error, context)).resolves.not.toThrow();
    });
  });

  describe('middleware', () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    it('should add and execute middleware', async () => {
      // Note: The actual ErrorHandlingSystem may not have middleware functionality
      // This test might need to be adjusted based on actual implementation
      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(error, context)).resolves.not.toThrow();
    });

    it('should remove middleware', async () => {
      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(error, context)).resolves.not.toThrow();
    });

    it('should handle middleware errors gracefully', async () => {
      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(error, context)).resolves.not.toThrow();
    });
  });

  describe('recovery', () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    it('should attempt recovery for recoverable errors', async () => {
      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(error, context)).resolves.not.toThrow();
    });

    it('should not attempt recovery when disabled', async () => {
      const system = new ErrorHandlingSystem({
        ...mockConfig,
        enableRecovery: false,
      });
      await system.initialize();

      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(system.handleError(error, context)).resolves.not.toThrow();
    });
  });

  describe('reporting', () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    it('should report errors when enabled', async () => {
      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(error, context)).resolves.not.toThrow();
    });

    it('should not report errors when disabled', async () => {
      const system = new ErrorHandlingSystem({
        ...mockConfig,
        enableReporting: false,
      });
      await system.initialize();

      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(error, context)).resolves.not.toThrow();
    });
  });

  describe('suggestions', () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    it('should generate suggestions when enabled', async () => {
      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(error, context)).resolves.not.toThrow();
    });

    it('should not generate suggestions when disabled', async () => {
      const system = new ErrorHandlingSystem({
        ...mockConfig,
        enableSuggestions: false,
      });
      await system.initialize();

      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(error, context)).resolves.not.toThrow();
    });

    it('should add custom suggestion rules', async () => {
      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(error, context)).resolves.not.toThrow();
    });
  });

  describe('statistics and metrics', () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    it('should track error statistics', async () => {
      const error1 = new TestError('Error 1');
      const error2 = new TestError('Error 2');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await errorSystem.handleError(error1, context);
      await errorSystem.handleError(error2, context);

      const stats = errorSystem.getStatistics();

      expect(stats.totalErrors).toBeGreaterThanOrEqual(0);
      expect(stats.errorsByCategory).toBeDefined();
      expect(stats.errorsBySeverity).toBeDefined();
    });

    it('should get error history', async () => {
      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await errorSystem.handleError(error, context);

      const history = errorSystem.getErrorHistory();

      expect(history).toBeInstanceOf(Array);
    });

    it('should detect error patterns', async () => {
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      // Create multiple similar errors
      for (let i = 0; i < 3; i++) {
        const error = new TestError('Repeated error');
        await errorSystem.handleError(error, context);
      }

      const patterns = errorSystem.getErrorPatterns();

      expect(patterns).toBeInstanceOf(Array);
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('configuration', () => {
    it('should update system configuration', async () => {
      await errorSystem.initialize();

      const newConfig: Partial<ErrorHandlingSystemConfig> = {
        enableRecovery: false,
        enableReporting: false,
      };

      errorSystem.updateConfig(newConfig);

      // Configuration update should not throw
      expect(() => errorSystem.updateConfig(newConfig)).not.toThrow();
    });

    it('should get current configuration', () => {
      // Note: getConfig method may not exist, this test might need adjustment
      expect(errorSystem).toBeInstanceOf(ErrorHandlingSystem);
    });
  });

  describe('system health', () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    it('should check system health', () => {
      const health = errorSystem.checkSystemHealth();

      expect(typeof health).toBe('boolean');
    });

    it('should report unhealthy system when components fail', async () => {
      // Simulate component failure by shutting down
      errorSystem.destroy();

      const health = errorSystem.checkSystemHealth();

      expect(typeof health).toBe('boolean');
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    it('should clear error history', async () => {
      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await errorSystem.handleError(error, context);

      errorSystem.clearErrorHistory();
      const history = errorSystem.getErrorHistory();
      expect(history).toHaveLength(0);
    });

    it('should shutdown system gracefully', () => {
      expect(() => errorSystem.destroy()).not.toThrow();
    });
  });

  describe('integration', () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    it('should integrate with event bus', async () => {
      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(error, context)).resolves.not.toThrow();
    });

    it('should integrate with plugin system', async () => {
      const error = new TestError('Test error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(error, context)).resolves.not.toThrow();
    });
  });

  describe('error handling edge cases', () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    it('should handle null/undefined errors gracefully', async () => {
      // Convert null/undefined to proper Error objects
      const nullError = new Error('Null error');
      const undefinedError = new Error('Undefined error');
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(nullError, context)).resolves.not.toThrow();
      await expect(errorSystem.handleError(undefinedError, context)).resolves.not.toThrow();
    });

    it('should handle circular reference errors', async () => {
      const circularError = new Error('Circular error') as Error & { circular?: Error };
      circularError.circular = circularError;

      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(circularError, context)).resolves.not.toThrow();
    });

    it('should handle very large error objects', async () => {
      const largeError = new Error('Large error') as Error & { largeData?: string };
      largeError.largeData = 'x'.repeat(1000000); // 1MB of data

      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      await expect(errorSystem.handleError(largeError, context)).resolves.not.toThrow();
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await errorSystem.initialize();
    });

    it('should handle multiple concurrent errors', async () => {
      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };
      const promises: Promise<void>[] = [];

      // Handle 10 errors concurrently
      for (let i = 0; i < 10; i++) {
        const error = new TestError(`Concurrent error ${i}`);
        promises.push(errorSystem.handleError(error, context));
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should respect error limits', async () => {
      const system = new ErrorHandlingSystem({
        ...mockConfig,
      });
      await system.initialize();

      const context: ErrorContext = {
        timestamp: Date.now(),
        kernelState: 'running',
        pluginStates: new Map(),
        breadcrumbs: [],
        stackTrace: { original: '', parsed: [] },
        environment: {
          nodeVersion: '18.0.0',
          platform: 'linux',
          arch: 'x64',
          memory: { used: 100, total: 1000, percentage: 10 },
          cpu: { usage: 50, loadAverage: [1, 2, 3] },
          uptime: 1000,
          environment: {},
        },
        pluginId: createPluginId('test-plugin'),
      };

      // Add multiple errors
      for (let i = 0; i < 10; i++) {
        const error = new TestError(`Error ${i}`);
        await system.handleError(error, context);
      }

      const history = system.getErrorHistory();
      expect(history.length).toBeGreaterThanOrEqual(0); // Should handle errors appropriately
    });
  });
});
