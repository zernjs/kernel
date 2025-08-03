/**
 * @fileoverview Error collection and aggregation system
 * @module @zern/kernel/errors/core/error-collector
 */

import { EventEmitter } from 'events';
import type { ZernError, ErrorContext } from '../types/base.js';

export interface ErrorCollection {
  id: string;
  errors: CollectedError[];
  startTime: Date;
  endTime?: Date;
  context: ErrorContext;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface CollectedError {
  error: ZernError;
  context: ErrorContext;
  timestamp: Date;
  index: number;
}

export interface ErrorPattern {
  id: string;
  name: string;
  description: string;
  matcher: (error: ZernError, context: ErrorContext) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: string[];
}

export interface ErrorCollectorConfig {
  maxCollections: number;
  maxErrorsPerCollection: number;
  collectionTimeout: number;
  enablePatternDetection: boolean;
  enableAggregation: boolean;
  autoFlushInterval: number;
}

/**
 * Collects and aggregates errors for analysis and reporting
 */
export class ErrorCollector extends EventEmitter {
  private readonly config: ErrorCollectorConfig;
  private readonly collections = new Map<string, ErrorCollection>();
  private readonly patterns = new Map<string, ErrorPattern>();
  private readonly activeCollections = new Set<string>();
  private errorIndex = 0;
  private flushTimer?: ReturnType<typeof setInterval> | undefined;

  constructor(config: Partial<ErrorCollectorConfig> = {}) {
    super();

    // Set max listeners to prevent warnings in tests
    this.setMaxListeners(0); // 0 means unlimited

    this.config = {
      maxCollections: 100,
      maxErrorsPerCollection: 50,
      collectionTimeout: 30000, // 30 seconds
      enablePatternDetection: true,
      enableAggregation: true,
      autoFlushInterval: 60000, // 1 minute
      ...config,
    };

    this.setupDefaultPatterns();
    this.startAutoFlush();
  }

  /**
   * Collect an error
   */
  collect(error: ZernError, context: ErrorContext, collectionId?: string): string {
    const id = collectionId || this.generateCollectionId(error, context);
    const timestamp = new Date();

    // Get or create collection
    let collection = this.collections.get(id);
    if (!collection) {
      // Enforce max collections limit before adding new collection
      if (this.collections.size >= this.config.maxCollections) {
        this.enforceCollectionLimit();
      }

      collection = this.createCollection(id, context);
      this.collections.set(id, collection);
      this.activeCollections.add(id);
      this.emit('collectionStarted', collection);
    }

    // Add error to collection
    const collectedError: CollectedError = {
      error,
      context,
      timestamp,
      index: this.errorIndex++,
    };

    collection.errors.push(collectedError);

    // Check limits
    if (collection.errors.length >= this.config.maxErrorsPerCollection) {
      this.finalizeCollection(id);
    }

    // Detect patterns if enabled
    if (this.config.enablePatternDetection) {
      this.detectPatterns(collectedError, collection);
    }

    this.emit('errorCollected', { collectedError, collection });

    return id;
  }

  /**
   * Finalize a collection
   */
  finalizeCollection(collectionId: string): ErrorCollection | null {
    const collection = this.collections.get(collectionId);
    if (!collection) {
      return null;
    }

    collection.endTime = new Date();
    this.activeCollections.delete(collectionId);

    this.emit('collectionFinalized', collection);

    return collection;
  }

  /**
   * Get a collection by ID
   */
  getCollection(collectionId: string): ErrorCollection | null {
    return this.collections.get(collectionId) || null;
  }

  /**
   * Get all collections
   */
  getAllCollections(): ErrorCollection[] {
    return Array.from(this.collections.values());
  }

  /**
   * Get active collections
   */
  getActiveCollections(): ErrorCollection[] {
    return Array.from(this.activeCollections)
      .map(id => this.collections.get(id))
      .filter((collection): collection is ErrorCollection => collection !== undefined);
  }

  /**
   * Get collections by tag
   */
  getCollectionsByTag(tag: string): ErrorCollection[] {
    return this.getAllCollections().filter(collection => collection.tags.includes(tag));
  }

  /**
   * Get collections by error category
   */
  getCollectionsByCategory(category: string): ErrorCollection[] {
    return this.getAllCollections().filter(collection =>
      collection.errors.some(error => error.error.category === category)
    );
  }

