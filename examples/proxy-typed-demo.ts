/**
 * @file Proxy Typed Demo - Demonstrating typed ctx.plugins and ctx.store
 * @description Shows how to use the new typed proxy context with perfect autocomplete
 */

import { createKernel, plugin } from '../src';

// ============================================================================
// BASE PLUGINS WITH STORES
// ============================================================================

// Math plugin with typed store
const mathPlugin = plugin('math', '1.0.0')
  .store(() => ({
    callCount: 0,
    lastResult: 0,
  }))
  .setup(ctx => ({
    add: (a: number, b: number): number => {
      ctx.store.callCount++;
      const result = a + b;
      ctx.store.lastResult = result;
      console.log(`  [MATH] add(${a}, ${b}) = ${result}`);
      return result;
    },
    multiply: (a: number, b: number): number => {
      ctx.store.callCount++;
      const result = a * b;
      ctx.store.lastResult = result;
      console.log(`  [MATH] multiply(${a}, ${b}) = ${result}`);
      return result;
    },
  }));

// API plugin with typed store
const apiPlugin = plugin('api', '1.0.0')
  .store(() => ({
    requestCount: 0,
    cache: new Map<number, { id: number; name: string }>(),
  }))
  .setup(ctx => ({
    getUser: (id: number): { id: number; name: string } => {
      ctx.store.requestCount++;
      console.log(`  [API] getUser(${id})`);

      // Check cache
      if (ctx.store.cache.has(id)) {
        console.log(`  [API] Returning cached user ${id}`);
        return ctx.store.cache.get(id)!;
      }

      const user = { id, name: `User ${id}` };
      ctx.store.cache.set(id, user);
      return user;
    },
    createUser: (name: string): { id: number; name: string } => {
      ctx.store.requestCount++;
      const user = { id: Math.floor(Math.random() * 1000), name };
      console.log(`  [API] createUser(${name}) = ${user.id}`);
      ctx.store.cache.set(user.id, user);
      return user;
    },
  }));

// ============================================================================
// CASE 1: Single Plugin Proxy - Perfect typing for ctx.store and ctx.plugins
// ============================================================================

const mathLoggerPlugin = plugin('math-logger', '1.0.0')
  .depends(mathPlugin, '^1.0.0') // ✅ Required for proxy!
  .proxy(mathPlugin, {
    before: ctx => {
      // ✅ ctx.store is TYPED as mathPlugin's store!
      console.log(`  📊 [MATH-LOGGER] Call count before: ${ctx.store.callCount}`);
      console.log(`  📊 [MATH-LOGGER] Last result: ${ctx.store.lastResult}`);

      // ✅ ctx.plugins.math is TYPED as mathPlugin's API!
      // You can call methods with full autocomplete
      if (ctx.method === 'multiply') {
        const [a, b] = ctx.args;
        console.log(`  📊 [MATH-LOGGER] Multiplying ${a} × ${b}`);

        // Can even call other methods on the plugin!
        // const sum = ctx.plugins.math.add(a as number, b as number);
        // console.log(`  📊 [MATH-LOGGER] Their sum would be ${sum}`);
      }
    },
    after: (result, ctx) => {
      // ✅ Store autocomplete works here too!
      console.log(`  📊 [MATH-LOGGER] Call count after: ${ctx.store.callCount}`);
      return result;
    },
  })
  .setup(() => ({}));

// ============================================================================
// CASE 2: Wildcard '*' Proxy - Typed access to ALL dependencies
// ============================================================================

