/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  Store,
  StoreOptions,
  StoreChange,
  WatchCallback,
  WatchAllCallback,
  WatchBatchCallback,
  ComputedValue,
  ComputedSelector,
  Watcher,
  StoreMetrics,
} from './types';

// ============================================================================
// CIRCULAR BUFFER (O(1) operations)
// ============================================================================

class CircularBuffer<T> {
  private buffer: T[];
  private head = 0;
  private tail = 0;
  private size = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      result.push(this.buffer[(this.head + i) % this.capacity]);
    }
    return result;
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  get length(): number {
    return this.size;
  }
}

// ============================================================================
// INTERNAL STATE
// ============================================================================

interface ComputedState {
  selector: ComputedSelector<any, any>;
  cache: any;
  dirty: boolean;
  dependencies: Set<string>;
}

interface StoreState<TStore> {
  watchersByKey: Map<string, Set<Watcher>>;
  allWatchers: Set<Watcher>;
  batchWatchers: Set<Watcher>;
  computedWatchers: Map<symbol, Set<Watcher>>;

  inBatch: boolean;
  batchChanges: StoreChange[];
  history: CircularBuffer<StoreChange>;
  historyEnabled: boolean;
  computed: Map<symbol, ComputedState>;
  snapshot: TStore | null;

  options: Required<StoreOptions>;

  metrics: {
    totalChanges: number;
    peakWatchers: number;
    notificationTimes: number[];
  };
}

const stateMap = new WeakMap<any, StoreState<any>>();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get or create internal state for a store
 */
function getState<TStore>(store: any): StoreState<TStore> {
  if (!stateMap.has(store)) {
    const options = (store as any).__options__ || {};

    stateMap.set(store, {
      watchersByKey: new Map(),
      allWatchers: new Set(),
      batchWatchers: new Set(),
      computedWatchers: new Map(),
      inBatch: false,
      batchChanges: [],
      history: new CircularBuffer(options.maxHistory ?? 50),
      historyEnabled: options.history ?? false,
      computed: new Map(),
      snapshot: null,
      options: {
        history: options.history ?? false,
        maxHistory: options.maxHistory ?? 50,
        deep: options.deep ?? false,
        maxWatchers: options.maxWatchers ?? 1000,
        maxWatchersPerKey: options.maxWatchersPerKey ?? 100,
        enableMetrics: options.enableMetrics ?? false,
        cloneStrategy: options.cloneStrategy ?? 'structured',
        warnOnHighWatcherCount: options.warnOnHighWatcherCount ?? true,
        warnThreshold: options.warnThreshold ?? 100,
      },
      metrics: {
        totalChanges: 0,
        peakWatchers: 0,
        notificationTimes: [],
      },
    });
  }
  return stateMap.get(store)!;
}

/**
 * Deep clone with structuredClone fallback
 */
function fastClone<T>(obj: T, strategy: 'structured' | 'manual'): T {
  if (
    strategy === 'structured' &&
    typeof globalThis !== 'undefined' &&
    'structuredClone' in globalThis
  ) {
    try {
      return (globalThis as any).structuredClone(obj);
    } catch {
      return manualClone(obj);
    }
  }
  return manualClone(obj);
}

/**
 * Manual deep clone (fallback)
 */
function manualClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (obj instanceof Map) {
    return new Map(Array.from(obj.entries()).map(([k, v]) => [k, manualClone(v)])) as any;
  }

  if (obj instanceof Set) {
    return new Set(Array.from(obj).map(v => manualClone(v))) as any;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => manualClone(item)) as any;
  }

  const cloned: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = manualClone((obj as any)[key]);
    }
  }
  return cloned;
}

/**
 * Compare two values for equality
 */
function isEqual(a: any, b: any): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

/**
 * Get total watcher count
 */
function getTotalWatcherCount(state: StoreState<any>): number {
  let total = state.allWatchers.size + state.batchWatchers.size;
  for (const watchers of state.watchersByKey.values()) {
    total += watchers.size;
  }
  for (const watchers of state.computedWatchers.values()) {
    total += watchers.size;
  }
  return total;
}

/**
 * Add watcher with limit checking
 */
