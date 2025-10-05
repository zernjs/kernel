/**
 * @file Store Implementation
 * @description Core store with watch, batch, transactions, and computed values
 */

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
} from './types';

// ============================================================================
// INTERNAL STATE
// ============================================================================

interface StoreState<TStore> {
  watchers: Watcher[];
  inBatch: boolean;
  batchChanges: StoreChange[];
  history: StoreChange[];
  maxHistory: number;
  historyEnabled: boolean;
  computed: Map<symbol, { selector: ComputedSelector<any, any>; cache: any; dirty: boolean }>;
  snapshot: TStore | null; // For transactions
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
    stateMap.set(store, {
      watchers: [],
      inBatch: false,
      batchChanges: [],
      history: [],
      maxHistory: 50,
      historyEnabled: false,
      computed: new Map(),
      snapshot: null,
    });
  }
  return stateMap.get(store)!;
}

/**
 * Deep clone an object (for snapshots)
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (obj instanceof Map) {
    return new Map(Array.from(obj.entries()).map(([k, v]) => [k, deepClone(v)])) as any;
  }

  if (obj instanceof Set) {
    return new Set(Array.from(obj).map(v => deepClone(v))) as any;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as any;
  }

  const cloned: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone((obj as any)[key]);
    }
  }
  return cloned;
}

/**
 * Compare two values for equality (shallow)
 */
function isEqual(a: any, b: any): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

/**
 * Notify watchers about a change
 */
async function notifyChange(store: any, change: StoreChange): Promise<void> {
  const state = getState(store);

  // Add to batch if we're in batch mode
  if (state.inBatch) {
    state.batchChanges.push(change);
    return;
  }

  // Add to history
  if (state.historyEnabled) {
    state.history.push(change);
    if (state.history.length > state.maxHistory) {
      state.history.shift();
    }
  }

  // Mark computed values as dirty
  for (const [, computed] of state.computed) {
    computed.dirty = true;
  }

  // Notify watchers
  const promises: Promise<void>[] = [];

  for (const watcher of state.watchers) {
    if (watcher.type === 'key' && watcher.key === change.key) {
      const result = (watcher.callback as WatchCallback)(change);
      if (result instanceof Promise) {
        promises.push(result);
      }
    } else if (watcher.type === 'all') {
      const result = (watcher.callback as WatchAllCallback)(change);
      if (result instanceof Promise) {
        promises.push(result);
      }
    }
  }

  await Promise.all(promises);
}

/**
 * Notify batch watchers
 */
async function notifyBatch(store: any, changes: readonly StoreChange[]): Promise<void> {
  if (changes.length === 0) return;

  const state = getState(store);
  const promises: Promise<void>[] = [];

  for (const watcher of state.watchers) {
    if (watcher.type === 'batch') {
      const result = (watcher.callback as WatchBatchCallback)(changes);
      if (result instanceof Promise) {
        promises.push(result);
      }
    }
  }

  await Promise.all(promises);
}

// ============================================================================
// STORE CREATION
// ============================================================================

/**
 * Create a store with automatic change tracking
 */
