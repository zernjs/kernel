# Store System

## Overview

The Store System provides **reactive state management** for plugins with automatic change tracking, computed values, transactions, and powerful watching capabilities. Stores are **automatically reactive** by default, eliminating the need for manual setup.

## Key Features

- **Automatic Reactivity** - No manual setup required
- **Change Tracking** - Watch individual keys or all changes
- **Batch Updates** - Group multiple changes into single notifications
- **Transactions** - Automatic commit/rollback on error
- **Computed Values** - Memoized derived state
- **Type Safety** - Full TypeScript support with inference
- **History** - Optional time-travel debugging (opt-in)

---

## Basic Usage

### Creating a Store

Stores are created using the `.store()` method in the plugin builder. The store is **automatically reactive** - no need for `createStore()` or similar helpers.

```typescript
const counterPlugin = plugin('counter', '1.0.0')
  .store(() => ({
    count: 0,
    lastUpdate: new Date(),
    history: [] as number[],
  }))
  .setup(({ store }) => ({
    increment() {
      store.count++;
      store.lastUpdate = new Date();
      store.history.push(store.count);
    },
    getCount() {
      return store.count;
    },
  }));
```

### Accessing Store in Lifecycle Hooks

The store is available in all lifecycle hooks with full type safety:

```typescript
const myPlugin = plugin('myPlugin', '1.0.0')
  .store(() => ({
    initialized: false,
    connections: 0,
    errors: [] as Error[],
  }))
  .onInit(({ store }) => {
    store.initialized = true;
    console.log('Plugin initialized');
  })
  .onReady(({ store, api }) => {
    store.connections = api.getConnectionCount();
  })
  .onError((error, { store }) => {
    store.errors.push(error);
  })
  .setup(({ store }) => ({
    getStatus() {
      return {
        initialized: store.initialized,
        connections: store.connections,
        errorCount: store.errors.length,
      };
    },
  }));
```

---

## Watching Changes

### Watch Specific Keys

Monitor changes to specific properties:

```typescript
const userPlugin = plugin('user', '1.0.0')
  .store(() => ({
    name: '',
    email: '',
    premium: false,
  }))
  .onInit(({ store }) => {
    // Watch a specific key
    store.watch('premium', change => {
      console.log(`Premium status changed: ${change.oldValue} → ${change.newValue}`);

      if (change.newValue) {
        console.log('🎉 User upgraded to premium!');
      }
    });

    // Watch multiple keys
    store.watch('name', change => {
      console.log(`Name updated: ${change.newValue}`);
    });

    store.watch('email', change => {
      console.log(`Email updated: ${change.newValue}`);
    });
  })
  .setup(({ store }) => ({
    updateProfile(data: { name?: string; email?: string; premium?: boolean }) {
      if (data.name) store.name = data.name;
      if (data.email) store.email = data.email;
      if (data.premium !== undefined) store.premium = data.premium;
    },
  }));
```

### Watch All Changes

Monitor all property changes in the store:

```typescript
const auditPlugin = plugin('audit', '1.0.0')
  .store(() => ({
    entries: [] as Array<{ action: string; timestamp: Date }>,
  }))
  .onInit(({ store }) => {
    // Watch ALL changes
    store.watchAll(change => {
      console.log(`[AUDIT] ${change.key} changed at ${change.timestamp}`);
      console.log(`  Old: ${JSON.stringify(change.oldValue)}`);
      console.log(`  New: ${JSON.stringify(change.newValue)}`);

      // Log to audit trail
      store.entries.push({
        action: `${change.key} modified`,
        timestamp: change.timestamp,
      });
    });
  });
```

### Unwatch

Remove watchers when no longer needed:

```typescript
.onInit(({ store }) => {
  // Create watcher
  const unwatch = store.watch('count', (change) => {
    console.log('Count changed:', change.newValue);

    // Stop watching after reaching 100
    if (change.newValue >= 100) {
      unwatch();
      console.log('Stopped watching count');
    }
  });

  // Or unwatch manually
  store.unwatch('count', callback);
})
```

---

## Batch Updates

Group multiple changes into a single notification to improve performance:

```typescript
const profilePlugin = plugin('profile', '1.0.0')
  .store(() => ({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    updatedAt: new Date(),
  }))
  .onInit(({ store }) => {
    // Watch individual changes (fires for each property)
    store.watchAll(change => {
      console.log(`Property "${change.key}" changed`);
    });

    // Watch batched changes (fires once for the batch)
    store.watchBatch(changes => {
      console.log(`Batch update: ${changes.length} properties changed`);
      changes.forEach(c => {
        console.log(`  - ${c.key}: ${c.oldValue} → ${c.newValue}`);
      });
    });
  })
  .setup(({ store }) => ({
    updateProfile(data: { firstName?: string; lastName?: string; email?: string; phone?: string }) {
      // ✅ Batch: multiple changes, single notification
      store.batch(() => {
        if (data.firstName) store.firstName = data.firstName;
        if (data.lastName) store.lastName = data.lastName;
        if (data.email) store.email = data.email;
        if (data.phone) store.phone = data.phone;
        store.updatedAt = new Date();
      });
      // All watchers notified once after batch completes
    },
  }));
```

**Benefits:**

- ✅ Reduces watcher calls
- ✅ Improves performance
- ✅ Guarantees atomic updates

---

## Computed Values

Create derived values that are automatically memoized and updated:

```typescript
const cachePlugin = plugin('cache', '1.0.0')
  .store(() => ({
    items: new Map<string, any>(),
    hits: 0,
    misses: 0,
  }))
  .onInit(({ store }) => {
    // Create computed value (memoized automatically)
    const hitRate = store.computed(s => {
      const total = s.hits + s.misses;
      return total > 0 ? (s.hits / total) * 100 : 0;
    });

    // Watch computed value changes
    store.watch(hitRate, rate => {
      console.log(`Cache hit rate: ${rate.toFixed(2)}%`);

      if (rate < 50) {
        console.log('⚠️ Warning: Low cache hit rate!');
      }
    });

    // Access computed value
    console.log(`Initial hit rate: ${hitRate.value}%`);
  })
  .setup(({ store }) => ({
    get(key: string) {
      if (store.items.has(key)) {
        store.hits++; // Triggers computed value recalculation
        return store.items.get(key);
      }
      store.misses++;
      return null;
    },

    getStats() {
      // Computed values are automatically recalculated when accessed
      const hitRate = store.computed(s => {
        const total = s.hits + s.misses;
        return total > 0 ? (s.hits / total) * 100 : 0;
      });

      return {
        hits: store.hits,
        misses: store.misses,
        hitRate: hitRate.value,
      };
    },
  }));
```

**Features:**

- ✅ Automatic memoization
- ✅ Only recalculates when dependencies change
- ✅ Can be watched like regular properties
- ✅ Type-safe with inference

---

## Transactions

Execute multiple changes with automatic rollback on error:

```typescript
const databasePlugin = plugin('database', '1.0.0')
  .store(() => ({
    connected: false,
    activeTransactions: 0,
    queries: [] as string[],
  }))
  .setup(({ store }) => ({
    async executeTransaction(queries: string[]) {
      console.log('Starting transaction...');

      try {
        // ✅ Transaction: commits on success, rollbacks on error
        await store.transaction(async () => {
          store.activeTransactions++;

          for (const query of queries) {
            // Simulate query execution
            await executeSQL(query);
            store.queries.push(query);
          }

          // If any query fails, ALL changes are rolled back
          if (queries.some(q => q.includes('ERROR'))) {
            throw new Error('Query failed!');
          }

          console.log('✅ Transaction committed');
        });
        // All changes persisted
      } catch (error) {
        console.log('❌ Transaction rolled back');
        // All changes reverted automatically
        throw error;
      }
    },
  }));
```

**Features:**

- ✅ Automatic rollback on error
- ✅ Supports async operations
- ✅ Preserves store consistency
- ✅ Works with watchers (only notified on commit)

---

## History & Time Travel (Opt-in)

Enable history tracking for debugging and audit trails:

```typescript
import { createStore } from '@zern/kernel';

// Enable history when creating store manually
const storeWithHistory = createStore({ count: 0, items: [] }, { history: true, maxHistory: 50 });

const historyPlugin = plugin('history', '1.0.0')
  .store(() => storeWithHistory)
  .setup(({ store }) => ({
    increment() {
      store.count++;
    },

    getHistory() {
      return store.getHistory?.();
    },

    undo() {
      store.undo?.();
    },

    reset() {
      store.reset?.();
    },
  }));
```

**History Methods:**

- `getHistory()` - Get all changes
- `clearHistory()` - Clear history
- `undo()` - Undo last change
- `reset()` - Reset to initial state