function addWatcher(state: StoreState<any>, watcher: Watcher): void {
  const currentTotal = getTotalWatcherCount(state);

  // Check global limit
  if (currentTotal >= state.options.maxWatchers) {
    throw new Error(
      `Maximum watchers limit reached (${state.options.maxWatchers}). ` +
        `This may indicate a memory leak. Remove unused watchers with unwatch().`
    );
  }

  if (currentTotal + 1 > state.metrics.peakWatchers) {
    state.metrics.peakWatchers = currentTotal + 1;
  }

  if (watcher.type === 'all') {
    state.allWatchers.add(watcher);
  } else if (watcher.type === 'batch') {
    state.batchWatchers.add(watcher);
  } else if (watcher.type === 'computed') {
    const symbol = watcher.key as symbol;
    if (!state.computedWatchers.has(symbol)) {
      state.computedWatchers.set(symbol, new Set());
    }
    state.computedWatchers.get(symbol)!.add(watcher);
  } else {
    const key = watcher.key as string;
    if (!state.watchersByKey.has(key)) {
      state.watchersByKey.set(key, new Set());
    }

    const keyWatchers = state.watchersByKey.get(key)!;

    if (keyWatchers.size >= state.options.maxWatchersPerKey) {
      if (state.options.warnOnHighWatcherCount) {
        console.warn(
          `High number of watchers for key "${key}" (${keyWatchers.size}). ` +
            `Consider using fewer watchers or batch operations.`
        );
      }
    }

    keyWatchers.add(watcher);
  }

  if (
    state.options.warnOnHighWatcherCount &&
    currentTotal > state.options.warnThreshold &&
    currentTotal % 100 === 0 // Only warn every 100 watchers
  ) {
    console.warn(
      `High total watcher count: ${currentTotal} watchers active. ` +
        `Consider removing unused watchers to improve performance.`
    );
  }
}

/**
 * Remove watcher
 */
function removeWatcher(state: StoreState<any>, watcher: Watcher): void {
  if (watcher.type === 'all') {
    state.allWatchers.delete(watcher);
  } else if (watcher.type === 'batch') {
    state.batchWatchers.delete(watcher);
  } else if (watcher.type === 'computed') {
    const watchers = state.computedWatchers.get(watcher.key as symbol);
    if (watchers) {
      watchers.delete(watcher);
      if (watchers.size === 0) {
        state.computedWatchers.delete(watcher.key as symbol);
      }
    }
  } else {
    const watchers = state.watchersByKey.get(watcher.key as string);
    if (watchers) {
      watchers.delete(watcher);
      if (watchers.size === 0) {
        state.watchersByKey.delete(watcher.key as string);
      }
    }
  }
}

/**
 * Get current time in milliseconds (works in Node and Browser)
 */
function now(): number {
  if (typeof globalThis !== 'undefined' && 'performance' in globalThis) {
    return (globalThis as any).performance.now();
  }
  return Date.now();
}

/**
 * Notify watchers about a change (optimized with indexing)
 */
async function notifyChange(store: any, change: StoreChange): Promise<void> {
  const state = getState(store);
  const startTime = state.options.enableMetrics ? now() : 0;

  if (state.inBatch) {
    state.batchChanges.push(change);
    return;
  }

  if (state.historyEnabled) {
    state.history.push(change);
  }

  if (state.options.enableMetrics) {
    state.metrics.totalChanges++;
  }

  for (const [, computed] of state.computed) {
    if (computed.dependencies.has(change.key)) {
      computed.dirty = true;
    }
  }

  const promises: Promise<void>[] = [];

  const keyWatchers = state.watchersByKey.get(change.key);
  if (keyWatchers) {
    for (const watcher of keyWatchers) {
      const result = (watcher.callback as WatchCallback)(change);
      if (result instanceof Promise) {
        promises.push(result);
      }
    }
  }

  for (const watcher of state.allWatchers) {
    const result = (watcher.callback as WatchAllCallback)(change);
    if (result instanceof Promise) {
      promises.push(result);
    }
  }

  await Promise.all(promises);

  if (state.options.enableMetrics) {
    const duration = now() - startTime;
    state.metrics.notificationTimes.push(duration);
    if (state.metrics.notificationTimes.length > 100) {
      state.metrics.notificationTimes.shift();
    }
  }
}

