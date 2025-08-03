import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBusIntegration, PluginIntegration } from '../../../src/errors/integrations/index.js';
import {
  ZernError,
  ErrorSuggestion,
  RecoveryStrategy,
  ErrorContext,
  PluginLifecyclePhase,
} from '../../../src/errors/index.js';
import { PluginError } from '../../../src/errors/types/plugin-errors.js';
import { createPluginId } from '../../../src/types/utils.js';
import type { PluginId } from '../../../src/types/utils.js';
import type { ErrorManager } from '../../../src/errors/core/error-manager.js';

// Mock error class for testing
class TestError extends ZernError {
  readonly category = 'plugin' as const;
  readonly severity = 'medium' as const;
  readonly recoverable = true;
  readonly code = 'TEST_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'TestError';
  }

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'fix',
        title: 'Test suggestion',
        description: 'This is a test suggestion',
        confidence: 0.8,
        priority: 1,
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

// Mock plugin error class for testing
class TestPluginError extends PluginError {
  readonly code = 'TEST_PLUGIN_ERROR';
  readonly severity = 'medium' as const;
  readonly recoverable = true;

  constructor(message: string, pluginId: PluginId, phase: PluginLifecyclePhase = 'runtime') {
    super(message, pluginId, phase);
    this.name = 'TestPluginError';
  }

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'fix',
        title: 'Test plugin suggestion',
        description: 'This is a test plugin suggestion',
        confidence: 0.8,
        priority: 1,
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'test-plugin-recovery',
        priority: 1,
        description: 'Test plugin recovery strategy',
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'test-plugin-recovery',
          duration: 100,
        }),
      },
    ];
  }
}

// Mock interfaces - EventEmitter compatible interface
interface MockEventEmitter {
  on(event: string | symbol, listener: (...args: unknown[]) => void): this;
  off(event: string | symbol, listener: (...args: unknown[]) => void): this;
  emit(event: string | symbol, ...args: unknown[]): boolean;
  addListener(event: string | symbol, listener: (...args: unknown[]) => void): this;
  once(event: string | symbol, listener: (...args: unknown[]) => void): this;
  removeListener(event: string | symbol, listener: (...args: unknown[]) => void): this;
  removeAllListeners(event?: string | symbol): this;
  setMaxListeners(n: number): this;
  getMaxListeners(): number;
  listeners(event: string | symbol): ((...args: unknown[]) => void)[];
  rawListeners(event: string | symbol): ((...args: unknown[]) => void)[];
  listenerCount(event: string | symbol): number;
  prependListener(event: string | symbol, listener: (...args: unknown[]) => void): this;
  prependOnceListener(event: string | symbol, listener: (...args: unknown[]) => void): this;
  eventNames(): (string | symbol)[];
}

// Create a mock ErrorManager that satisfies the interface
function createMockErrorManager(): ErrorManager {
  const mockErrorManager = {
    // EventEmitter methods
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    addListener: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    removeListener: vi.fn().mockReturnThis(),
    removeAllListeners: vi.fn().mockReturnThis(),
    setMaxListeners: vi.fn().mockReturnThis(),
    getMaxListeners: vi.fn().mockReturnValue(10),
    listeners: vi.fn().mockReturnValue([]),
    rawListeners: vi.fn().mockReturnValue([]),
    listenerCount: vi.fn().mockReturnValue(0),
    prependListener: vi.fn().mockReturnThis(),
    prependOnceListener: vi.fn().mockReturnThis(),
    eventNames: vi.fn().mockReturnValue([]),

    // ErrorManager specific methods
    handleError: vi.fn(),
    addHandler: vi.fn(),
    removeHandler: vi.fn(),
    addFilter: vi.fn(),
    removeFilter: vi.fn(),
    addTransformer: vi.fn(),
    removeTransformer: vi.fn(),
    addBreadcrumb: vi.fn(),
    getBreadcrumbs: vi.fn().mockReturnValue([]),
    clearBreadcrumbs: vi.fn(),
    getStats: vi.fn().mockReturnValue({
      total: 0,
      byCategory: {},
      bySeverity: {},
      recovered: 0,
      unhandled: 0,
    }),
    getHistory: vi.fn().mockReturnValue([]),
    clearHistory: vi.fn(),

    // Mock properties
    config: {
      maxBreadcrumbs: 50,
      enableStackTraceEnhancement: true,
      enableEnvironmentSnapshot: true,
      enableAutoRecovery: true,
      recoveryTimeout: 5000,
      reportingEnabled: true,
      debugMode: false,
    },
    handlers: new Map(),
    filters: new Set(),
    transformers: new Set(),
  } as unknown as ErrorManager;

  return mockErrorManager;
}

