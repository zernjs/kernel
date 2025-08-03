/**
 * @fileoverview Error suggestion engine
 * @module @zern/kernel/errors/suggestions/suggestion-engine
 */

import { EventEmitter } from 'events';
import type { ZernError, ErrorSuggestion, ErrorContext } from '../types/base.js';

export interface SuggestionRule {
  id: string;
  name: string;
  description: string;
  priority: number;
  matcher: (error: ZernError, context: ErrorContext) => boolean;
  generator: (error: ZernError, context: ErrorContext) => ErrorSuggestion[];
  enabled: boolean;
}

export interface SuggestionEngineConfig {
  enableBuiltInRules: boolean;
  enableContextualSuggestions: boolean;
  enableLearning: boolean;
  maxSuggestions: number;
  minConfidence: number;
  enableCaching: boolean;
  cacheTimeout: number;
}

export interface SuggestionCache {
  key: string;
  suggestions: ErrorSuggestion[];
  timestamp: Date;
  hits: number;
}

export interface SuggestionStats {
  totalSuggestions: number;
  suggestionsByType: Record<string, number>;
  suggestionsByRule: Record<string, number>;
  averageConfidence: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Engine for generating contextual error suggestions
 */
export class SuggestionEngine extends EventEmitter {
  private readonly config: SuggestionEngineConfig;
  private readonly rules = new Map<string, SuggestionRule>();
  private readonly cache = new Map<string, SuggestionCache>();
  private readonly stats: SuggestionStats;

  constructor(config: Partial<SuggestionEngineConfig> = {}) {
    super();

    this.config = {
      enableBuiltInRules: true,
      enableContextualSuggestions: true,
      enableLearning: false,
      maxSuggestions: 10,
      minConfidence: 0.3,
      enableCaching: true,
      cacheTimeout: 300000, // 5 minutes
      ...config,
    };

    this.stats = {
      totalSuggestions: 0,
      suggestionsByType: {},
      suggestionsByRule: {},
      averageConfidence: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };

    if (this.config.enableBuiltInRules) {
      this.setupBuiltInRules();
    }
  }

  /**
   * Generate suggestions for an error
   */
  generateSuggestions(error: ZernError, context: ErrorContext): ErrorSuggestion[] {
    const cacheKey = this.generateCacheKey(error, context);

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getCachedSuggestions(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
      this.stats.cacheMisses++;
    }

    const suggestions: ErrorSuggestion[] = [];

    // Get suggestions from error itself
    const errorSuggestions = error.getSuggestions();
    suggestions.push(...errorSuggestions);

    // Apply suggestion rules
    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      try {
        if (rule.matcher(error, context)) {
          const ruleSuggestions = rule.generator(error, context);
          suggestions.push(...ruleSuggestions);

          this.stats.suggestionsByRule[rule.id] =
            (this.stats.suggestionsByRule[rule.id] || 0) + ruleSuggestions.length;
        }
      } catch (ruleError) {
        this.emit('ruleError', { rule, error: ruleError });
      }
    }

    // Add contextual suggestions if enabled
    if (this.config.enableContextualSuggestions) {
      const contextualSuggestions = this.generateContextualSuggestions(error, context);
      suggestions.push(...contextualSuggestions);
    }

    // Filter and sort suggestions
    const filteredSuggestions = this.filterAndSortSuggestions(suggestions);

    // Cache the results
    if (this.config.enableCaching) {
      this.cacheSuggestions(cacheKey, filteredSuggestions);
    }

    // Update statistics
    this.updateStats(filteredSuggestions);

    this.emit('suggestionsGenerated', {
      error,
      context,
      suggestions: filteredSuggestions,
      cacheKey,
    });

    return filteredSuggestions;
  }

  /**
   * Add a suggestion rule
   */
  addRule(rule: SuggestionRule): void {
    this.rules.set(rule.id, rule);
    this.emit('ruleAdded', rule);
  }

  /**
   * Remove a suggestion rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      this.emit('ruleRemoved', ruleId);
    }
    return removed;
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      this.emit('ruleToggled', { ruleId, enabled });
      return true;
    }
    return false;
  }

  /**
   * Get all rules
   */
  getRules(): SuggestionRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get enabled rules
   */
  getEnabledRules(): SuggestionRule[] {
    return this.getRules().filter(rule => rule.enabled);
  }

  /**
   * Clear suggestion cache
   */
  clearCache(): void {
    this.cache.clear();
    this.emit('cacheCleared');
  }