/**
 * Notify batch watchers
 */
async function notifyBatch(store: any, changes: readonly StoreChange[]): Promise<void> {
  if (changes.length === 0) return;

  const state = getState(store);
  const promises: Promise<void>[] = [];

  for (const watcher of state.batchWatchers) {
    const result = (watcher.callback as WatchBatchCallback)(changes);
    if (result instanceof Promise) {
      promises.push(result);
    }
  }

  await Promise.all(promises);
}

// ============================================================================
// COMPUTED VALUE TRACKING
// ============================================================================

/**
 * Track dependencies accessed during computed value evaluation
 */
function trackDependencies<TStore>(
  store: TStore,
  selector: ComputedSelector<TStore, any>
): Set<string> {
  const dependencies = new Set<string>();

  const tracker = new Proxy(store as any, {
    get(target, prop): any {
      if (typeof prop === 'string' && !prop.startsWith('__') && !prop.startsWith('$')) {
        dependencies.add(prop);
      }
      return target[prop];
    },
  });

  try {
    selector(tracker);
  } catch {
    /* empty */
  }

  return dependencies;
}

// ============================================================================
// STORE CREATION
// ============================================================================

/**
 * Creates a reactive store with automatic change tracking.
 *
 * @param initialState - Initial state object
 * @param options - Configuration options for the store
 * @returns A reactive store with methods for watching changes, computing values, and managing state
 *
 * @example
 * ```typescript
 * const store = createStore(
 *   { count: 0, name: '' },
 *   { history: true, enableMetrics: true }
 * );
 *
 * store.watch('count', change => {
 *   console.log(`Count changed: ${change.oldValue} → ${change.newValue}`);
 * });
 *
 * store.count++; // Triggers watcher
 * ```
 */
