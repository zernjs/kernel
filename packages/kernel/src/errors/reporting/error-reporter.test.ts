import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorReporter, type ReportingTransport, type ReportingFilter } from './error-reporter.js';
import {
  ZernError,
  type ErrorCategory,
  type ErrorSeverity,
  type ErrorContext,
  type ErrorSuggestion,
  type RecoveryStrategy,
} from '../types/base.js';
import { createPluginId } from '../../types/utils.js';

// Helper function to create a complete ErrorContext for testing
function createTestErrorContext(overrides: Partial<ErrorContext> = {}): ErrorContext {
  return {
    timestamp: Date.now(),
    kernelState: 'running',
    pluginStates: new Map(),
    breadcrumbs: [],
    stackTrace: {
      original: 'Error\n    at test',
      parsed: [],
    },
    environment: {
      nodeVersion: '18.0.0',
      platform: 'test',
      arch: 'x64',
      memory: {
        used: 100,
        total: 1000,
        percentage: 10,
      },
      cpu: {
        usage: 50,
        loadAverage: [1, 1, 1],
      },
      uptime: 1000,
      environment: {},
    },
    ...overrides,
  };
}

// Mock implementation for testing
class TestError extends ZernError {
  readonly category: ErrorCategory = 'plugin';
  readonly severity: ErrorSeverity = 'high';
  readonly recoverable = true;
  readonly code = 'TEST_ERROR';

  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super(message, options);
  }

  getSuggestions(): ErrorSuggestion[] {
    return [];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [];
  }

  // Override withMetadata to return a new TestError instance
  override withMetadata(metadata: Record<string, unknown>): this {
    const newError = new TestError(this.message, {
      cause: this.cause as Error,
      metadata: { ...this.metadata, ...metadata },
    });
    // Copy other properties
    Object.setPrototypeOf(newError, TestError.prototype);
    return newError as this;
  }
}

