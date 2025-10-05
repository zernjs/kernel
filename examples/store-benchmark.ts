/**
 * @file Store Performance Benchmark
 * @description Comprehensive benchmarks for the optimized store system
 */

import { createStore } from '../src/store';
import type { StoreMetrics } from '../src/store/types';

// ============================================================================
// BENCHMARK UTILITIES
// ============================================================================

/**
 * Get current time in milliseconds (works in Node and Browser)
 */
function now(): number {
  if (typeof globalThis !== 'undefined' && 'performance' in globalThis) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).performance.now();
  }
  return Date.now();
}

interface BenchmarkResult {
  name: string;
  duration: number;
  opsPerSecond: number;
  metrics?: StoreMetrics;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${formatNumber(ms * 1000)}μs`;
  if (ms < 1000) return `${formatNumber(ms)}ms`;
  return `${formatNumber(ms / 1000)}s`;
}

async function benchmark(
  name: string,
  operations: number,
  fn: () => void | Promise<void>
): Promise<BenchmarkResult> {
  // Warm up
  for (let i = 0; i < Math.min(10, operations); i++) {
    await fn();
  }

  // Actual benchmark
  const start = now();
  for (let i = 0; i < operations; i++) {
    await fn();
  }
  const end = now();

  const duration = end - start;
  const opsPerSecond = (operations / duration) * 1000;

  return {
    name,
    duration,
    opsPerSecond,
  };
}

function printResult(result: BenchmarkResult): void {
  console.log(`  ✓ ${result.name}`);
  console.log(`    Duration: ${formatDuration(result.duration)}`);
  console.log(`    Ops/sec: ${formatNumber(result.opsPerSecond)}`);
  if (result.metrics) {
    console.log(`    Metrics:`);
    console.log(`      - Active watchers: ${result.metrics.activeWatchers}`);
    console.log(`      - Peak watchers: ${result.metrics.peakWatchers}`);
    console.log(`      - Total changes: ${result.metrics.totalChanges}`);
    console.log(`      - Computed values: ${result.metrics.computedValues}`);
    console.log(`      - Avg notification: ${formatDuration(result.metrics.avgNotificationTime)}`);
  }
  console.log();
}

// ============================================================================
// BENCHMARK 1: Deep Clone Performance
// ============================================================================

async function benchmarkDeepClone(): Promise<void> {
  console.log('🔬 BENCHMARK 1: Deep Clone Performance (Transactions)');
  console.log('━'.repeat(80));

  // Test with structured clone
  const structuredStore = createStore(
    { items: Array.from({ length: 10000 }, (_, i) => ({ id: i, data: `item-${i}` })) },
    { cloneStrategy: 'structured', enableMetrics: true }
  );

  const structuredResult = await benchmark('structuredClone (10K items)', 100, async () => {
    await structuredStore.transaction(async () => {
      structuredStore.items[0].data = 'updated';
    });
  });

  printResult({ ...structuredResult, metrics: structuredStore.getMetrics!() });

  // Test with manual clone
  const manualStore = createStore(
    { items: Array.from({ length: 10000 }, (_, i) => ({ id: i, data: `item-${i}` })) },
    { cloneStrategy: 'manual', enableMetrics: true }
  );

  const manualResult = await benchmark('manualClone (10K items)', 100, async () => {
    await manualStore.transaction(async () => {
      manualStore.items[0].data = 'updated';
    });
  });

  printResult({ ...manualResult, metrics: manualStore.getMetrics!() });

  console.log(
    `💡 Performance gain: ${formatNumber((manualResult.duration / structuredResult.duration) * 100 - 100)}%\n`
  );
}

// ============================================================================
// BENCHMARK 2: Watcher Scalability
// ============================================================================

async function benchmarkWatcherScalability(): Promise<void> {
  console.log('🔬 BENCHMARK 2: Watcher Scalability');
  console.log('━'.repeat(80));

  const watchers = [10, 50, 100, 500, 1000];

  for (const watcherCount of watchers) {
    const store = createStore({ count: 0 }, { enableMetrics: true, maxWatchers: 2000 });

    // Add watchers
    const unwatchers: (() => void)[] = [];
    for (let i = 0; i < watcherCount; i++) {
      const unwatch = store.watch('count', () => {
        // Simulate some work
        Math.random();
      });
      unwatchers.push(unwatch);
    }

    const result = await benchmark(`${watcherCount} watchers`, 1000, () => {
      store.count++;
    });

    printResult({ ...result, metrics: store.getMetrics!() });

    // Cleanup
    unwatchers.forEach(unwatch => unwatch());
  }
}

// ============================================================================
// BENCHMARK 3: Indexed vs Linear Watcher Lookup
// ============================================================================

async function benchmarkIndexedLookup(): Promise<void> {
  console.log('🔬 BENCHMARK 3: Indexed Watcher Lookup');
  console.log('━'.repeat(80));

  const store = createStore(
    {
      prop1: 0,
      prop2: 0,
      prop3: 0,
      prop4: 0,
      prop5: 0,
    },
    { enableMetrics: true, maxWatchers: 10000 }
  );

  // Add 1000 watchers distributed across different keys
  const unwatchers: (() => void)[] = [];
  const keys = ['prop1', 'prop2', 'prop3', 'prop4', 'prop5'] as const;

  for (let i = 0; i < 1000; i++) {
    const key = keys[i % keys.length];
    const unwatch = store.watch(key, () => {
      Math.random();
    });
    unwatchers.push(unwatch);
  }

  // Test individual key changes (should be O(k) not O(n))
  const result = await benchmark('Change specific key (indexed)', 10000, () => {
    store.prop1++; // Only triggers ~200 watchers, not all 1000
  });

  printResult({ ...result, metrics: store.getMetrics!() });

  // Cleanup
  unwatchers.forEach(unwatch => unwatch());
}

// ============================================================================
// BENCHMARK 4: Batch Operations
// ============================================================================

async function benchmarkBatchOperations(): Promise<void> {
  console.log('🔬 BENCHMARK 4: Batch Operations');
  console.log('━'.repeat(80));

  // Without batch
  const store1 = createStore({ a: 0, b: 0, c: 0, d: 0, e: 0 }, { enableMetrics: true });

  store1.watchAll(() => {
    Math.random();
  });

  const individualResult = await benchmark('Individual changes (no batch)', 1000, () => {
    store1.a++;
    store1.b++;
    store1.c++;
    store1.d++;
    store1.e++;
  });

  printResult({ ...individualResult, metrics: store1.getMetrics!() });

  // With batch
  const store2 = createStore({ a: 0, b: 0, c: 0, d: 0, e: 0 }, { enableMetrics: true });

  store2.watchBatch(() => {
    Math.random();
  });

  const batchResult = await benchmark('Batched changes', 1000, () => {
    store2.batch(() => {
      store2.a++;
      store2.b++;
      store2.c++;
      store2.d++;
      store2.e++;
    });
  });

  printResult({ ...batchResult, metrics: store2.getMetrics!() });

  console.log(
    `💡 Performance gain: ${formatNumber((individualResult.duration / batchResult.duration) * 100 - 100)}%\n`
  );
}

// ============================================================================
// BENCHMARK 5: Computed Values with Dependency Tracking
// ============================================================================

async function benchmarkComputedDependencies(): Promise<void> {
  console.log('🔬 BENCHMARK 5: Computed Values (Dependency Tracking)');
  console.log('━'.repeat(80));

  const store = createStore(
    {
      firstName: 'John',
      lastName: 'Doe',
      age: 30,
      email: 'john@example.com',
      irrelevantProp: 'test',
    },
    { enableMetrics: true }
  );

  // Computed value that only depends on firstName and lastName
  const fullName = store.computed(s => `${s.firstName} ${s.lastName}`);

  let computedCalls = 0;
  store.watch(fullName, () => {
    computedCalls++;
  });

  // Change irrelevant property (should NOT trigger computed)
  const result = await benchmark('Change unrelated property', 10000, () => {
    store.irrelevantProp = Math.random().toString();
  });

  console.log(`  Computed value was called: ${computedCalls} times (should be 0)`);
  console.log(`  ${computedCalls === 0 ? '✅' : '❌'} Dependency tracking working correctly\n`);

  printResult({ ...result, metrics: store.getMetrics!() });

  // Now change relevant property (should trigger computed)
  computedCalls = 0;
  const result2 = await benchmark('Change related property', 1000, () => {
    store.firstName = `John${Math.random()}`;
  });

  console.log(`  Computed value was called: ${computedCalls} times (should be ~1000)`);
  console.log(`  ${computedCalls > 900 ? '✅' : '❌'} Dependency tracking working correctly\n`);

  printResult({ ...result2, metrics: store.getMetrics!() });
}

// ============================================================================
// BENCHMARK 6: Circular Buffer History
// ============================================================================

async function benchmarkCircularBuffer(): Promise<void> {
  console.log('🔬 BENCHMARK 6: Circular Buffer History');
  console.log('━'.repeat(80));

  const store = createStore({ count: 0 }, { history: true, maxHistory: 1000, enableMetrics: true });

  const result = await benchmark('History with circular buffer (10K changes)', 10000, () => {
    store.count++;
  });

  const history = store.getHistory!();
  console.log(`  History size: ${history.length} (max: 1000)`);
  console.log(`  ${history.length === 1000 ? '✅' : '❌'} Circular buffer working correctly\n`);

  printResult({ ...result, metrics: store.getMetrics!() });
}

// ============================================================================
// BENCHMARK 7: Watcher Limits & Memory Leak Prevention
// ============================================================================

async function benchmarkWatcherLimits(): Promise<void> {
  console.log('🔬 BENCHMARK 7: Watcher Limits (Memory Leak Prevention)');
  console.log('━'.repeat(80));

  const store = createStore({ count: 0 }, { maxWatchers: 100, enableMetrics: true });

  let errorThrown = false;
  let watchersAdded = 0;

  try {
    for (let i = 0; i < 150; i++) {
      store.watch('count', () => {});
      watchersAdded++;
    }
  } catch (error) {
    errorThrown = true;
    const err = error as Error;
    console.log(`  ✅ Error thrown after ${watchersAdded} watchers:`);
    console.log(`     "${err.message}"\n`);
  }

  if (!errorThrown) {
    console.log(`  ❌ No error thrown - limit not enforced!\n`);
  }

  const metrics = store.getMetrics!();
  console.log(`  Final metrics:`);
  console.log(`    - Active watchers: ${metrics.activeWatchers}`);
  console.log(`    - Peak watchers: ${metrics.peakWatchers}\n`);
}

// ============================================================================
// BENCHMARK 8: Real-World Scenario
// ============================================================================

async function benchmarkRealWorldScenario(): Promise<void> {
  console.log('🔬 BENCHMARK 8: Real-World Scenario');
  console.log('━'.repeat(80));

  interface TodoItem {
    id: number;
    text: string;
    completed: boolean;
    priority: 'low' | 'medium' | 'high';
  }

  const store = createStore(
    {
      todos: [] as TodoItem[],
      filter: 'all' as 'all' | 'active' | 'completed',
      stats: { total: 0, active: 0, completed: 0 },
    },
    { enableMetrics: true }
  );

  // Computed values
  const filteredTodos = store.computed(s => {
    if (s.filter === 'all') return s.todos;
    if (s.filter === 'active') return s.todos.filter(t => !t.completed);
    return s.todos.filter(t => t.completed);
  });

  const highPriorityCount = store.computed(
    s => s.todos.filter(t => !t.completed && t.priority === 'high').length
  );

  // Watchers
  let updateCount = 0;
  store.watch(filteredTodos, () => {
    updateCount++;
  });

  store.watch(highPriorityCount, () => {
    updateCount++;
  });

  // Simulate real usage
  const result = await benchmark('Real-world todo app operations', 1000, () => {
    store.batch(() => {
      // Add todo
      const priorities = ['low', 'medium', 'high'] as const;
      store.todos.push({
        id: store.todos.length,
        text: `Todo ${store.todos.length}`,
        completed: false,
        priority: priorities[Math.floor(Math.random() * 3)],
      });

      // Update stats
      store.stats.total = store.todos.length;
      store.stats.active = store.todos.filter(t => !t.completed).length;
      store.stats.completed = store.todos.filter(t => t.completed).length;

      // Occasionally complete a todo
      if (store.todos.length > 0 && Math.random() > 0.7) {
        store.todos[Math.floor(Math.random() * store.todos.length)].completed = true;
      }
    });
  });

  console.log(`  Computed value updates: ${updateCount}`);
  console.log(`  Final todos: ${store.todos.length}\n`);

  printResult({ ...result, metrics: store.getMetrics!() });
}

// ============================================================================
// RUN ALL BENCHMARKS
// ============================================================================

async function main(): Promise<void> {
  console.log('\n');
  console.log('═'.repeat(80));
  console.log('  🚀 STORE PERFORMANCE BENCHMARK SUITE');
  console.log('═'.repeat(80));
  console.log('\n');

  try {
    await benchmarkDeepClone();
    await benchmarkWatcherScalability();
    await benchmarkIndexedLookup();
    await benchmarkBatchOperations();
    await benchmarkComputedDependencies();
    await benchmarkCircularBuffer();
    await benchmarkWatcherLimits();
    await benchmarkRealWorldScenario();

    console.log('═'.repeat(80));
    console.log('  ✅ ALL BENCHMARKS COMPLETED SUCCESSFULLY');
    console.log('═'.repeat(80));
    console.log('\n');
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Run benchmarks
main().catch(console.error);