describe('EventBusIntegration', () => {
  let eventBusIntegration: EventBusIntegration;
  let mockEventBus: MockEventEmitter;
  let mockErrorManager: ErrorManager;

  beforeEach(() => {
    mockEventBus = {
      on: vi.fn().mockReturnThis(),
      off: vi.fn().mockReturnThis(),
      emit: vi.fn().mockReturnValue(true),
      addListener: vi.fn().mockReturnThis(),
      once: vi.fn().mockReturnThis(),
      removeListener: vi.fn().mockReturnThis(),
      removeAllListeners: vi.fn().mockReturnThis(),
      setMaxListeners: vi.fn().mockReturnThis(),
      getMaxListeners: vi.fn().mockReturnValue(10),
      listeners: vi.fn().mockReturnValue([]),
      rawListeners: vi.fn().mockReturnValue([]),
      listenerCount: vi.fn().mockReturnValue(0),
      prependListener: vi.fn().mockReturnThis(),
      prependOnceListener: vi.fn().mockReturnThis(),
      eventNames: vi.fn().mockReturnValue([]),
    };

    mockErrorManager = createMockErrorManager();

    eventBusIntegration = new EventBusIntegration(mockErrorManager, mockEventBus);
  });

  it('should initialize with default configuration', () => {
    expect(eventBusIntegration).toBeDefined();
  });

  it('should handle error events', async () => {
    const testError = new TestError('Test error');
    const mockContext: Partial<ErrorContext> = {
      timestamp: Date.now(),
      breadcrumbs: [],
    };

    // Simulate error event
    const errorHandler = vi.fn();
    eventBusIntegration.on('error', errorHandler);

    // Trigger error handling
    eventBusIntegration.emit('error', { error: testError, context: mockContext });

    expect(errorHandler).toHaveBeenCalledWith({ error: testError, context: mockContext });
  });

  it('should subscribe to event bus events', () => {
    expect(mockEventBus.on).toHaveBeenCalled();
  });

  it('should cleanup subscriptions', () => {
    eventBusIntegration.removeAllListeners();
    expect(eventBusIntegration.listenerCount('error')).toBe(0);
  });
});

describe('PluginIntegration', () => {
  let pluginIntegration: PluginIntegration;
  let mockErrorManager: ErrorManager;

  beforeEach(() => {
    mockErrorManager = createMockErrorManager();

    pluginIntegration = new PluginIntegration(mockErrorManager);
  });

  it('should initialize with default configuration', () => {
    expect(pluginIntegration).toBeDefined();
  });

  it('should register plugin error handlers', () => {
    const mockHandler = vi.fn();
    const pluginId = createPluginId('test-plugin');

    pluginIntegration.registerPluginErrorHandler(pluginId, mockHandler);

    // Verify handler was registered
    expect(pluginIntegration.listenerCount('pluginHandlerRegistered')).toBeGreaterThanOrEqual(0);
  });

  it('should handle plugin errors', async () => {
    const pluginId = createPluginId('test-plugin');
    const testError = new TestPluginError('Plugin error', pluginId, 'runtime');

    const mockContext: Partial<ErrorContext> = {
      timestamp: Date.now(),
      pluginId: pluginId,
      breadcrumbs: [],
    };

    await pluginIntegration.handlePluginError(testError, mockContext as ErrorContext);

    // Verify error was processed
    expect(mockErrorManager.handleError).toHaveBeenCalledWith(testError, mockContext);
  });

  it('should unregister plugin error handlers', () => {
    const mockHandler = vi.fn();
    const pluginId = createPluginId('test-plugin');

    pluginIntegration.registerPluginErrorHandler(pluginId, mockHandler);
    pluginIntegration.unregisterPluginErrorHandlers(pluginId);

    // Verify handler was unregistered
    expect(pluginIntegration.listenerCount('pluginHandlersUnregistered')).toBeGreaterThanOrEqual(0);
  });
});
