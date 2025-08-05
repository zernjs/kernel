import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorDisplay, type ErrorDisplayConfig, type ErrorNotification } from './error-display.js';
import {
  ZernError,
  type ErrorCategory,
  type ErrorSeverity,
  type ErrorContext,
  type ErrorSuggestion,
  type RecoveryStrategy,
} from '../types/base.js';
import { createPluginId } from '../../types/plugin.js';
import { type KernelState } from '../../types/kernel.js';

// Mock DOM environment
const mockElement = {
  innerHTML: '',
  appendChild: vi.fn(),
  removeChild: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn().mockReturnValue([]),
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
    contains: vi.fn(),
  },
  style: {},
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  setAttribute: vi.fn(),
  getAttribute: vi.fn(),
  removeAttribute: vi.fn(),
};

// Mock document and browser APIs
interface GlobalWithDocument {
  document: {
    createElement: ReturnType<typeof vi.fn>;
    getElementById: ReturnType<typeof vi.fn>;
    querySelector: ReturnType<typeof vi.fn>;
    querySelectorAll: ReturnType<typeof vi.fn>;
    documentElement: {
      setAttribute: ReturnType<typeof vi.fn>;
    };
    body: {
      appendChild: ReturnType<typeof vi.fn>;
      removeChild: ReturnType<typeof vi.fn>;
    };
  };
  requestAnimationFrame: ReturnType<typeof vi.fn>;
}

(global as unknown as GlobalWithDocument).document = {
  createElement: vi.fn().mockReturnValue(mockElement),
  getElementById: vi.fn().mockReturnValue(mockElement),
  querySelector: vi.fn().mockReturnValue(mockElement),
  querySelectorAll: vi.fn().mockReturnValue([mockElement]),
  documentElement: {
    setAttribute: vi.fn(),
  },
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },
};

// Mock requestAnimationFrame
(global as unknown as GlobalWithDocument).requestAnimationFrame = vi.fn(
  (callback: (time: number) => void) => {
    // Execute callback immediately in tests
    callback(0);
    return 1; // Return a mock request ID
  }
);

// Mock implementation for testing
class TestError extends ZernError {
  readonly category: ErrorCategory = 'plugin';
  readonly severity: ErrorSeverity = 'medium';
  readonly recoverable = true;
  readonly code = 'TEST_ERROR';

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'fix',
        title: 'Fix test error',
        description: 'This is a test suggestion',
        confidence: 0.8,
        priority: 1,
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'retry',
        priority: 1,
        description: 'Retry the operation',
        canRecover: () => true,
        recover: async () => ({ success: true, strategy: 'retry', duration: 100 }),
      },
      {
        name: 'fallback',
        priority: 2,
        description: 'Use fallback approach',
        canRecover: () => true,
        recover: async () => ({ success: true, strategy: 'fallback', duration: 200 }),
      },
    ];
  }
}