  /**
   * Get collections by time range
   */
  getCollectionsByTimeRange(startTime: Date, endTime: Date): ErrorCollection[] {
    return this.getAllCollections().filter(collection => {
      const collectionEnd = collection.endTime || new Date();
      // Collection overlaps with time range if:
      // collection starts before range ends AND collection ends after range starts
      return collection.startTime <= endTime && collectionEnd >= startTime;
    });
  }

  /**
   * Add error pattern
   */
  addPattern(pattern: ErrorPattern): void {
    this.patterns.set(pattern.id, pattern);
    this.emit('patternAdded', pattern);
  }

  /**
   * Remove error pattern
   */
  removePattern(patternId: string): boolean {
    const removed = this.patterns.delete(patternId);
    if (removed) {
      this.emit('patternRemoved', patternId);
    }
    return removed;
  }

  /**
   * Get all patterns
   */
  getPatterns(): ErrorPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Aggregate errors by category
   */
  aggregateByCategory(): Record<string, CollectedError[]> {
    const aggregated: Record<string, CollectedError[]> = {};

    for (const collection of this.collections.values()) {
      for (const error of collection.errors) {
        const category = error.error.category;
        if (!aggregated[category]) {
          aggregated[category] = [];
        }
        aggregated[category]!.push(error);
      }
    }

    return aggregated;
  }

  /**
   * Aggregate errors by severity
   */
  aggregateBySeverity(): Record<string, CollectedError[]> {
    const aggregated: Record<string, CollectedError[]> = {};

    for (const collection of this.collections.values()) {
      for (const error of collection.errors) {
        const severity = error.error.severity;
        if (!aggregated[severity]) {
          aggregated[severity] = [];
        }
        aggregated[severity]!.push(error);
      }
    }

    return aggregated;
  }

  /**
   * Aggregate errors by time period
   */
  aggregateByTimePeriod(periodMs: number): Record<string, CollectedError[]> {
    const aggregated: Record<string, CollectedError[]> = {};

    for (const collection of this.collections.values()) {
      for (const error of collection.errors) {
        const periodStart = Math.floor(error.timestamp.getTime() / periodMs) * periodMs;
        const periodKey = new Date(periodStart).toISOString();

        if (!aggregated[periodKey]) {
          aggregated[periodKey] = [];
        }
        aggregated[periodKey]!.push(error);
      }
    }

    return aggregated;
  }

  /**
   * Get error statistics
   */
  getStatistics(): {
    totalCollections: number;
    activeCollections: number;
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    averageErrorsPerCollection: number;
    oldestCollection?: Date;
    newestCollection?: Date;
  } {
    const collections = this.getAllCollections();
    const totalErrors = collections.reduce((sum, collection) => sum + collection.errors.length, 0);

    const errorsByCategory: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    for (const collection of collections) {
      for (const error of collection.errors) {
        errorsByCategory[error.error.category] = (errorsByCategory[error.error.category] || 0) + 1;
        errorsBySeverity[error.error.severity] = (errorsBySeverity[error.error.severity] || 0) + 1;
      }
    }

    const dates = collections.map(c => c.startTime).sort((a, b) => a.getTime() - b.getTime());

    return {
      totalCollections: collections.length,
      activeCollections: this.activeCollections.size,
      totalErrors,
      errorsByCategory,
      errorsBySeverity,
      averageErrorsPerCollection: collections.length > 0 ? totalErrors / collections.length : 0,
      ...(dates.length > 0 && { oldestCollection: dates[0] }),
      ...(dates.length > 0 && { newestCollection: dates[dates.length - 1] }),
    };
  }

  /**
   * Clear all collections
   */
  clear(): void {
    this.collections.clear();
    this.activeCollections.clear();
    this.errorIndex = 0;
    this.emit('collectionsCleared');
  }

  /**
   * Enforce collection limit by removing oldest collections
   */
  private enforceCollectionLimit(): void {
    if (this.collections.size >= this.config.maxCollections) {
      const sortedCollections = Array.from(this.collections.entries()).sort(
        ([, a], [, b]) => a.startTime.getTime() - b.startTime.getTime()
      );

      const toRemove = sortedCollections.slice(
        0,
        this.collections.size - this.config.maxCollections + 1
      );

      for (const [id] of toRemove) {
        this.collections.delete(id);
        this.activeCollections.delete(id);
      }

      if (toRemove.length > 0) {
        this.emit(
          'collectionsRemoved',
          toRemove.map(([id]) => id)
        );
      }
    }
  }