---

## Advanced Patterns

### Cross-Plugin Store Access

Plugins can access stores from other plugins they depend on:

```typescript
const analyticsPlugin = plugin('analytics', '1.0.0')
  .depends(cachePlugin, '^1.0.0')
  .depends(authPlugin, '^1.0.0')
  .store(() => ({
    events: [] as Array<{ type: string; data: any }>,
  }))
  .onInit(({ plugins, store }) => {
    // ❌ NOTE: plugins don't expose $store directly yet
    // This is a future enhancement with the event system
    // For now, store access is internal to each plugin
  });
```

### Store with Validation

Validate changes before applying them:

```typescript
const validatedPlugin = plugin('validated', '1.0.0')
  .store(() => ({
    age: 0,
    email: '',
  }))
  .onInit(({ store }) => {
    // Watch and validate
    store.watch('age', change => {
      if (change.newValue < 0) {
        console.error('Invalid age: cannot be negative');
        // Note: change already applied, this is just logging
        // For true validation, use transactions
      }
    });

    store.watch('email', change => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(change.newValue)) {
        console.error('Invalid email format');
      }
    });
  })
  .setup(({ store }) => ({
    async updateAge(age: number) {
      // Use transaction for validation
      await store.transaction(async () => {
        if (age < 0) {
          throw new Error('Age cannot be negative');
        }
        store.age = age;
      });
    },
  }));
```

### Store as State Machine

Use store for state machine implementation:

```typescript
type State = 'idle' | 'loading' | 'success' | 'error';

const stateMachinePlugin = plugin('stateMachine', '1.0.0')
  .store(() => ({
    state: 'idle' as State,
    data: null as any,
    error: null as Error | null,
  }))
  .onInit(({ store }) => {
    // Valid transitions
    const transitions: Record<State, State[]> = {
      idle: ['loading'],
      loading: ['success', 'error'],
      success: ['idle'],
      error: ['idle', 'loading'],
    };

    // Watch state transitions
    store.watch('state', change => {
      const valid = transitions[change.oldValue]?.includes(change.newValue);

      if (!valid) {
        console.error(`Invalid transition: ${change.oldValue} → ${change.newValue}`);
      } else {
        console.log(`State: ${change.oldValue} → ${change.newValue}`);
      }
    });
  })
  .setup(({ store }) => ({
    async loadData() {
      store.state = 'loading';

      try {
        const data = await fetchData();
        store.batch(() => {
          store.state = 'success';
          store.data = data;
          store.error = null;
        });
      } catch (error) {
        store.batch(() => {
          store.state = 'error';
          store.error = error as Error;
          store.data = null;
        });
      }
    },

    reset() {
      store.batch(() => {
        store.state = 'idle';
        store.data = null;
        store.error = null;
      });
    },
  }));
```

---

## API Reference

### Store Methods

#### `watch<K>(key: K, callback: WatchCallback<Store[K]>): () => void`

Watch a specific key for changes.

**Parameters:**

- `key` - Property key to watch
- `callback` - Function called when property changes

**Returns:** Unwatch function

**Example:**

```typescript
const unwatch = store.watch('count', change => {
  console.log(`Count: ${change.oldValue} → ${change.newValue}`);
});

// Later...
unwatch();
```

#### `watch<T>(computed: ComputedValue<T>, callback: (value: T) => void): () => void`

Watch a computed value for changes.

**Parameters:**

- `computed` - Computed value to watch
- `callback` - Function called when computed value changes

**Returns:** Unwatch function

#### `watchAll(callback: WatchAllCallback): () => void`

Watch all property changes in the store.

**Parameters:**

- `callback` - Function called for any property change

**Returns:** Unwatch function

#### `watchBatch(callback: WatchBatchCallback): () => void`

Watch batched changes (fires once per batch).

**Parameters:**

- `callback` - Function called with all changes from a batch

**Returns:** Unwatch function

#### `unwatch<K>(key: K, callback?: WatchCallback<Store[K]>): void`

Remove watcher(s) for a specific key.

**Parameters:**

- `key` - Property key to unwatch
- `callback` - Optional specific callback to remove (if not provided, removes all watchers for the key)

#### `batch(fn: () => void): void`

Group multiple changes into a single notification.

**Parameters:**

- `fn` - Function that performs multiple store updates

**Example:**