export function createStore<TStore extends Record<string, any>>(
  initialState: TStore,
  options: StoreOptions = {}
): Store<TStore> {
  // Initialize state
  const state: StoreState<TStore> = {
    watchers: [],
    inBatch: false,
    batchChanges: [],
    history: [],
    maxHistory: options.maxHistory ?? 50,
    historyEnabled: options.history ?? false,
    computed: new Map(),
    snapshot: null,
  };

  // Create proxy to intercept property access
  const proxy = new Proxy(initialState, {
    get(target: any, prop: string | symbol) {
      // API methods
      if (prop === 'watch') {
        return function watch(keyOrComputed: any, callback: any) {
          // Watch computed value
          if (
            typeof keyOrComputed === 'object' &&
            keyOrComputed !== null &&
            '__computedId__' in keyOrComputed
          ) {
            const computedId = keyOrComputed.__computedId__;
            state.watchers.push({
              key: computedId,
              callback: callback as WatchCallback,
              type: 'computed',
            });

            return () => {
              state.watchers = state.watchers.filter(
                w => !(w.type === 'computed' && w.key === computedId)
              );
            };
          }

          // Watch regular key
          state.watchers.push({
            key: keyOrComputed as string,
            callback: callback as WatchCallback,
            type: 'key',
          });

          return () => {
            state.watchers = state.watchers.filter(
              w => !(w.type === 'key' && w.key === keyOrComputed && w.callback === callback)
            );
          };
        };
      }

      if (prop === 'watchAll') {
        return function watchAll(callback: WatchAllCallback) {
          state.watchers.push({
            key: '*',
            callback: callback as any,
            type: 'all',
          });

          return () => {
            state.watchers = state.watchers.filter(
              w => !(w.type === 'all' && w.callback === callback)
            );
          };
        };
      }

      if (prop === 'watchBatch') {
        return function watchBatch(callback: WatchBatchCallback) {
          state.watchers.push({
            key: '*',
            callback: callback as any,
            type: 'batch',
          });

          return () => {
            state.watchers = state.watchers.filter(
              w => !(w.type === 'batch' && w.callback === callback)
            );
          };
        };
      }

      if (prop === 'unwatch') {
        return function unwatch(key: string, callback?: WatchCallback) {
          if (callback) {
            state.watchers = state.watchers.filter(
              w => !(w.type === 'key' && w.key === key && w.callback === callback)
            );
          } else {
            state.watchers = state.watchers.filter(!(w.type === 'key' && w.key === key));
          }
        };
      }

      if (prop === 'batch') {
        return function batch(fn: () => void) {
          state.inBatch = true;
          state.batchChanges = [];

          try {
            fn();
          } finally {
            state.inBatch = false;

            // Notify batch watchers
            if (state.batchChanges.length > 0) {
              const changes = [...state.batchChanges];
              state.batchChanges = [];

              // Add to history
              if (state.historyEnabled) {
                for (const change of changes) {
                  state.history.push(change);
                }
                while (state.history.length > state.maxHistory) {
                  state.history.shift();
                }
              }

              // Notify individual change watchers
              for (const change of changes) {
                for (const watcher of state.watchers) {
                  if (watcher.type === 'key' && watcher.key === change.key) {
                    (watcher.callback as WatchCallback)(change);
                  } else if (watcher.type === 'all') {
                    (watcher.callback as WatchAllCallback)(change);
                  }
                }
              }

              // Notify batch watchers
              notifyBatch(proxy, changes);
            }
          }
        };
      }

      if (prop === 'transaction') {
        return async function transaction<T>(fn: () => Promise<T>): Promise<T> {
          // Take snapshot
          state.snapshot = deepClone(target);

          try {
            const result = await fn();
            state.snapshot = null; // Commit
            return result;
          } catch (error) {
            // Rollback
            if (state.snapshot) {
              for (const key in state.snapshot) {
                (target as any)[key] = state.snapshot[key];
              }
              state.snapshot = null;
            }
            throw error;
          }
        };
      }

      if (prop === 'computed' || prop === 'select') {
        return function computed<T>(selector: ComputedSelector<TStore, T>): ComputedValue<T> {
          const computedId = Symbol('computed');

          // Create computed value object
          const computedValue: ComputedValue<T> = {
            get value() {
              const computedData = state.computed.get(computedId);
              if (!computedData) {
                // First access - compute and cache
                const value = selector(proxy as TStore);
                state.computed.set(computedId, { selector, cache: value, dirty: false });
                return value;
              }

              // Return cached value if not dirty
              if (!computedData.dirty) {
                return computedData.cache;
              }

              // Recompute if dirty
              const newValue = selector(proxy as TStore);
              const oldValue = computedData.cache;

              // Update cache
              computedData.cache = newValue;
              computedData.dirty = false;

              // Notify computed watchers if value changed
              if (!isEqual(oldValue, newValue)) {
                for (const watcher of state.watchers) {
                  if (watcher.type === 'computed' && watcher.key === computedId) {
                    (watcher.callback as any)(newValue);
                  }
                }
              }

              return newValue;
            },
            __computedId__: computedId,
          };

          return computedValue;
        };
      }

      // History methods
      if (state.historyEnabled) {
        if (prop === 'getHistory') {
          return () => [...state.history];
        }

        if (prop === 'clearHistory') {
          return () => {
            state.history = [];
          };
        }

        if (prop === 'undo') {
          return () => {
            if (state.history.length === 0) return;
            const lastChange = state.history[state.history.length - 1];
            (target as any)[lastChange.key] = lastChange.oldValue;
            state.history.pop();
          };
        }

        if (prop === 'reset') {
          return () => {
            if (state.history.length === 0) return;
            // Apply all changes in reverse
            for (let i = state.history.length - 1; i >= 0; i--) {
              const change = state.history[i];
              (target as any)[change.key] = change.oldValue;
            }
            state.history = [];
          };
        }
      }

      // Internal properties
      if (prop === '__store__') return true;
      if (prop === '__watchers__') return state.watchers;
      if (prop === '__computed__') return state.computed;

      // Normal property access
      return Reflect.get(target, prop);
    },

    set(target: any, prop: string | symbol, value: any) {
      // Don't trigger watchers for internal properties
      if (typeof prop === 'symbol' || prop.startsWith('__')) {
        return Reflect.set(target, prop, value);
      }

      const oldValue = target[prop];

      // Only notify if value actually changed
      if (isEqual(oldValue, value)) {
        return true;
      }

      // Update value
      const success = Reflect.set(target, prop, value);

      if (success) {
        // Create change event
        const change: StoreChange = {
          key: prop as string,
          oldValue,
          newValue: value,
          timestamp: new Date(),
        };

        // Notify watchers (async, but don't block)
        notifyChange(proxy, change);
      }

      return success;
    },
  });

  // Store state in WeakMap
  stateMap.set(proxy, state);

  return proxy as Store<TStore>;
}

/**
 * Check if an object is a store
 */
export function isStore(obj: any): obj is Store<any> {
  return obj && typeof obj === 'object' && obj.__store__ === true;
}
