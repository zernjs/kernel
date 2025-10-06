/**
 * @file Kernel-Level Proxy Demo
 * @description Demonstrates using .proxy() directly on the kernel builder
 */

import { createKernel, plugin } from '../src';

// ============================================================================
// BASE PLUGINS
// ============================================================================

const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a: number, b: number): number => {
    console.log(`  [MATH] add(${a}, ${b})`);
    return a + b;
  },
  multiply: (a: number, b: number): number => {
    console.log(`  [MATH] multiply(${a}, ${b})`);
    return a * b;
  },
}));

const apiPlugin = plugin('api', '1.0.0').setup(() => ({
  getUser: (id: number): { id: number; name: string } => {
    console.log(`  [API] getUser(${id})`);
    return { id, name: 'Test User' };
  },
  createUser: (name: string): { id: number; name: string } => {
    console.log(`  [API] createUser(${name})`);
    return { id: Math.floor(Math.random() * 1000), name };
  },
}));

const dbPlugin = plugin('db', '1.0.0').setup(() => ({
  query: (sql: string): string => {
    console.log(`  [DB] query(${sql})`);
    return 'result';
  },
  connect: (): void => {
    console.log(`  [DB] connect()`);
  },
}));

// ============================================================================
// DEMO
// ============================================================================

async function main(): Promise<void> {
  console.log('🚀 Kernel-Level Proxy Demo\n');

  // ============================================================================
  // Kernel with single plugin proxy
  // ============================================================================

  console.log('─'.repeat(60));
  console.log('TEST 1: Single Plugin Proxy (kernel proxies mathPlugin)');
  console.log('─'.repeat(60));

  const kernel1 = await createKernel()
    .use(mathPlugin)
    .use(apiPlugin)
    .use(dbPlugin)
    // ✅ Kernel-level proxy for mathPlugin specifically
    .proxy(mathPlugin, {
      before: ctx => {
        console.log(`  🔧 [KERNEL-PROXY] Intercepting ${ctx.pluginName}.${ctx.method}`);
      },
      after: (result, ctx) => {
        console.log(`  🔧 [KERNEL-PROXY] ${ctx.method} returned: ${result}`);
        return result;
      },
    })
    .start();

  const math1 = kernel1.get('math');
  const api1 = kernel1.get('api');

  console.log('\nCalling math.add(2, 3):');
  math1.add(2, 3);

  console.log('\nCalling api.getUser(123):');
  api1.getUser(123);

  await kernel1.shutdown();

  // ============================================================================
  // Kernel with global proxy
  // ============================================================================

  console.log('\n' + '─'.repeat(60));
  console.log('TEST 2: Global Proxy (kernel proxies ALL plugins)');
  console.log('─'.repeat(60));

  const kernel2 = await createKernel()
    .use(mathPlugin)
    .use(apiPlugin)
    .use(dbPlugin)
    // ✅ Kernel-level global proxy for ALL plugins
    .proxy('**', {
      priority: 100,
      before: ctx => {
        console.log(`  🌍 [KERNEL-GLOBAL] ${ctx.pluginName}.${ctx.method}() called`);
      },
    })
    .start();

  const math2 = kernel2.get('math');
  const api2 = kernel2.get('api');
  const db2 = kernel2.get('db');

  console.log('\nCalling math.multiply(4, 5):');
  math2.multiply(4, 5);

  console.log('\nCalling api.createUser("John"):');
  api2.createUser('John');

  console.log('\nCalling db.query("SELECT *"):');
  db2.query('SELECT *');

  await kernel2.shutdown();

  // ============================================================================
  // Kernel with multiple proxies
  // ============================================================================

  console.log('\n' + '─'.repeat(60));
  console.log('TEST 3: Multiple Proxies (specific + global)');
  console.log('─'.repeat(60));

  // Simple timing map for kernel-level proxy
  const timings = new Map<string, number>();

  const kernel3 = await createKernel()
    .use(mathPlugin)
    .use(apiPlugin)
    .use(dbPlugin)
    // ✅ Global timing proxy (uses external Map)
    .proxy('**', {
      priority: 50,
      before: (ctx): void => {
        const key = `${ctx.pluginName}.${ctx.method}`;
        timings.set(key, Date.now());
        console.log(`  ⏱️  [TIMING] Started ${key}`);
      },
      after: (result, ctx): unknown => {
        const key = `${ctx.pluginName}.${ctx.method}`;
        const startTime = timings.get(key);
        if (startTime) {
          const duration = Date.now() - startTime;
          console.log(`  ⏱️  [TIMING] ${key} took ${duration}ms`);
          timings.delete(key);
        }
        return result;
      },
    })
    // ✅ Specific auth proxy for API only
    .proxy(apiPlugin, {
      priority: 100, // Execute before timing
      include: ['create*', 'update*', 'delete*'],
      before: ctx => {
        console.log(`  🔐 [AUTH] Checking permissions for ${ctx.method}...`);
      },
    })
    .start();

  const math3 = kernel3.get('math');
  const api3 = kernel3.get('api');

  console.log('\nCalling math.add(10, 20):');
  math3.add(10, 20);

  console.log('\nCalling api.createUser("Jane"):');
  api3.createUser('Jane');

  console.log('\nCalling api.getUser(456):');
  api3.getUser(456);

  await kernel3.shutdown();

  console.log('\n✨ All tests completed!\n');
}

main().catch(console.error);