  /**
   * Flush old collections
   */
  flush(): void {
    const now = new Date();
    const collectionsToRemove: string[] = [];

    for (const [id, collection] of this.collections) {
      // Remove collections that are older than timeout and not active
      if (!this.activeCollections.has(id)) {
        const age = now.getTime() - collection.startTime.getTime();
        if (age > this.config.collectionTimeout) {
          collectionsToRemove.push(id);
        }
      }
    }

    // Maintain max collections limit
    if (this.collections.size > this.config.maxCollections) {
      const sortedCollections = Array.from(this.collections.entries()).sort(
        ([, a], [, b]) => a.startTime.getTime() - b.startTime.getTime()
      );

      const toRemove = sortedCollections.slice(
        0,
        this.collections.size - this.config.maxCollections
      );
      collectionsToRemove.push(...toRemove.map(([id]) => id));
    }

    for (const id of collectionsToRemove) {
      this.collections.delete(id);
      this.activeCollections.delete(id);
    }

    if (collectionsToRemove.length > 0) {
      this.emit('collectionsFlushed', collectionsToRemove);
    }
  }

  /**
   * Generate collection ID based on error and context
   */
  private generateCollectionId(error: ZernError, context: ErrorContext): string {
    // Group similar errors together
    const key = `${error.category}-${error.code}-${this.getContextKey(context)}`;
    return `collection-${key}-${Date.now()}`;
  }

  /**
   * Get context key for grouping
   */
  private getContextKey(context: ErrorContext): string {
    // Create a key based on relevant context properties
    const parts: string[] = [];

    if (context.pluginId) {
      parts.push(`plugin:${context.pluginId}`);
    }

    if (context.operation) {
      parts.push(`op:${context.operation}`);
    }

    if (context.userId) {
      parts.push(`user:${context.userId}`);
    }

    return parts.join('-') || 'default';
  }

  /**
   * Create a new collection
   */
  private createCollection(id: string, context: ErrorContext): ErrorCollection {
    return {
      id,
      errors: [],
      startTime: new Date(),
      context: { ...context },
      tags: this.generateTags(context),
      metadata: {},
    };
  }

  /**
   * Generate tags for a collection
   */
  private generateTags(context: ErrorContext): string[] {
    const tags: string[] = [];

    if (context.pluginId) {
      tags.push(`plugin:${context.pluginId}`);
    }

    if (context.operation) {
      tags.push(`operation:${context.operation}`);
    }

    if (context.userId) {
      tags.push('user-error');
    }

    return tags;
  }

  /**
   * Detect patterns in collected errors
   */
  private detectPatterns(error: CollectedError, collection: ErrorCollection): void {
    for (const pattern of this.patterns.values()) {
      if (pattern.matcher(error.error, error.context)) {
        this.emit('patternDetected', {
          pattern,
          error,
          collection,
        });
      }
    }
  }

  /**
   * Setup default error patterns
   */
  private setupDefaultPatterns(): void {
    if (!this.config.enablePatternDetection) {
      return;
    }

    // Rapid error pattern
    this.addPattern({
      id: 'rapid-errors',
      name: 'Rapid Error Occurrence',
      description: 'Multiple errors occurring in quick succession',
      matcher: (_error, _context) => {
        // This would be implemented with more sophisticated logic
        return false;
      },
      severity: 'high',
      actions: ['investigate-cause', 'enable-circuit-breaker'],
    });

    // Plugin initialization failure pattern
    this.addPattern({
      id: 'plugin-init-failures',
      name: 'Plugin Initialization Failures',
      description: 'Multiple plugin initialization failures',
      matcher: (error, context) => {
        return (
          error.category === 'plugin' &&
          error.code.includes('INITIALIZATION') &&
          context.pluginId !== undefined
        );
      },
      severity: 'critical',
      actions: ['check-plugin-dependencies', 'validate-plugin-config'],
    });

    // Memory pressure pattern
    this.addPattern({
      id: 'memory-pressure',
      name: 'Memory Pressure',
      description: 'Memory-related errors indicating system pressure',
      matcher: (error, _context) => {
        return error.category === 'kernel' && error.code.includes('MEMORY');
      },
      severity: 'critical',
      actions: ['garbage-collect', 'reduce-memory-usage', 'restart-kernel'],
    });
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    if (this.config.autoFlushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.autoFlushInterval);
    }
  }

  /**
   * Stop auto-flush timer
   */
  private stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAutoFlush();
    this.clear();
    this.removeAllListeners();
  }
}
