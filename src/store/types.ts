/**
 * @file Store Types
 * @description Type definitions for the store system
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// CHANGE TRACKING
// ============================================================================

/**
 * Represents a change in the store
 */
export interface StoreChange<T = any> {
  /** Key that changed */
  key: string;
  /** Previous value */
  oldValue: T;
  /** New value */
  newValue: T;
  /** When the change occurred */
  timestamp: Date;
  /** Optional metadata about the change */
  metadata?: Record<string, any>;
}

/**
 * Callback for watching a specific key
 */
export type WatchCallback<T = any> = (change: StoreChange<T>) => void | Promise<void>;

/**
 * Callback for watching all changes
 */
export type WatchAllCallback = (change: StoreChange) => void | Promise<void>;

/**
 * Callback for watching batched changes
 */
export type WatchBatchCallback = (changes: readonly StoreChange[]) => void | Promise<void>;

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/**
 * A computed value derived from the store
 */
export interface ComputedValue<T> {
  /** Current computed value */
  readonly value: T;
  /** Unique identifier for this computed value */
  readonly __computedId__: symbol;
}

/**
 * Selector function for computed values
 */
export type ComputedSelector<TStore, TResult> = (store: TStore) => TResult;

// ============================================================================
// STORE API
// ============================================================================

/**
 * Clone strategy for transactions
 */
export type CloneStrategy = 'structured' | 'manual';

/**
 * Options for creating a store
 */
export interface StoreOptions {
  /** Enable change history tracking */
  history?: boolean;
  /** Maximum number of history entries to keep (default: 50) */
  maxHistory?: number;
  /** Enable deep watching for nested objects/arrays */
  deep?: boolean;
  /** Maximum number of watchers allowed (default: 1000) */
  maxWatchers?: number;
  /** Maximum number of watchers per key (default: 100) */
  maxWatchersPerKey?: number;
  /** Enable performance metrics collection (default: false) */
  enableMetrics?: boolean;
  /** Clone strategy for transactions (default: 'structured') */
  cloneStrategy?: CloneStrategy;
  /** Warn when high watcher count is reached (default: true) */
  warnOnHighWatcherCount?: boolean;
  /** Threshold for high watcher count warning (default: 100) */
  warnThreshold?: number;
}

/**
 * Internal watcher registration
 */
export interface Watcher {
  key: string | symbol; // symbol for computed values
  callback: WatchCallback | WatchBatchCallback;
  type: 'key' | 'all' | 'batch' | 'computed';
}

/**
 * Performance metrics for a store
 */
export interface StoreMetrics {
  /** Total number of changes tracked */
  totalChanges: number;
  /** Total number of active watchers */
  activeWatchers: number;
  /** Watchers grouped by type */
  watchersByType: {
    key: number;
    all: number;
    batch: number;
    computed: number;
  };
  /** Total number of computed values */
  computedValues: number;
  /** Number of history entries */
  historySize: number;
  /** Average notification time (ms) */
  avgNotificationTime: number;
  /** Peak watchers count */
  peakWatchers: number;
}

/**
 * Store methods (added to the store object)
 */
export interface StoreMethods<TStore extends Record<string, any>> {
  /**
   * Watch a specific key for changes
   * @param key - Key to watch
   * @param callback - Callback to invoke when the key changes
   * @returns Function to unwatch
   */
  watch<K extends keyof TStore>(key: K, callback: WatchCallback<TStore[K]>): () => void;

  /**
   * Watch a computed value for changes
   * @param computed - Computed value to watch
   * @param callback - Callback to invoke when computed value changes
   * @returns Function to unwatch
   */
  watch<T>(computed: ComputedValue<T>, callback: (value: T) => void | Promise<void>): () => void;

  /**
   * Watch all changes in the store
   * @param callback - Callback to invoke for any change
   * @returns Function to unwatch
   */
  watchAll(callback: WatchAllCallback): () => void;

  /**
   * Watch batched changes (receives all changes from a batch operation at once)
   * @param callback - Callback to invoke with all changes from a batch
   * @returns Function to unwatch
   */
  watchBatch(callback: WatchBatchCallback): () => void;

  /**
   * Unwatch a specific key
   * @param key - Key to stop watching
   * @param callback - Optional specific callback to remove
   */
  unwatch<K extends keyof TStore>(key: K, callback?: WatchCallback<TStore[K]>): void;

  /**
   * Batch multiple changes into a single notification
   * @param fn - Function that performs multiple changes
   */
  batch(fn: () => void): void;

  /**
   * Execute changes in a transaction (commit on success, rollback on error)
   * @param fn - Async function that performs changes
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * Create a computed value derived from the store
   * @param selector - Function to compute the value
   * @returns Computed value with memoization
   */
  computed<T>(selector: ComputedSelector<TStore, T>): ComputedValue<T>;

  /**
   * Create a selector (alias for computed)
   * @param selector - Function to compute the value
   * @returns Computed value with memoization
   */
  select<T>(selector: ComputedSelector<TStore, T>): ComputedValue<T>;

  /**
   * Get change history (if history is enabled)
   * @returns Array of all changes
   */
  getHistory?(): readonly StoreChange[];

  /**
   * Clear change history (if history is enabled)
   */
  clearHistory?(): void;

  /**
   * Undo last change (if history is enabled)
   */
  undo?(): void;

  /**
   * Redo last undone change (if history is enabled)
   */
  redo?(): void;

  /**
   * Reset store to initial state (if history is enabled)
   */
  reset?(): void;

  /**
   * Get performance metrics (if metrics are enabled)
   * @returns Current store metrics
   */
  getMetrics?(): StoreMetrics;

  /**
   * Clear all registered watchers (use with caution)
   * Useful for preventing memory leaks when cleaning up
   */
  clearWatchers(): void;

  // Internal properties (not for public use)
  readonly __store__: true;
  readonly __watchers__: Watcher[];
  readonly __computed__: Map<symbol, { selector: ComputedSelector<any, any>; cache: any }>;
}

/**
 * Store type - combines store data with store methods
 */
export type Store<TStore extends Record<string, any>> = TStore & StoreMethods<TStore>;
