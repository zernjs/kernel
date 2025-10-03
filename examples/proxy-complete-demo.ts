/**
 * @file Complete Proxy Demo - All 4 proxy modes
 * @description Demonstrates self-proxy, single plugin proxy, dependencies proxy, and global proxy
 */

import { createKernel, plugin } from '../src';

// ============================================================================
// BASE PLUGINS
// ============================================================================

const mathPlugin = plugin('math', '1.0.0')
  .setup(() => ({
    add: (a: number, b: number): number => {
      console.log(`  [MATH] add(${a}, ${b})`);
      return a + b;
    },
    multiply: (a: number, b: number): number => {
      console.log(`  [MATH] multiply(${a}, ${b})`);
      return a * b;
    },
  }))
  // ✅ CASE 1: Self-proxy - proxy own methods
  .proxy({
    methods: 'add',
    before: ctx => {
      console.log(`  ✨ [SELF-PROXY] Intercepting my own method: ${ctx.method}`);
    },
  });

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
// CASE 2: Single Plugin Proxy
// ============================================================================

const loggingPlugin = plugin('logging', '1.0.0')
  .depends(mathPlugin, '^1.0.0') // ✅ Required!
  .proxy(mathPlugin, {
    // ✅ CASE 2: Proxy specific plugin (must be in depends)
    methods: 'multiply',
    before: ctx => {
      console.log(`  📋 [LOGGING] Proxying ${ctx.plugin}.${ctx.method}`);
    },
    after: (result, ctx) => {
      console.log(`  📋 [LOGGING] ${ctx.method} returned: ${result}`);
      return result;
    },
  })
  .setup(() => ({}));

// ============================================================================
// CASE 3: Dependencies Proxy
// ============================================================================

const timingPlugin = plugin('timing', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .depends(apiPlugin, '^1.0.0')
  .proxy('*', ctx => {
    // ✅ CASE 3: Proxy ALL dependencies (math + api)
    let startTime: number;

    return {
      before: (): void => {
        startTime = Date.now();
        console.log(`  ⏱️  [TIMING] Started ${ctx.plugin}.${ctx.method}`);
      },
      after: (result): unknown => {
        const duration = Date.now() - startTime;
        console.log(`  ⏱️  [TIMING] ${ctx.plugin}.${ctx.method} took ${duration}ms`);
        return result;
      },
    };
  })
  .setup(() => ({}));

// ============================================================================
// CASE 4: Global Proxy
// ============================================================================

const globalMonitorPlugin = plugin('global-monitor', '1.0.0')
  .proxy('**', {
    // ✅ CASE 4: Proxy ALL plugins in kernel (math, api, db, logging, timing)
    priority: 100, // Execute first
    before: ctx => {
      console.log(`  🌍 [GLOBAL] Monitoring ${ctx.plugin}.${ctx.method}()`);
    },
  })
  .setup(() => ({}));

// ============================================================================
// DEMO
// ============================================================================

async function main(): Promise<void> {
  console.log('🚀 Complete Proxy Demo - All 4 Modes\n');

  const kernel = await createKernel()
    .use(mathPlugin) // Has self-proxy
    .use(apiPlugin)
    .use(dbPlugin)
    .use(loggingPlugin) // Proxies mathPlugin
    .use(timingPlugin) // Proxies all dependencies (*)
    .use(globalMonitorPlugin) // Proxies all plugins (**)
    .start();

  console.log('✅ Kernel started\n');

  const math = kernel.get('math');
  const api = kernel.get('api');
  const db = kernel.get('db');

  // ============================================================================
  // TEST 1: math.add - Self-proxy + Global + Timing (from dependencies)
  // ============================================================================

  console.log('─'.repeat(60));
  console.log('TEST 1: math.add() - Self-proxy + Global + Timing');
  console.log('─'.repeat(60));
  console.log('Expected: Global → Timing → Self-proxy → Method');
  console.log();

  math.add(2, 3);

  // ============================================================================
  // TEST 2: math.multiply - Logging + Global + Timing
  // ============================================================================

  console.log('\n' + '─'.repeat(60));
  console.log('TEST 2: math.multiply() - Logging + Global + Timing');
  console.log('─'.repeat(60));
  console.log('Expected: Global → Timing → Logging → Method');
  console.log();

  math.multiply(4, 5);

  // ============================================================================
  // TEST 3: api.getUser - Global + Timing
  // ============================================================================

  console.log('\n' + '─'.repeat(60));
  console.log('TEST 3: api.getUser() - Global + Timing');
  console.log('─'.repeat(60));
  console.log('Expected: Global → Timing → Method');
  console.log();

  api.getUser(123);

  // ============================================================================
  // TEST 4: db.query - Global only
  // ============================================================================

  console.log('\n' + '─'.repeat(60));
  console.log('TEST 4: db.query() - Global only');
  console.log('─'.repeat(60));
  console.log('Expected: Global → Method');
  console.log();

  db.query('SELECT * FROM users');

  console.log('\n✨ Demo completed!\n');

  await kernel.shutdown();
}

main().catch(console.error);