  /**
   * Get suggestion statistics
   */
  getStatistics(): Readonly<SuggestionStats> {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    Object.assign(this.stats, {
      totalSuggestions: 0,
      suggestionsByType: {},
      suggestionsByRule: {},
      averageConfidence: 0,
      cacheHits: 0,
      cacheMisses: 0,
    });
    this.emit('statisticsReset');
  }

  /**
   * Generate cache key for error and context
   */
  private generateCacheKey(error: ZernError, context: ErrorContext): string {
    const keyParts = [
      error.category,
      error.code,
      error.severity,
      context.pluginId || '',
      context.operation || '',
      context.userId || '',
    ];

    return keyParts.join('|');
  }

  /**
   * Get cached suggestions
   */
  private getCachedSuggestions(cacheKey: string): ErrorSuggestion[] | null {
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    const now = new Date();
    const age = now.getTime() - cached.timestamp.getTime();

    if (age > this.config.cacheTimeout) {
      this.cache.delete(cacheKey);
      return null;
    }

    cached.hits++;
    return cached.suggestions;
  }

  /**
   * Cache suggestions
   */
  private cacheSuggestions(cacheKey: string, suggestions: ErrorSuggestion[]): void {
    this.cache.set(cacheKey, {
      key: cacheKey,
      suggestions: [...suggestions],
      timestamp: new Date(),
      hits: 0,
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, cached] of this.cache) {
      const age = now.getTime() - cached.timestamp.getTime();
      if (age > this.config.cacheTimeout) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }

  /**
   * Generate contextual suggestions based on error patterns
   */
  private generateContextualSuggestions(
    error: ZernError,
    context: ErrorContext
  ): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [];

    // Plugin-related contextual suggestions
    if (context.pluginId) {
      suggestions.push({
        type: 'debug',
        title: 'Check plugin status',
        description: `Verify the status and configuration of plugin: ${context.pluginId}`,
        confidence: 0.7,
        priority: 80,
        action: {
          type: 'command',
          payload: `zern plugin status ${context.pluginId}`,
        },
      });
    }

    // Operation-related contextual suggestions
    if (context.operation) {
      suggestions.push({
        type: 'debug',
        title: 'Review operation logs',
        description: `Check logs for operation: ${context.operation}`,
        confidence: 0.6,
        priority: 70,
        action: {
          type: 'command',
          payload: `zern logs --operation ${context.operation}`,
        },
      });
    }

    // Environment-related suggestions
    if (context.environment) {
      if (context.environment.memory) {
        const memory = context.environment.memory;
        if (memory.used && memory.total && memory.used / memory.total > 0.9) {
          suggestions.push({
            type: 'fix',
            title: 'High memory usage detected',
            description: 'Memory usage is above 90%, consider optimizing or increasing memory',
            confidence: 0.9,
            priority: 100,
          });
        }
      }
    }

    // Breadcrumb-based suggestions
    if (context.breadcrumbs && context.breadcrumbs.length > 0) {
      const recentErrors = context.breadcrumbs.filter(b => b.level === 'error').slice(-3);

      if (recentErrors.length > 1) {
        suggestions.push({
          type: 'debug',
          title: 'Multiple recent errors detected',
          description: 'Several errors occurred recently, check for underlying issues',
          confidence: 0.8,
          priority: 90,
        });
      }
    }

    return suggestions;
  }

