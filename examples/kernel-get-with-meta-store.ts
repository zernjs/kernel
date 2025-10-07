/**
 * Example: kernel.get() with $meta and $store access
 *
 * Demonstrates how kernel.get() now returns not just the API,
 * but also $meta and $store, just like the proxy system does.
 */

import { plugin, createKernel } from '@/index';

// ============================================================================
// 1. CREATE PLUGINS WITH METADATA AND STORE
// ============================================================================

const loggerPlugin = plugin('logger', '1.0.0')
  .metadata({
    author: 'Zern Team',
    category: 'logging',
    description: 'Comprehensive logging plugin',
  })
  .store(() => ({
    logCount: 0,
    errorCount: 0,
    logs: [] as string[],
  }))
  .setup(({ store }) => ({
    log: (message: string) => {
      store.logCount++;
      store.logs.push(`[LOG] ${message}`);
      console.log(`[LOG] ${message}`);
    },
    error: (message: string) => {
      store.errorCount++;
      store.logs.push(`[ERROR] ${message}`);
      console.error(`[ERROR] ${message}`);
    },
    getStats: () => ({
      totalLogs: store.logCount,
      totalErrors: store.errorCount,
    }),
  }));

const mathPlugin = plugin('math', '1.0.0')
  .metadata({
    author: 'Zern Team',
    category: 'utilities',
    precision: 'high',
  })
  .store(() => ({
    operationCount: 0,
    lastResult: 0,
    history: [] as Array<{ operation: string; result: number }>,
  }))
  .setup(({ store }) => ({
    add: (a: number, b: number) => {
      const result = a + b;
      store.operationCount++;
      store.lastResult = result;
      store.history.push({ operation: `${a} + ${b}`, result });
      return result;
    },
    multiply: (a: number, b: number) => {
      const result = a * b;
      store.operationCount++;
      store.lastResult = result;
      store.history.push({ operation: `${a} * ${b}`, result });
      return result;
    },
  }));

// ============================================================================
// 2. START KERNEL AND GET PLUGINS
// ============================================================================

async function main() {
  const kernel = await createKernel().use(loggerPlugin).use(mathPlugin).start();

  console.log('\n🚀 Kernel started!\n');

  // ============================================================================
  // 3. GET PLUGIN WITH $meta AND $store
  // ============================================================================

  // Get logger with full access
  const logger = kernel.get('logger');

  console.log('📋 Logger Plugin Access:');
  console.log(
    '  - API methods:',
    Object.keys(logger).filter(k => !k.startsWith('$'))
  );
  console.log('  - $meta.name:', logger.$meta.name);
  console.log('  - $meta.version:', logger.$meta.version);
  console.log('  - $meta.author:', logger.$meta.author);
  console.log('  - $meta.category:', logger.$meta.category);
  console.log('  - $store.logCount:', logger.$store.logCount);
  console.log('  - $store.errorCount:', logger.$store.errorCount);

  console.log('\n');

  // Get math with full access
  const math = kernel.get('math');

  console.log('🔢 Math Plugin Access:');
  console.log(
    '  - API methods:',
    Object.keys(math).filter(k => !k.startsWith('$'))
  );
  console.log('  - $meta.name:', math.$meta.name);
  console.log('  - $meta.version:', math.$meta.version);
  console.log('  - $meta.author:', math.$meta.author);
  console.log('  - $meta.precision:', math.$meta.precision);
  console.log('  - $store.operationCount:', math.$store.operationCount);
  console.log('  - $store.lastResult:', math.$store.lastResult);

  console.log('\n');

  // ============================================================================
  // 4. USE API METHODS
  // ============================================================================

  console.log('➕ Performing operations...\n');

  // Use math API
  const sum = math.add(10, 5);
  console.log(`  10 + 5 = ${sum}`);
  console.log(`  $store.operationCount: ${math.$store.operationCount}`);
  console.log(`  $store.lastResult: ${math.$store.lastResult}`);

  console.log('\n');

  const product = math.multiply(7, 3);
  console.log(`  7 * 3 = ${product}`);
  console.log(`  $store.operationCount: ${math.$store.operationCount}`);
  console.log(`  $store.lastResult: ${math.$store.lastResult}`);

  console.log('\n');

  // Use logger API
  logger.log('Starting calculations');
  logger.error('Division by zero prevented');

  console.log('\n📊 Logger Stats:');
  console.log('  - $store.logCount:', logger.$store.logCount);
  console.log('  - $store.errorCount:', logger.$store.errorCount);
  console.log('  - API getStats():', logger.getStats());

  console.log('\n');

  // ============================================================================
  // 5. WATCH STORE CHANGES
  // ============================================================================

  console.log('👁️  Setting up store watchers...\n');

  // Watch math store changes
  math.$store.watch('operationCount', change => {
    console.log(
      `  [WATCHER] Math operation count changed: ${change.oldValue} → ${change.newValue}`
    );
  });

  // Watch logger store changes
  logger.$store.watch('logCount', change => {
    console.log(`  [WATCHER] Log count changed: ${change.oldValue} → ${change.newValue}`);
  });

  // Trigger changes
  console.log('\n🔄 Triggering more operations...\n');
  math.add(100, 200);
  logger.log('Operation completed');

  console.log('\n');

  // ============================================================================
  // 6. DIRECT STORE MANIPULATION
  // ============================================================================

  console.log('🛠️  Direct store manipulation...\n');

  // You can modify the store directly
  math.$store.lastResult = 999;
  console.log(`  Set math.$store.lastResult = 999`);

  logger.$store.logs.push('[MANUAL] Direct store update');
  console.log(`  Pushed to logger.$store.logs`);

  console.log('\n📦 Final State:');
  console.log('  - math.$store.operationCount:', math.$store.operationCount);
  console.log('  - math.$store.lastResult:', math.$store.lastResult);
  console.log('  - math.$store.history:', math.$store.history);
  console.log('  - logger.$store.logCount:', logger.$store.logCount);
  console.log('  - logger.$store.logs.length:', logger.$store.logs.length);

  console.log('\n✅ All operations completed!\n');

  await kernel.shutdown();
}

main().catch(console.error);
