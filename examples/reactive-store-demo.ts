/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Reactive Store Demo
 * @description Comprehensive demonstration of reactive store features
 */

import { plugin, createKernel } from '../src';

console.log('\n🎯 Reactive Store Demo\n');

// ============================================================================
// Example 1: Basic Reactivity with watch()
// ============================================================================

console.log('━'.repeat(60));
console.log('Example 1: Basic Reactivity');
console.log('━'.repeat(60));

const counterPlugin = plugin('counter', '1.0.0')
  // ✅ Store is automatically reactive!
  .store(() => ({
    count: 0,
    lastIncrement: new Date(),
  }))
  .onInit(({ store }) => {
    // ✅ Watch specific keys
    store.watch('count', change => {
      console.log(`  📊 Count changed: ${change.oldValue} → ${change.newValue}`);
    });

    store.watch('lastIncrement', change => {
      console.log(`  ⏰ Last increment: ${change.newValue.toLocaleTimeString()}`);
    });
  })
  .setup(({ store }) => ({
    increment(): void {
      store.count++;
      store.lastIncrement = new Date();
    },
    decrement(): void {
      store.count--;
    },
    getCount(): number {
      return store.count;
    },
  }));

// ============================================================================
// Example 2: Batch Updates
// ============================================================================

console.log('\n' + '━'.repeat(60));
console.log('Example 2: Batch Updates');
console.log('━'.repeat(60));

const userPlugin = plugin('user', '1.0.0')
  .store(() => ({
    name: '',
    age: 0,
    email: '',
    updatedAt: new Date(),
  }))
  .onInit(({ store }) => {
    // ✅ Watch individual changes
    store.watchAll(change => {
      console.log(`  🔔 Property "${change.key}" changed`);
    });

    // ✅ Watch batched changes (fires once for multiple updates)
    store.watchBatch(changes => {
      console.log(`  📦 Batch update: ${changes.length} properties changed`);
      changes.forEach(c => console.log(`     - ${c.key}: ${c.oldValue} → ${c.newValue}`));
    });
  })
  .setup(({ store }) => ({
    updateProfile(data: { name?: string; age?: number; email?: string }): void {
      // ✅ Batch: multiple changes, single notification
      store.batch(() => {
        if (data.name) store.name = data.name;
        if (data.age) store.age = data.age;
        if (data.email) store.email = data.email;
        store.updatedAt = new Date();
      });
    },
    getProfile(): { name: string; age: number; email: string } {
      return { name: store.name, age: store.age, email: store.email };
    },
  }));

// ============================================================================
// Example 3: Computed Values
// ============================================================================

console.log('\n' + '━'.repeat(60));
console.log('Example 3: Computed Values');
console.log('━'.repeat(60));

const cachePlugin = plugin('cache', '1.0.0')
  .store(() => ({
    items: new Map<string, any>(),
    hits: 0,
    misses: 0,
  }))
  .onInit(({ store }) => {
    // ✅ Computed value (memoized automatically)
    const hitRate = store.computed(s => {
      const total = s.hits + s.misses;
      return total > 0 ? (s.hits / total) * 100 : 0;
    });

    // ✅ Watch computed value
    store.watch(hitRate, rate => {
      console.log(`  📈 Cache hit rate: ${rate.toFixed(2)}%`);
      if (rate < 50) {
        console.log(`  ⚠️  Warning: Low cache hit rate!`);
      }
    });

    // ✅ Watch raw properties
    store.watch('hits', change => {
      console.log(`  ✅ Cache hits: ${change.newValue}`);
    });

    store.watch('misses', change => {
      console.log(`  ❌ Cache misses: ${change.newValue}`);
    });
  })
  .setup(({ store }) => ({
    get(key: string): any {
      if (store.items.has(key)) {
        store.hits++;
        return store.items.get(key);
      }
      store.misses++;
      return null;
    },
    set(key: string, value: any): void {
      store.items.set(key, value);
    },
    getStats(): { hits: number; misses: number; total: number } {
      return {
        hits: store.hits,
        misses: store.misses,
        total: store.hits + store.misses,
      };
    },
  }));

// ============================================================================
// Example 4: Transactions (commit/rollback)
// ============================================================================

console.log('\n' + '━'.repeat(60));
console.log('Example 4: Transactions');
console.log('━'.repeat(60));