  /**
   * Filter and sort suggestions
   */
  private filterAndSortSuggestions(suggestions: ErrorSuggestion[]): ErrorSuggestion[] {
    // Remove duplicates
    const uniqueSuggestions = suggestions.filter(
      (suggestion, index, array) =>
        array.findIndex(s => s.title === suggestion.title && s.type === suggestion.type) === index
    );

    // Filter by minimum confidence
    const filteredSuggestions = uniqueSuggestions.filter(
      suggestion => (suggestion.confidence || 0) >= this.config.minConfidence
    );

    // Sort by priority (descending) and confidence (descending)
    const sortedSuggestions = filteredSuggestions.sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return (b.confidence || 0) - (a.confidence || 0);
    });

    // Limit to max suggestions
    return sortedSuggestions.slice(0, this.config.maxSuggestions);
  }

  /**
   * Update statistics
   */
  private updateStats(suggestions: ErrorSuggestion[]): void {
    this.stats.totalSuggestions += suggestions.length;

    for (const suggestion of suggestions) {
      this.stats.suggestionsByType[suggestion.type] =
        (this.stats.suggestionsByType[suggestion.type] || 0) + 1;
    }

    // Update average confidence
    const totalConfidence = suggestions.reduce((sum, s) => sum + (s.confidence || 0), 0);
    if (suggestions.length > 0) {
      const newAverage = totalConfidence / suggestions.length;
      this.stats.averageConfidence = (this.stats.averageConfidence + newAverage) / 2;
    }
  }

  /**
   * Setup built-in suggestion rules
   */
  private setupBuiltInRules(): void {
    // Plugin initialization error rule
    this.addRule({
      id: 'plugin-init-error',
      name: 'Plugin Initialization Error',
      description: 'Suggests solutions for plugin initialization failures',
      priority: 100,
      enabled: true,
      matcher: (error, _context) =>
        error.category === 'plugin' && error.code.includes('INITIALIZATION'),
      generator: (_error, context) => [
        {
          type: 'fix',
          title: 'Check plugin dependencies',
          description: 'Verify that all plugin dependencies are installed and compatible',
          confidence: 0.9,
          priority: 110,
          action: {
            type: 'command',
            payload: `zern plugin deps ${context.pluginId}`,
          },
        },
        {
          type: 'fix',
          title: 'Validate plugin configuration',
          description: 'Check plugin configuration for syntax errors or missing required fields',
          confidence: 0.8,
          priority: 100,
          action: {
            type: 'command',
            payload: `zern plugin validate ${context.pluginId}`,
          },
        },
        {
          type: 'documentation',
          title: 'Plugin development guide',
          description: 'Review the plugin development documentation',
          confidence: 0.7,
          priority: 80,
          action: {
            type: 'link',
            payload: 'https://docs.zern.dev/plugins',
          },
        },
      ],
    });

    // Memory error rule
    this.addRule({
      id: 'memory-error',
      name: 'Memory Error',
      description: 'Suggests solutions for memory-related errors',
      priority: 90,
      enabled: true,
      matcher: (error, _context) =>
        error.code.includes('MEMORY') || error.message.toLowerCase().includes('memory'),
      generator: (_error, _context) => [
        {
          type: 'fix',
          title: 'Increase memory allocation',
          description: 'Consider increasing the memory allocation for the application',
          confidence: 0.8,
          priority: 100,
          action: {
            type: 'config',
            payload: { memoryLimit: '2GB' },
          },
        },
        {
          type: 'fix',
          title: 'Optimize memory usage',
          description: 'Review code for memory leaks and optimize memory usage',
          confidence: 0.7,
          priority: 90,
        },
        {
          type: 'workaround',
          title: 'Restart application',
          description: 'Restart the application to free up memory',
          confidence: 0.6,
          priority: 70,
          action: {
            type: 'command',
            payload: 'zern restart',
          },
        },
      ],
    });

    // Network error rule
    this.addRule({
      id: 'network-error',
      name: 'Network Error',
      description: 'Suggests solutions for network-related errors',
      priority: 80,
      enabled: true,
      matcher: (error, _context) =>
        error.category === 'network' || error.message.toLowerCase().includes('network'),
      generator: (_error, _context) => [
        {
          type: 'debug',
          title: 'Check network connectivity',
          description: 'Verify that network connection is available and stable',
          confidence: 0.9,
          priority: 100,
        },
        {
          type: 'fix',
          title: 'Configure proxy settings',
          description: 'Check and configure proxy settings if behind a corporate firewall',
          confidence: 0.6,
          priority: 80,
        },
        {
          type: 'workaround',
          title: 'Retry with exponential backoff',
          description: 'Implement retry logic with exponential backoff for network requests',
          confidence: 0.7,
          priority: 70,
        },
      ],
    });

    // Configuration error rule
    this.addRule({
      id: 'config-error',
      name: 'Configuration Error',
      description: 'Suggests solutions for configuration-related errors',
      priority: 85,
      enabled: true,
      matcher: (error, _context) =>
        error.category === 'validation' && error.code.includes('CONFIGURATION'),
      generator: (_error, _context) => [
        {
          type: 'fix',
          title: 'Validate configuration syntax',
          description: 'Check configuration file for syntax errors',
          confidence: 0.9,
          priority: 110,
          action: {
            type: 'command',
            payload: 'zern config validate',
          },
        },
        {
          type: 'fix',
          title: 'Reset to default configuration',
          description: 'Reset configuration to default values',
          confidence: 0.7,
          priority: 80,
          action: {
            type: 'command',
            payload: 'zern config reset',
          },
        },
        {
          type: 'documentation',
          title: 'Configuration reference',
          description: 'Review the configuration documentation',
          confidence: 0.8,
          priority: 90,
          action: {
            type: 'link',
            payload: 'https://docs.zern.dev/configuration',
          },
        },
      ],
    });
  }
}