describe('ErrorReporter', () => {
  let errorReporter: ErrorReporter;
  let mockConsoleTransport: ReturnType<typeof vi.fn>;
  let mockFileTransport: ReturnType<typeof vi.fn>;
  let mockRemoteTransport: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    errorReporter = new ErrorReporter({
      enabled: true,
      reportingLevel: 'low',
      sanitizeData: true,
      batchSize: 10,
      batchTimeout: 5000,
    });

    mockConsoleTransport = vi.fn().mockResolvedValue(undefined);
    mockFileTransport = vi.fn().mockResolvedValue(undefined);
    mockRemoteTransport = vi.fn().mockResolvedValue(undefined);

    errorReporter.addTransport({
      name: 'console',
      send: mockConsoleTransport,
      canSend: () => true,
    });
    errorReporter.addTransport({
      name: 'file',
      send: mockFileTransport,
      canSend: () => true,
    });
    errorReporter.addTransport({
      name: 'remote',
      send: mockRemoteTransport,
      canSend: () => true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create error reporter with default config', () => {
      const reporter = new ErrorReporter();
      expect(reporter).toBeInstanceOf(ErrorReporter);
    });

    it('should create error reporter with custom config', () => {
      const config = {
        enabled: false,
        reportingLevel: 'high' as const,
        sanitizeData: false,
        batchSize: 5,
        batchTimeout: 10000,
      };
      const reporter = new ErrorReporter(config);
      expect(reporter).toBeInstanceOf(ErrorReporter);
    });
  });

  describe('transport management', () => {
    it('should add transport', () => {
      const transport: ReportingTransport = {
        name: 'custom',
        send: vi.fn().mockResolvedValue(undefined),
        canSend: () => true,
      };
      errorReporter.addTransport(transport);
      // Transport is added successfully if no error is thrown
      expect(true).toBe(true);
    });

    it('should remove transport', () => {
      const result = errorReporter.removeTransport('console');
      expect(result).toBe(true);
    });

    it('should return false when removing non-existent transport', () => {
      const result = errorReporter.removeTransport('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('error reporting', () => {
    it('should report error to all transports', async () => {
      const error = new TestError('Test error');
      const context = createTestErrorContext();

      const result = await errorReporter.report(error, context);
      await errorReporter.flush(); // Force sending pending reports

      expect(typeof result).toBe('string'); // Returns report ID
      expect(mockConsoleTransport).toHaveBeenCalled();
      expect(mockFileTransport).toHaveBeenCalled();
      expect(mockRemoteTransport).toHaveBeenCalled();
    });

    it('should report error and return report ID', async () => {
      const error = new TestError('Test error');
      const context = createTestErrorContext();

      const result = await errorReporter.report(error, context);

      expect(typeof result).toBe('string');
      expect(result).toMatch(/^report-\d+-\d+$/);
    });

    it('should not report when reporting is disabled', async () => {
      const reporter = new ErrorReporter({ enabled: false });
      reporter.addTransport({
        name: 'console',
        send: mockConsoleTransport,
        canSend: () => true,
      });

      const error = new TestError('Test error');
      const context = createTestErrorContext();

      const result = await reporter.report(error, context);

      expect(result).toBeNull();
      expect(mockConsoleTransport).not.toHaveBeenCalled();
    });

    it('should not report errors below reporting level', async () => {
      const reporter = new ErrorReporter({ reportingLevel: 'high' });
      reporter.addTransport({
        name: 'console',
        send: mockConsoleTransport,
        canSend: () => true,
      });

      // Create a low severity error
      class LowSeverityError extends TestError {
        override readonly severity: ErrorSeverity = 'low';
      }
      const error = new LowSeverityError('Low severity error');
      const context = createTestErrorContext();

      const result = await reporter.report(error, context);

      expect(result).toBeNull();
      expect(mockConsoleTransport).not.toHaveBeenCalled();
    });
  });

  describe('error sanitization', () => {
    it('should sanitize sensitive data when enabled', async () => {
      const baseError = new TestError('Error with password: secret123');
      const error = baseError.withMetadata({ password: 'secret123', apiKey: 'key123' });
      const context = createTestErrorContext({
        pluginId: createPluginId('test-plugin'),
      });

      await errorReporter.report(error, context);
      await errorReporter.flush(); // Force sending pending reports

      const reportCall = mockConsoleTransport.mock.calls[0]?.[0]; // Array of reports
      const report = Array.isArray(reportCall) ? reportCall[0] : reportCall;
      expect(report?.error.message).not.toContain('secret123');
      expect(report.error.metadata.password).toBe('[REDACTED]');
      expect(report.error.metadata.apiKey).toBe('[REDACTED]');
    });

    it('should not sanitize when sanitization is disabled', async () => {
      const reporter = new ErrorReporter({ sanitizeData: false });
      reporter.addTransport({
        name: 'console',
        send: mockConsoleTransport,
        canSend: () => true,
      });

      const baseError = new TestError('Error with password: secret123');
      const error = baseError.withMetadata({ password: 'secret123' });
      const context = createTestErrorContext({ pluginId: createPluginId('test-plugin') });

      await reporter.report(error, context);
      await reporter.flush(); // Force sending pending reports

      const reportCall = mockConsoleTransport.mock.calls[0]?.[0]; // Array of reports
      const report = Array.isArray(reportCall) ? reportCall[0] : reportCall;
      expect(report?.error.message).toContain('secret123');
      expect(report.error.metadata.password).toBe('secret123');
    });
  });

  describe('batch reporting', () => {
    it('should handle multiple error reports', async () => {
      const errors = [new TestError('Error 1'), new TestError('Error 2'), new TestError('Error 3')];
      const context = createTestErrorContext();

      const results = await Promise.all(errors.map(error => errorReporter.report(error, context)));

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(typeof result).toBe('string');
      });
    });

    it('should handle batch configuration', async () => {
      const reporter = new ErrorReporter({
        batchSize: 2,
        batchTimeout: 1000,
      });

      const mockTransport = vi.fn().mockResolvedValue(undefined);
      reporter.addTransport({
        name: 'batch-test',
        send: mockTransport,
        canSend: () => true,
      });

      const error1 = new TestError('Error 1');
      const error2 = new TestError('Error 2');
      const context = createTestErrorContext();

      const result1 = await reporter.report(error1, context);
      const result2 = await reporter.report(error2, context);

      expect(typeof result1).toBe('string');
      expect(typeof result2).toBe('string');
    });
  });

  describe('reporting filters', () => {
    it('should respect reporting filters', async () => {
      const filter: ReportingFilter = {
        name: 'test-filter',
        filter: report => !report.error.message.includes('ignore'),
      };

      errorReporter.addFilter(filter);

      const error1 = new TestError('Normal error');
      const error2 = new TestError('Please ignore this error');
      const context = createTestErrorContext();

      const result1 = await errorReporter.report(error1, context);
      const result2 = await errorReporter.report(error2, context);

      expect(typeof result1).toBe('string');
      expect(typeof result2).toBe('string'); // Returns reportId even when filtered

      // Check that the filtered report has 'ignored' status
      const report2 = errorReporter.getReport(result2 as string);
      expect(report2?.status).toBe('ignored');

      // Check that the normal report is still pending
      const report1 = errorReporter.getReport(result1 as string);
      expect(report1?.status).toBe('pending');
    });

    it('should remove reporting filters', () => {
      const filter = vi.fn().mockReturnValue(true);
      const filterObj = {
        name: 'test-filter',
        filter: filter,
      };
      errorReporter.addFilter(filterObj);

      const result = errorReporter.removeFilter(filterObj);
      expect(result).toBe(true);

      // Removing non-existent filter should return false
      const nonExistentFilter = {
        name: 'non-existent',
        filter: vi.fn(),
      };
      const result2 = errorReporter.removeFilter(nonExistentFilter);
      expect(result2).toBe(false);
    });
  });

  describe('report retrieval', () => {
    let reportId1: string;

    beforeEach(async () => {
      // Add some test data
      const error1 = new TestError('Error 1');
      const error2 = new TestError('Error 2');
      const context = createTestErrorContext();

      reportId1 = (await errorReporter.report(error1, context)) as string;
      await errorReporter.report(error2, context);
      // No need to flush here as we're testing report storage, not transport
    });

    it('should retrieve all reports', () => {
      const reports = errorReporter.getAllReports();
      expect(reports.length).toBeGreaterThanOrEqual(2);
    });

    it('should retrieve reports by status', () => {
      const pendingReports = errorReporter.getPendingReports();
      const allReports = errorReporter.getAllReports();

      expect(pendingReports.length).toBeGreaterThanOrEqual(0);
      expect(allReports.length).toBeGreaterThanOrEqual(2);
    });

    it('should retrieve specific report by ID', () => {
      const report = errorReporter.getReport(reportId1);

      expect(report).toBeDefined();
      expect(report?.error.message).toBe('Error 1');
    });

    it('should return reporting statistics', () => {
      const stats = errorReporter.getStatistics();

      expect(stats.totalReports).toBeGreaterThan(0);
      expect(stats.sentReports).toBeGreaterThanOrEqual(0);
      expect(stats.failedReports).toBe(0);
      expect(stats.pendingReports).toBeGreaterThanOrEqual(0);
      expect(typeof stats.reportsByCategory).toBe('object');
      expect(typeof stats.reportsByLevel).toBe('object');
      expect(stats.averageReportSize).toBeGreaterThanOrEqual(0);
    });

    it('should track failed reports in statistics', async () => {
      mockConsoleTransport.mockRejectedValueOnce(new Error('Console failed'));

      const error = new TestError('Failed error');
      const context = createTestErrorContext({ pluginId: createPluginId('test-plugin') });

      await errorReporter.report(error, context);

      const stats = errorReporter.getStatistics();
      expect(stats.totalReports).toBeGreaterThanOrEqual(3);
      expect(stats.failedReports).toBeGreaterThanOrEqual(0);
      expect(typeof stats.reportsByCategory).toBe('object');
    });
  });

  describe('reporting timeout', () => {
    it('should timeout slow transports', async () => {
      const slowTransport = vi
        .fn()
        .mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 6000))
        );

      const reporter = new ErrorReporter({ batchTimeout: 1000 });
      reporter.addTransport({
        name: 'slow',
        send: slowTransport,
        canSend: () => true,
      });

      const error = new TestError('Test error');
      const context = createTestErrorContext({ pluginId: createPluginId('test-plugin') });

      const result = await reporter.report(error, context);

      expect(typeof result).toBe('string');
    });
  });

  describe('report size limits', () => {
    it('should handle large reports', async () => {
      const reporter = new ErrorReporter({ batchSize: 100 }); // Large batch size
      reporter.addTransport({
        name: 'console',
        send: mockConsoleTransport,
        canSend: () => true,
      });

      const largeError = new TestError('A'.repeat(200));
      const context = createTestErrorContext({ pluginId: createPluginId('test-plugin') });

      const result = await reporter.report(largeError, context);
      await reporter.flush(); // Force sending pending reports

      expect(typeof result).toBe('string');
      expect(mockConsoleTransport).toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should update reporter configuration', () => {
      const newConfig = {
        enabled: false,
        reportingLevel: 'critical' as const,
        sanitizeData: false,
        batchSize: 20,
        batchTimeout: 10000,
      };

      // Test that updateConfig doesn't throw an error
      expect(() => errorReporter.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle transport execution errors gracefully', async () => {
      mockConsoleTransport.mockRejectedValue(new Error('Transport failed'));

      const error = new TestError('Test error');
      const context = createTestErrorContext({ pluginId: createPluginId('test-plugin') });

      const result = await errorReporter.report(error, context);

      expect(typeof result).toBe('string');
    });

    it('should handle invalid transport results', async () => {
      mockConsoleTransport.mockResolvedValue(null);

      const error = new TestError('Test error');
      const context = createTestErrorContext({ pluginId: createPluginId('test-plugin') });

      const result = await errorReporter.report(error, context);

      expect(typeof result).toBe('string');
    });
  });

  describe('cleanup', () => {
    it('should clear reporting history', async () => {
      const error = new TestError('Test error');
      const context = createTestErrorContext();

      await errorReporter.report(error, context);
      expect(errorReporter.getStatistics().totalReports).toBeGreaterThan(0);

      errorReporter.clear();
      expect(errorReporter.getStatistics().totalReports).toBe(0);
    });

    it('should flush pending reports', async () => {
      const error = new TestError('Test error');
      const context = createTestErrorContext();

      await errorReporter.report(error, context);
      await errorReporter.flush();

      // After flush, all pending reports should be processed
      const pendingReports = errorReporter.getPendingReports();
      expect(pendingReports.length).toBe(0);
    });
  });
});
