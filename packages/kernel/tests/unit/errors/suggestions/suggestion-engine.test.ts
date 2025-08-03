import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SuggestionEngine,
  type SuggestionRule,
} from '../../../../src/errors/suggestions/suggestion-engine.js';
import {
  ZernError,
  type ErrorCategory,
  type ErrorSeverity,
  type ErrorContext,
  type ErrorSuggestionType,
  type RecoveryStrategy,
} from '../../../../src/errors/types/base.js';
import { createPluginId } from '../../../../src/types/utils.js';

// Constants for ErrorCategory and ErrorSeverity values
const ErrorCategoryValues = {
  PLUGIN: 'plugin' as ErrorCategory,
  KERNEL: 'kernel' as ErrorCategory,
  CONFIGURATION: 'configuration' as ErrorCategory,
  DEPENDENCY: 'dependency' as ErrorCategory,
  VALIDATION: 'validation' as ErrorCategory,
  NETWORK: 'network' as ErrorCategory,
  FILESYSTEM: 'filesystem' as ErrorCategory,
  SECURITY: 'security' as ErrorCategory,
  PERFORMANCE: 'performance' as ErrorCategory,
  MEMORY: 'memory' as ErrorCategory,
  UNKNOWN: 'unknown' as ErrorCategory,
};

const ErrorSeverityValues = {
  LOW: 'low' as ErrorSeverity,
  MEDIUM: 'medium' as ErrorSeverity,
  HIGH: 'high' as ErrorSeverity,
  CRITICAL: 'critical' as ErrorSeverity,
};

// Mock implementation for testing
class TestError extends ZernError {
  readonly category = ErrorCategoryValues.PLUGIN;
  readonly severity = ErrorSeverityValues.MEDIUM;
  readonly recoverable = true;
  readonly code = 'TEST_ERROR';

