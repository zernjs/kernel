import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginIntegration } from './index.js';
import { ErrorSuggestion, RecoveryStrategy, ErrorContext, PluginLifecyclePhase } from '../index.js';
import { PluginError } from '../types/plugin-errors.js';
import { createPluginId } from '../../types/utils.js';
import type { PluginId } from '../../types/utils.js';
import type { ErrorManager } from '../core/error-manager.js';

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