```typescript
store.batch(() => {
  store.count++;
  store.lastUpdate = new Date();
  store.items.push(store.count);
});
// All watchers notified once
```

#### `transaction<T>(fn: () => Promise<T>): Promise<T>`

Execute changes in a transaction (commit on success, rollback on error).

**Parameters:**

- `fn` - Async function that performs store updates

**Returns:** Promise with function result

**Example:**

```typescript
await store.transaction(async () => {
  store.count = 100;
  await saveToDatabase();
  // If error, count is rolled back
});
```

#### `computed<T>(selector: (store: Store) => T): ComputedValue<T>`

Create a memoized computed value.

**Parameters:**

- `selector` - Function that derives value from store

**Returns:** Computed value object with `value` property

**Example:**

```typescript
const total = store.computed(s => s.hits + s.misses);
console.log(total.value);
```

#### `select<T>(selector: (store: Store) => T): ComputedValue<T>`

Alias for `computed()`.

---

### Types

#### `StoreChange<T>`

```typescript
interface StoreChange<T = any> {
  key: string; // Property that changed
  oldValue: T; // Previous value
  newValue: T; // New value
  timestamp: Date; // When the change occurred
  metadata?: Record<string, any>; // Optional metadata
}
```

#### `WatchCallback<T>`

```typescript
type WatchCallback<T = any> = (change: StoreChange<T>) => void | Promise<void>;
```

#### `WatchAllCallback`

```typescript
type WatchAllCallback = (change: StoreChange) => void | Promise<void>;
```

#### `WatchBatchCallback`

```typescript
type WatchBatchCallback = (changes: readonly StoreChange[]) => void | Promise<void>;
```

#### `ComputedValue<T>`

```typescript
interface ComputedValue<T> {
  readonly value: T;
  readonly __computedId__: symbol;
}
```

#### `StoreOptions`

```typescript
interface StoreOptions {
  history?: boolean; // Enable history tracking
  maxHistory?: number; // Max history entries (default: 50)
  deep?: boolean; // Deep watching (future feature)
}
```

---

## Best Practices

### ✅ DO

**Use batch for multiple related changes:**

```typescript
store.batch(() => {
  store.firstName = 'John';
  store.lastName = 'Doe';
  store.email = 'john@example.com';
});
```

**Use transactions for critical operations:**

```typescript
await store.transaction(async () => {
  store.balance -= amount;
  await sendPayment(amount);
});
```

**Use computed for derived values:**

```typescript
const fullName = store.computed(s => `${s.firstName} ${s.lastName}`);
```

**Unwatch when no longer needed:**

```typescript
const unwatch = store.watch('count', callback);
// Later...
unwatch();
```

### ❌ DON'T

**Don't mutate store outside of batch in performance-critical code:**

```typescript
// ❌ Bad: triggers 3 watchers
store.count++;
store.items.push(1);
store.total++;

// ✅ Good: triggers 1 batch watcher
store.batch(() => {
  store.count++;
  store.items.push(1);
  store.total++;
});
```

**Don't forget error handling in transactions:**

```typescript
// ❌ Bad: error not handled
await store.transaction(async () => {
  await riskyOperation();
});

// ✅ Good: proper error handling
try {
  await store.transaction(async () => {
    await riskyOperation();
  });
} catch (error) {
  console.error('Transaction failed:', error);
}
```

**Don't access computed values inside their own selector:**

```typescript
// ❌ Bad: infinite recursion
const bad = store.computed(s => bad.value + 1);

// ✅ Good: compute from store properties
const good = store.computed(s => s.count + 1);
```

---

## Performance Tips

1. **Use batch updates** for multiple related changes
2. **Computed values** are memoized - use them for expensive calculations
3. **Unwatch** when watchers are no longer needed to prevent memory leaks
4. **Transactions** have overhead - use for critical operations only
5. **History** has memory cost - only enable when debugging

---

## Examples

See the following examples for complete demonstrations:

- `examples/store-demo.ts` - Comprehensive store features
- `examples/store-example.ts` - Store with lifecycle hooks
- `examples/proxy-complete-demo.ts` - Store with proxies

---

## Related Documentation

- [Plugin System](./03-plugin-system.md) - Plugin builder API
- [Lifecycle Hooks](./11-lifecycle-hooks.md) - Using store in hooks
- [Type System](./07-type-system.md) - Store type inference
- [API Reference](./09-api-reference.md) - Complete API docs