export function createStore<TStore extends Record<string, any>>(
  initialState: TStore,
  options: StoreOptions = {}
): Store<TStore> {
  (initialState as any).__options__ = options;
  const state = getState(initialState);

  const proxy = new Proxy(initialState, {
    get(target: any, prop: string | symbol): any {
      if (prop === 'watch') {
        return function watch(keyOrComputed: any, callback: any): () => void {
          if (
            typeof keyOrComputed === 'object' &&
            keyOrComputed !== null &&
            '__computedId__' in keyOrComputed
          ) {
            const computedId = keyOrComputed.__computedId__;
            const watcher: Watcher = {
              key: computedId,
              callback: callback as WatchCallback,
              type: 'computed',
            };

            addWatcher(state, watcher);

            return () => {
              removeWatcher(state, watcher);
            };
          }

          const watcher: Watcher = {
            key: keyOrComputed as string,
            callback: callback as WatchCallback,
            type: 'key',
          };

          addWatcher(state, watcher);

          return () => {
            removeWatcher(state, watcher);
          };
        };
      }

      if (prop === 'watchAll') {
        return function watchAll(callback: WatchAllCallback): () => void {
          const watcher: Watcher = {
            key: '*',
            callback: callback as any,
            type: 'all',
          };

          addWatcher(state, watcher);

          return () => {
            removeWatcher(state, watcher);
          };
        };
      }

      if (prop === 'watchBatch') {
        return function watchBatch(callback: WatchBatchCallback): () => void {
          const watcher: Watcher = {
            key: '*',
            callback: callback as any,
            type: 'batch',
          };

          addWatcher(state, watcher);

          return () => {
            removeWatcher(state, watcher);
          };
        };
      }

      if (prop === 'unwatch') {
        return function unwatch(key: string, callback?: WatchCallback): void {
          const watchers = state.watchersByKey.get(key);
          if (!watchers) return;

          if (callback) {
            for (const watcher of watchers) {
              if (watcher.callback === callback) {
                removeWatcher(state, watcher);
                break;
              }
            }
          } else {
            for (const watcher of Array.from(watchers)) {
              removeWatcher(state, watcher);
            }
          }
        };
      }

      if (prop === 'batch') {
        return function batch(fn: () => void): void {
          state.inBatch = true;
          state.batchChanges = [];

          try {
            fn();
          } finally {
            state.inBatch = false;
            const changes = state.batchChanges;
            state.batchChanges = [];

            void notifyBatch(proxy, changes);

            for (const change of changes) {
              void notifyChange(proxy, change);
            }
          }
        };
      }

      if (prop === 'transaction') {
        return async function transaction<T>(fn: () => Promise<T>): Promise<T> {
          state.snapshot = fastClone(target, state.options.cloneStrategy);

          try {
            const result = await fn();
            state.snapshot = null;
            return result;
          } catch (error) {
            if (state.snapshot) {
              for (const key in state.snapshot) {
                if (Object.prototype.hasOwnProperty.call(state.snapshot, key)) {
                  (target as any)[key] = (state.snapshot as any)[key];
                }
              }
              state.snapshot = null;
            }
            throw error;
          }
        };
      }

      if (prop === 'computed') {
        return function computed<T>(selector: ComputedSelector<TStore, T>): ComputedValue<T> {
          const computedId = Symbol('computed');

          const dependencies = trackDependencies(target as TStore, selector);

          state.computed.set(computedId, {
            selector,
            cache: undefined,
            dirty: true,
            dependencies,
          });

          return {
            get value(): T {
              const computedState = state.computed.get(computedId)!;

              if (computedState.dirty) {
                computedState.cache = selector(target as TStore);
                computedState.dirty = false;
              }

              return computedState.cache;
            },
            __computedId__: computedId,
          };
        };
      }

      if (prop === 'select') {
        return target.computed;
      }

      if (prop === 'getHistory') {
        return function getHistory(): readonly StoreChange[] {
          if (!state.historyEnabled) return [];
          return state.history.toArray();
        };
      }

      if (prop === 'clearHistory') {
        return function clearHistory(): void {
          if (state.historyEnabled) {
            state.history.clear();
          }
        };
      }

      if (prop === 'getMetrics') {
        return function getMetrics(): StoreMetrics {
          const watcherCounts = {
            key: 0,
            all: state.allWatchers.size,
            batch: state.batchWatchers.size,
            computed: 0,
          };

          for (const watchers of state.watchersByKey.values()) {
            watcherCounts.key += watchers.size;
          }

          for (const watchers of state.computedWatchers.values()) {
            watcherCounts.computed += watchers.size;
          }

          const avgTime =
            state.metrics.notificationTimes.length > 0
              ? state.metrics.notificationTimes.reduce((a, b) => a + b, 0) /
                state.metrics.notificationTimes.length
              : 0;

          return {
            totalChanges: state.metrics.totalChanges,
            activeWatchers: getTotalWatcherCount(state),
            watchersByType: watcherCounts,
            computedValues: state.computed.size,
            historySize: state.history.length,
            avgNotificationTime: avgTime,
            peakWatchers: state.metrics.peakWatchers,
          };
        };
      }

      if (prop === '__store__') return true;
      if (prop === '__watchers__') {
        const all: Watcher[] = [];
        all.push(...state.allWatchers);
        all.push(...state.batchWatchers);
        for (const watchers of state.watchersByKey.values()) {
          all.push(...watchers);
        }
        for (const watchers of state.computedWatchers.values()) {
          all.push(...watchers);
        }
        return all;
      }
      if (prop === '__computed__') return state.computed;

      return target[prop];
    },

    set(target: any, prop: string | symbol, value: any): boolean {
      if (typeof prop !== 'string') {
        target[prop] = value;
        return true;
      }

      const oldValue = target[prop];

      if (!isEqual(oldValue, value)) {
        target[prop] = value;

        const change: StoreChange = {
          key: prop,
          oldValue,
          newValue: value,
          timestamp: new Date(),
        };

        void notifyChange(proxy, change);
      }

      return true;
    },
  });

  return proxy as Store<TStore>;
}

/**
 * Check if an object is a store
 */
export function isStore(obj: any): obj is Store<any> {
  return obj && typeof obj === 'object' && '__store__' in obj && obj.__store__ === true;
}