const monitoringPlugin = plugin('monitoring', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .depends(apiPlugin, '^1.0.0')
  .proxy('*', {
    // ✅ ctx.plugins has BOTH math and api with full typing!
    before: ctx => {
      console.log(`  🔍 [MONITORING] ${ctx.pluginName}.${ctx.method}() called`);

      // ✅ You can access both plugins with autocomplete
      // ctx.plugins.math.add(1, 2);
      // ctx.plugins.api.getUser(123);

      // ⚠️ ctx.store is union type - could be math's store OR api's store
      // Only access properties that exist in BOTH stores
      // In this case, both have different stores, so ctx.store is 'any'
    },
    after: (result, ctx) => {
      console.log(`  🔍 [MONITORING] ${ctx.pluginName}.${ctx.method}() completed`);

      // You can inspect which plugin was called
      if (ctx.pluginName === 'math') {
        // Here TypeScript knows it's math plugin
        console.log(`  🔍 [MONITORING] Math operation result: ${result}`);
      } else if (ctx.pluginName === 'api') {
        // Here TypeScript knows it's api plugin
        console.log(`  🔍 [MONITORING] API operation completed`);
      }

      return result;
    },
  })
  .setup(() => ({}));

// ============================================================================
// CASE 3: Self Proxy - Access your own store and plugin
// ============================================================================

const smartMathPlugin = plugin('smart-math', '1.0.0')
  .store(() => ({
    optimizationCount: 0,
  }))
  .proxy({
    // Self-proxy: Intercept your own methods
    include: ['add'],
    before: ctx => {
      // ✅ ctx.store is YOUR store
      console.log(`  🧠 [SMART-MATH] Optimization count: ${ctx.store.optimizationCount}`);

      // ✅ ctx.plugins has your own plugin API
      const [a, b] = ctx.args;
      if (a === 0) {
        console.log(`  🧠 [SMART-MATH] Optimizing: 0 + ${b} = ${b}`);
        ctx.store.optimizationCount++;
        ctx.replace(b as number);
      } else if (b === 0) {
        console.log(`  🧠 [SMART-MATH] Optimizing: ${a} + 0 = ${a}`);
        ctx.store.optimizationCount++;
        ctx.replace(a as number);
      }
    },
  })
  .setup(() => ({
    add: (a: number, b: number): number => {
      console.log(`  [SMART-MATH] add(${a}, ${b})`);
      return a + b;
    },
  }));

// ============================================================================
// CASE 4: Accessing other plugins from proxy context
// ============================================================================

const validationPlugin = plugin('validation', '1.0.0')
  .depends(apiPlugin, '^1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .proxy(apiPlugin, {
    include: ['createUser'],
    before: ctx => {
      const [name] = ctx.args;
      console.log(`  ✅ [VALIDATION] Validating user creation: ${name}`);

      // ✅ You can access OTHER plugins to do validation!
      // For example, validate name length using math
      const nameLength = (name as string).length;
      if (nameLength < 3) {
        console.log(`  ❌ [VALIDATION] Name too short! Length: ${nameLength}`);
        throw new Error('Name must be at least 3 characters');
      }

      // You could even call math plugin to do calculations
      // const hashCode = ctx.plugins.math.multiply(nameLength, 31);
      console.log(`  ✅ [VALIDATION] Name is valid (length: ${nameLength})`);
    },
  })
  .setup(() => ({}));

// ============================================================================
// DEMO
// ============================================================================

async function main(): Promise<void> {
  console.log('🚀 Typed Proxy Demo - Perfect Autocomplete & Typing\n');

  const kernel = await createKernel()
    .use(mathPlugin)
    .use(apiPlugin)
    .use(mathLoggerPlugin) // Proxies mathPlugin with typed store
    .use(monitoringPlugin) // Proxies all dependencies
    .use(smartMathPlugin) // Self-proxy with optimizations
    .use(validationPlugin) // Proxy with cross-plugin access
    .start();

  console.log('✅ Kernel started\n');

  const math = kernel.get('math');
  const api = kernel.get('api');
  const smartMath = kernel.get('smart-math');

  // ============================================================================
  // TEST 1: Single plugin proxy with typed store access
  // ============================================================================

  console.log('─'.repeat(60));
  console.log('TEST 1: math.add() - mathLogger proxy with typed store');
  console.log('─'.repeat(60));
  console.log();

  math.add(5, 10);

  // ============================================================================
  // TEST 2: Wildcard proxy accessing multiple plugins
  // ============================================================================

  console.log('\n' + '─'.repeat(60));
  console.log('TEST 2: math.multiply() & api.getUser() - monitoring proxy');
  console.log('─'.repeat(60));
  console.log();

  math.multiply(3, 7);
  api.getUser(123);

  // ============================================================================
  // TEST 3: Self-proxy with optimization
  // ============================================================================

  console.log('\n' + '─'.repeat(60));
  console.log('TEST 3: smartMath.add() - self-proxy with optimization');
  console.log('─'.repeat(60));
  console.log();

  console.log('Normal addition:');
  smartMath.add(5, 3);

  console.log('\nOptimized addition (adding zero):');
  smartMath.add(0, 42);
  smartMath.add(99, 0);

  // ============================================================================
  // TEST 4: Cross-plugin access in proxy
  // ============================================================================

  console.log('\n' + '─'.repeat(60));
  console.log('TEST 4: api.createUser() - validation with cross-plugin');
  console.log('─'.repeat(60));
  console.log();

  console.log('Valid user:');
  api.createUser('John Doe');

  console.log('\nInvalid user (name too short):');
  try {
    await api.createUser('AB');
  } catch (error) {
    console.log(`  ❌ Error caught: ${(error as Error).message}`);
  }

  console.log('\n✨ Demo completed!\n');

  await kernel.shutdown();
}

main().catch(console.error);