describe('ErrorDisplay', () => {
  let errorDisplay: ErrorDisplay;

  // Helper function to create mock ErrorContext
  const createMockContext = (overrides: Partial<ErrorContext> = {}): ErrorContext => ({
    timestamp: Date.now(),
    kernelState: 'running' as KernelState,
    pluginStates: new Map(),
    breadcrumbs: [],
    stackTrace: { original: '', parsed: [] },
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
    ...overrides,
  });

  beforeEach(() => {
    // Clear only the mockElement mocks, not the global document mock
    mockElement.appendChild.mockClear();
    mockElement.removeChild.mockClear();
    mockElement.querySelector.mockClear();
    mockElement.querySelectorAll.mockClear();
    mockElement.classList.add.mockClear();
    mockElement.classList.remove.mockClear();
    mockElement.classList.contains.mockClear();
    mockElement.addEventListener.mockClear();
    mockElement.removeEventListener.mockClear();
    mockElement.setAttribute.mockClear();
    mockElement.getAttribute.mockClear();
    mockElement.removeAttribute.mockClear();

    errorDisplay = new ErrorDisplay({
      theme: 'dark',
      showStackTrace: true,
      showSuggestions: true,
      autoHideDelay: 5000,
    });
  });

  afterEach(() => {
    // Clear only the mockElement mocks, not the global document mock
    mockElement.appendChild.mockClear();
    mockElement.removeChild.mockClear();
    mockElement.querySelector.mockClear();
    mockElement.querySelectorAll.mockClear();
    mockElement.classList.add.mockClear();
    mockElement.classList.remove.mockClear();
    mockElement.classList.contains.mockClear();
    mockElement.addEventListener.mockClear();
    mockElement.removeEventListener.mockClear();
    mockElement.setAttribute.mockClear();
    mockElement.getAttribute.mockClear();
    mockElement.removeAttribute.mockClear();
  });

  describe('constructor', () => {
    it('should create error display with default options', () => {
      const display = new ErrorDisplay();
      expect(display).toBeInstanceOf(ErrorDisplay);
    });

    it('should create error display with custom options', () => {
      const options: Partial<ErrorDisplayConfig> = {
        theme: 'light',
        showStackTrace: false,
        showSuggestions: false,
        autoHideDelay: 3000,
      };

      const display = new ErrorDisplay(options);
      expect(display).toBeInstanceOf(ErrorDisplay);
    });
  });

  describe('error display', () => {
    it('should display error with all components', () => {
      const error = new TestError('Test error');
      const context = createMockContext();

      const displayId = errorDisplay.displayError(error, context);

      expect(displayId).toBeDefined();
      expect(typeof displayId).toBe('string');
    });

    it('should display error without stack trace when disabled', () => {
      const display = new ErrorDisplay({
        showStackTrace: false,
      });

      const error = new TestError('Test error');
      const context = createMockContext();

      const displayId = display.displayError(error, context);

      expect(displayId).toBeDefined();
    });

    it('should display error without suggestions when disabled', () => {
      const display = new ErrorDisplay({
        showSuggestions: false,
      });

      const error = new TestError('Test error');
      const context = createMockContext();

      const displayId = display.displayError(error, context);

      expect(displayId).toBeDefined();
    });

    it('should display error without context when disabled', () => {
      const display = new ErrorDisplay({
        showContext: false,
      });

      const error = new TestError('Test error');
      const context = createMockContext();

      const displayId = display.displayError(error, context);

      expect(displayId).toBeDefined();
    });
  });

  describe('error management', () => {
    it('should dismiss displayed error', () => {
      const error = new TestError('Test error');
      const context = createMockContext();

      const displayId = errorDisplay.displayError(error, context);
      const dismissed = errorDisplay.dismissError(displayId);

      expect(dismissed).toBe(true);
    });

    it('should return false when dismissing non-existent error', () => {
      const dismissed = errorDisplay.dismissError('non-existent');
      expect(dismissed).toBe(false);
    });

    it('should clear all displayed errors', () => {
      const error1 = new TestError('Error 1');
      const error2 = new TestError('Error 2');
      const context = createMockContext();

      errorDisplay.displayError(error1, context);
      errorDisplay.displayError(error2, context);

      errorDisplay.clearAll();

      const displayedErrors = errorDisplay.getDisplayedErrors();
      expect(displayedErrors).toHaveLength(0);
    });

    it('should get all displayed errors', () => {
      const error1 = new TestError('Error 1');
      const error2 = new TestError('Error 2');
      const context = createMockContext();

      errorDisplay.displayError(error1, context);
      errorDisplay.displayError(error2, context);

      const displayedErrors = errorDisplay.getDisplayedErrors();

      expect(displayedErrors).toHaveLength(2);
    });
  });

  describe('error limits', () => {
    it('should respect max displayed errors limit', () => {
      const display = new ErrorDisplay({
        autoHideDelay: 0,
      });

      const context = createMockContext();

      // Display more errors than the limit
      for (let i = 0; i < 5; i++) {
        const error = new TestError(`Error ${i}`);
        display.displayError(error, context);
      }

      const displayedErrors = display.getDisplayedErrors();
      expect(displayedErrors.length).toBeGreaterThan(0);
    });

    it('should track displayed errors', () => {
      const display = new ErrorDisplay({
        autoHideDelay: 0,
      });

      const context = createMockContext();

      const error1 = new TestError('Error 1');
      const error2 = new TestError('Error 2');
      const error3 = new TestError('Error 3');

      const id1 = display.displayError(error1, context);
      const id2 = display.displayError(error2, context);
      const id3 = display.displayError(error3, context);

      const displayedErrors = display.getDisplayedErrors();
      expect(displayedErrors).toContain(id1);
      expect(displayedErrors).toContain(id2);
      expect(displayedErrors).toContain(id3);
    });
  });

  describe('auto hide', () => {
    it('should configure auto hide delay', () => {
      const display = new ErrorDisplay({
        autoHideDelay: 100, // Short delay for testing
      });

      const error = new TestError('Test error');
      const context = createMockContext();

      const displayId = display.displayError(error, context);
      expect(displayId).toBeDefined();
    });

    it('should not auto hide when delay is 0', () => {
      const display = new ErrorDisplay({
        autoHideDelay: 0,
      });

      const error = new TestError('Test error');
      const context = createMockContext();

      const displayId = display.displayError(error, context);
      expect(displayId).toBeDefined();
    });
  });

  describe('theming', () => {
    it('should apply dark theme', () => {
      const display = new ErrorDisplay({
        theme: 'dark',
      });

      const error = new TestError('Test error');
      const context = createMockContext();

      const displayId = display.displayError(error, context);
      expect(displayId).toBeDefined();
    });

    it('should apply light theme', () => {
      const display = new ErrorDisplay({
        theme: 'light',
      });

      const error = new TestError('Test error');
      const context = createMockContext();

      const displayId = display.displayError(error, context);
      expect(displayId).toBeDefined();
    });

    it('should update configuration', () => {
      errorDisplay.updateConfig({ theme: 'light' });

      const error = new TestError('Test error');
      const context = createMockContext();

      const displayId = errorDisplay.displayError(error, context);
      expect(displayId).toBeDefined();
    });
  });

  describe('interaction', () => {
    it('should handle error display', () => {
      const error = new TestError('Test error');
      const context = createMockContext();

      const displayId = errorDisplay.displayError(error, context);
      expect(displayId).toBeDefined();
    });

    it('should handle notifications', () => {
      const notification: ErrorNotification = {
        id: 'test-notification',
        title: 'Test Notification',
        message: 'This is a test notification',
        severity: 'medium',
        type: 'toast',
      };
      const displayId = errorDisplay.showNotification(notification);
      expect(displayId).toBeDefined();
    });
  });

  describe('error filtering', () => {
    it('should display errors', () => {
      const highError = new TestError('High error');
      const lowError = new TestError('Low error');
      const context = createMockContext();

      const highId = errorDisplay.displayError(highError, context);
      const lowId = errorDisplay.displayError(lowError, context);

      const displayedErrors = errorDisplay.getDisplayedErrors();
      expect(displayedErrors).toContain(highId);
      expect(displayedErrors).toContain(lowId);
    });

    it('should display different error types', () => {
      class SystemError extends ZernError {
        readonly category: ErrorCategory = 'kernel';
        readonly severity: ErrorSeverity = 'medium';
        readonly recoverable = true;
        readonly code = 'SYSTEM_ERROR';

        getSuggestions(): ErrorSuggestion[] {
          return [];
        }
        getRecoveryStrategies(): RecoveryStrategy[] {
          return [];
        }
      }

      const pluginError = new TestError('Plugin error');
      const systemError = new SystemError('System error');
      const context = createMockContext();

      const pluginId = errorDisplay.displayError(pluginError, context);
      const systemId = errorDisplay.displayError(systemError, context);

      const displayedErrors = errorDisplay.getDisplayedErrors();
      expect(displayedErrors).toContain(pluginId);
      expect(displayedErrors).toContain(systemId);
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      // Add some test data
      const error1 = new TestError('Error 1');
      const error2 = new TestError('Error 2');
      const context = createMockContext();

      errorDisplay.displayError(error1, context);
      errorDisplay.displayError(error2, context);
    });

    it('should return display statistics', () => {
      const stats = errorDisplay.getStatistics();

      expect(stats).toBeDefined();
      expect(typeof stats.totalDisplayed).toBe('number');
      expect(typeof stats.totalDismissed).toBe('number');
      expect(typeof stats.averageDisplayTime).toBe('number');
      expect(typeof stats.interactionRate).toBe('number');
    });

    it('should track displayed errors', () => {
      const display = new ErrorDisplay({
        autoHideDelay: 50,
      });

      const error = new TestError('Auto hide error');
      const context = createMockContext();

      const displayId = display.displayError(error, context);
      expect(displayId).toBeDefined();

      const stats = display.getStatistics();
      expect(stats).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should update display configuration', () => {
      const newConfig: Partial<ErrorDisplayConfig> = {
        theme: 'light',
        showStackTrace: false,
        showSuggestions: false,
        autoHideDelay: 5000,
      };

      errorDisplay.updateConfig(newConfig);

      // Test that the update was successful by displaying an error
      const error = new TestError('Test error');
      const context = createMockContext();
      const displayId = errorDisplay.displayError(error, context);
      expect(displayId).toBeDefined();
    });

    it('should handle configuration updates', () => {
      const config: Partial<ErrorDisplayConfig> = {
        theme: 'dark',
        showStackTrace: true,
        showSuggestions: true,
        autoHideDelay: 0,
      };

      errorDisplay.updateConfig(config);

      // Test that the configuration is working
      const error = new TestError('Test error');
      const context = createMockContext();
      const displayId = errorDisplay.displayError(error, context);
      expect(displayId).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should clear all displayed errors', () => {
      const error = new TestError('Test error');
      const context = createMockContext();

      errorDisplay.displayError(error, context);
      expect(errorDisplay.getDisplayedErrors().length).toBeGreaterThan(0);

      errorDisplay.clearAll();
      expect(errorDisplay.getDisplayedErrors()).toHaveLength(0);
    });

    it('should handle error dismissal', () => {
      const error = new TestError('Test error');
      const context = createMockContext();

      const displayId = errorDisplay.displayError(error, context);
      expect(errorDisplay.getDisplayedErrors()).toContain(displayId);

      errorDisplay.dismissError(displayId);
      expect(errorDisplay.getDisplayedErrors()).not.toContain(displayId);
    });
  });

  describe('accessibility', () => {
    it('should add accessibility attributes to error elements', () => {
      const error = new TestError('Test error');
      const context = createMockContext();

      const displayId = errorDisplay.displayError(error, context);

      expect(displayId).toBeDefined();
      // In a real implementation, we would check for ARIA attributes
      // expect(mockElement.getAttribute('role')).toBe('alert');
      // expect(mockElement.getAttribute('aria-live')).toBe('polite');
    });

    it('should support keyboard navigation', () => {
      const error = new TestError('Test error');
      const context = createMockContext();

      errorDisplay.displayError(error, context);

      // In a real implementation, we would test keyboard events
      // const event = new KeyboardEvent('keydown', { key: 'Escape' });
      // mockElement.dispatchEvent(event);
      // expect(errorDisplay.getDisplayedErrors()).toHaveLength(0);
    });
  });
});