const databasePlugin = plugin('database', '1.0.0')
  .store(() => ({
    connected: false,
    activeConnections: 0,
    queries: [] as string[],
  }))
  .onInit(({ store }) => {
    store.watchAll(change => {
      console.log(`  💾 DB: ${change.key} = ${change.newValue}`);
    });
  })
  .setup(({ store }) => ({
    async executeTransaction(sql: string): Promise<void> {
      console.log(`  🔄 Starting transaction...`);

      // ✅ Transaction: commits on success, rollbacks on error
      try {
        await store.transaction(async () => {
          store.activeConnections++;
          store.queries.push(sql);

          // Simulate error for demonstration
          if (sql.includes('ERROR')) {
            throw new Error('SQL Error!');
          }

          console.log(`  ✅ Transaction committed`);
        });
      } catch (error) {
        console.log(`  ❌ Transaction rolled back: ${(error as Error).message}`);
      }
    },
    getStats(): { connected: boolean; activeConnections: number; totalQueries: number } {
      return {
        connected: store.connected,
        activeConnections: store.activeConnections,
        totalQueries: store.queries.length,
      };
    },
  }));

// ============================================================================
// Example 5: History & Time Travel (opt-in)
// ============================================================================

console.log('\n' + '━'.repeat(60));
console.log('Example 5: History & Time Travel');
console.log('━'.repeat(60));

const authPlugin = plugin('auth', '1.0.0')
  .store(() => ({
    user: null as { id: string; name: string } | null,
    attempts: 0,
    state: 'idle' as 'idle' | 'authenticating' | 'authenticated',
  }))
  .onInit(() => {
    // Enable history (opt-in via manual configuration)
    // Note: In real implementation, this would be passed to createReactiveStore options
    console.log('  📜 History tracking enabled');
  })
  .setup(({ store }) => ({
    login(user: { id: string; name: string }): void {
      store.state = 'authenticating';
      store.user = user;
      store.state = 'authenticated';
      console.log(`  ✅ User logged in: ${user.name}`);
    },
    logout(): void {
      store.user = null;
      store.state = 'idle';
      console.log(`  👋 User logged out`);
    },
    incrementAttempts(): void {
      store.attempts++;
    },
    getState(): {
      user: { id: string; name: string } | null;
      attempts: number;
      state: 'idle' | 'authenticating' | 'authenticated';
    } {
      return {
        user: store.user,
        attempts: store.attempts,
        state: store.state,
      };
    },
  }));

// ============================================================================
// Run Demo
// ============================================================================

async function main(): Promise<void> {
  const kernel = await createKernel()
    .use(counterPlugin)
    .use(userPlugin)
    .use(cachePlugin)
    .use(databasePlugin)
    .use(authPlugin)
    .start();

  console.log('\n✅ Kernel started\n');

  const counter = kernel.get('counter');
  const user = kernel.get('user');
  const cache = kernel.get('cache');
  const db = kernel.get('database');
  const auth = kernel.get('auth');

  // ─────────────────────────────────────────────────────────────────────────
  // Test Example 1: Basic Reactivity
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n🧪 Testing Basic Reactivity:\n');

  counter.increment(); // Triggers 2 watchers (count + lastIncrement)
  counter.increment(); // Triggers 2 watchers again
  counter.decrement(); // Triggers 1 watcher (count)

  console.log(`\nFinal count: ${counter.getCount()}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Test Example 2: Batch Updates
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n🧪 Testing Batch Updates:\n');

  user.updateProfile({
    name: 'John Doe',
    age: 30,
    email: 'john@example.com',
  });

  console.log(`\nProfile:`, user.getProfile());

  // ─────────────────────────────────────────────────────────────────────────
  // Test Example 3: Computed Values
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n🧪 Testing Computed Values:\n');

  cache.set('user:1', { name: 'Alice' });
  cache.get('user:1'); // Hit
  cache.get('user:2'); // Miss
  cache.get('user:1'); // Hit
  cache.get('user:3'); // Miss

  console.log(`\nCache stats:`, cache.getStats());

  // ─────────────────────────────────────────────────────────────────────────
  // Test Example 4: Transactions
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n🧪 Testing Transactions:\n');

  await db.executeTransaction('SELECT * FROM users');
  console.log(`DB stats after success:`, db.getStats());

  await db.executeTransaction('SELECT ERROR FROM users');
  console.log(`DB stats after rollback:`, db.getStats());

  // ─────────────────────────────────────────────────────────────────────────
  // Test Example 5: History
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n🧪 Testing History & State:\n');

  auth.login({ id: '123', name: 'Alice' });
  console.log(`Auth state:`, auth.getState());

  auth.logout();
  console.log(`Auth state after logout:`, auth.getState());

  console.log('\n✨ Demo completed!\n');
}

main().catch(console.error);