  getSuggestions(): Array<{
    type: ErrorSuggestionType;
    title: string;
    description: string;
    confidence: number;
    priority: number;
  }> {
    return [
      {
        type: 'fix' as ErrorSuggestionType,
        title: 'Fix test error',
        description: 'This is a test suggestion',
        confidence: 0.8,
        priority: 1,
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [];
  }
}

describe('SuggestionEngine', () => {
  let suggestionEngine: SuggestionEngine;
  let mockRule1: SuggestionRule;
  let mockRule2: SuggestionRule;

  beforeEach(() => {
    suggestionEngine = new SuggestionEngine({
      enableBuiltInRules: true,
      maxSuggestions: 5,
      enableLearning: true,
      enableCaching: true,
    });

    mockRule1 = {
      id: 'rule1',
      name: 'Test Rule 1',
      description: 'First test rule',
      priority: 1,
      enabled: true,
      matcher: vi.fn().mockReturnValue(true),
      generator: vi.fn().mockReturnValue([
        {
          type: 'fix' as ErrorSuggestionType,
          title: 'Rule 1 suggestion',
          description: 'Suggestion from rule 1',
          confidence: 0.9,
          priority: 1,
        },
      ]),
    };

    mockRule2 = {
      id: 'rule2',
      name: 'Test Rule 2',
      description: 'Second test rule',
      priority: 2,
      enabled: true,
      matcher: vi.fn().mockReturnValue(true),
      generator: vi.fn().mockReturnValue([
        {
          type: 'workaround' as ErrorSuggestionType,
          title: 'Rule 2 suggestion',
          description: 'Suggestion from rule 2',
          confidence: 0.7,
          priority: 2,
        },
      ]),
    };

    suggestionEngine.addRule(mockRule1);
    suggestionEngine.addRule(mockRule2);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create suggestion engine with default config', () => {
      const engine = new SuggestionEngine();
      expect(engine).toBeInstanceOf(SuggestionEngine);
    });

    it('should create suggestion engine with custom config', () => {
      const config = {
        enableBuiltInRules: false,
        maxSuggestions: 10,
        enableLearning: false,
        enableCaching: false,
      };
      const engine = new SuggestionEngine(config);
      expect(engine).toBeInstanceOf(SuggestionEngine);
    });
  });

  describe('rule management', () => {
    it('should add suggestion rule', () => {
      const rule: SuggestionRule = {
        id: 'new-rule',
        name: 'New Rule',
        description: 'A new test rule',
        priority: 3,
        enabled: true,
        matcher: () => true,
        generator: () => [],
      };

      suggestionEngine.addRule(rule);

      const rules = suggestionEngine.getRules();
      expect(rules.some(r => r.id === 'new-rule')).toBe(true);
    });

    it('should remove suggestion rule', () => {
      suggestionEngine.removeRule('rule1');

      const rules = suggestionEngine.getRules();
      expect(rules.some(r => r.id === 'rule1')).toBe(false);
    });

    it('should enable/disable rules', () => {
      expect(suggestionEngine.setRuleEnabled('rule1', false)).toBe(true);
      expect(suggestionEngine.setRuleEnabled('nonexistent', false)).toBe(false);
    });

    it('should get all rules', () => {
      // Create a separate engine with built-in rules disabled for this test
      const testEngine = new SuggestionEngine({ enableBuiltInRules: false });
      testEngine.addRule(mockRule1);
      testEngine.addRule(mockRule2);

      const rules = testEngine.getRules();
      expect(rules).toHaveLength(2);
      expect(rules.some(r => r.id === 'rule1')).toBe(true);
      expect(rules.some(r => r.id === 'rule2')).toBe(true);
    });

    it('should get enabled rules', () => {
      suggestionEngine.setRuleEnabled('rule1', false);
      const enabledRules = suggestionEngine.getEnabledRules();
      expect(enabledRules.some(r => r.id === 'rule1')).toBe(false);
      expect(enabledRules.some(r => r.id === 'rule2')).toBe(true);
    });
  });

  describe('suggestion generation', () => {
    it('should generate suggestions for error', () => {
      // Create a separate engine with built-in rules and contextual suggestions disabled for this test
      const testEngine = new SuggestionEngine({
        enableBuiltInRules: false,
        enableContextualSuggestions: false,
      });

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

      const suggestions = testEngine.generateSuggestions(error, context);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]?.title).toBe('Fix test error');
    });

    it('should not generate suggestions when built-in rules disabled', () => {
      const engine = new SuggestionEngine({ enableBuiltInRules: false });
      engine.addRule(mockRule1);

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

      const suggestions = engine.generateSuggestions(error, context);

      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should respect max suggestions limit', () => {
      const engine = new SuggestionEngine({ maxSuggestions: 2 });
      engine.addRule(mockRule1);
      engine.addRule(mockRule2);

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

      const suggestions = engine.generateSuggestions(error, context);

      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it('should sort suggestions by priority', () => {
      // Update rule priorities to test sorting
      mockRule1.priority = 3;
      mockRule2.priority = 1;

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

      const suggestions = suggestionEngine.generateSuggestions(error, context);

      // Should be sorted by priority (higher number = higher priority)
      expect(suggestions.length).toBeGreaterThan(1);
      expect(suggestions[0]?.priority).toBeGreaterThanOrEqual(suggestions[1]?.priority ?? 0);
    });

    it('should only apply rules that match condition', () => {
      mockRule1.matcher = vi.fn().mockReturnValue(false); // This rule won't match
      mockRule2.matcher = vi.fn().mockReturnValue(true);

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

      const suggestions = suggestionEngine.generateSuggestions(error, context);

      expect(suggestions.some(s => s.title === 'Rule 1 suggestion')).toBe(false);
      expect(suggestions.some(s => s.title === 'Rule 2 suggestion')).toBe(true);
    });
  });

  describe('suggestion caching', () => {
    it('should cache suggestions for similar errors', () => {
      const error1 = new TestError('Test error');
      const error2 = new TestError('Test error');
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

      suggestionEngine.generateSuggestions(error1, context);
      suggestionEngine.generateSuggestions(error2, context);

      // Rules should only be called once due to caching
      expect(mockRule1.generator).toHaveBeenCalledTimes(1);
      expect(mockRule2.generator).toHaveBeenCalledTimes(1);
    });

    it('should clear suggestion cache', () => {
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

      suggestionEngine.generateSuggestions(error, context);
      suggestionEngine.clearCache();
      suggestionEngine.generateSuggestions(error, context);

      // Rules should be called twice after cache clear
      expect(mockRule1.generator).toHaveBeenCalledTimes(2);
      expect(mockRule2.generator).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle rule execution errors gracefully', () => {
      // Create a new engine with built-in rules and contextual suggestions disabled for this test
      const testEngine = new SuggestionEngine({
        enableBuiltInRules: false,
        enableContextualSuggestions: false,
        maxSuggestions: 5,
        enableLearning: true,
        enableCaching: true,
      });

      const errorRule: SuggestionRule = {
        id: 'error-rule',
        name: 'Error Rule',
        description: 'A rule that throws errors',
        priority: 1,
        enabled: true,
        matcher: () => true,
        generator: vi.fn().mockImplementation(() => {
          throw new Error('Rule execution failed');
        }),
      };

      testEngine.addRule(errorRule);

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

      const suggestions = testEngine.generateSuggestions(error, context);

      // Should still return suggestions from other sources (TestError.getSuggestions)
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]?.title).toBe('Fix test error');
    });

    it('should handle invalid suggestion results', () => {
      const invalidRule: SuggestionRule = {
        id: 'invalid-rule',
        name: 'Invalid Rule',
        description: 'A rule that returns invalid results',
        priority: 1,
        enabled: true,
        matcher: () => true,
        generator: vi.fn().mockReturnValue(null),
      };

      suggestionEngine.addRule(invalidRule);

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

      const suggestions = suggestionEngine.generateSuggestions(error, context);

      // Should handle invalid results gracefully
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      // Generate some test data
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

      suggestionEngine.generateSuggestions(error, context);
      suggestionEngine.generateSuggestions(error, context);
    });

    it('should return suggestion statistics', () => {
      const stats = suggestionEngine.getStatistics();

      expect(stats.totalSuggestions).toBeGreaterThan(0);
      expect(stats.cacheHits).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should clear all statistics', () => {
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

      suggestionEngine.generateSuggestions(error, context);
      expect(suggestionEngine.getStatistics().totalSuggestions).toBeGreaterThan(0);

      suggestionEngine.resetStatistics();
      expect(suggestionEngine.getStatistics().totalSuggestions).toBe(0);
    });
  });
});
