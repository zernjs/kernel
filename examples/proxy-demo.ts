/**
 * @file Proxy Demo - Demonstrating the new .proxy() API
 * @description Shows how to intercept and modify plugin methods using the modern proxy API
 */

import { plugin, createKernel } from '../src';

// ============================================================================
// BASE API PLUGIN
// ============================================================================

interface APIInterface {
  createUser: (name: string) => Promise<{ id: number; name: string }>;
  deleteUser: (id: number) => Promise<boolean>;
  getUser: (id: number) => Promise<{ id: number; name: string } | null>;
  updateUser: (id: number, name: string) => Promise<{ id: number; name: string }>;
}

const apiPlugin = plugin('api', '1.0.0').setup(
  (): APIInterface => ({
    createUser: async (name: string): Promise<{ id: number; name: string }> => {
      console.log(`📝 Creating user: ${name}`);
      return { id: Math.floor(Math.random() * 1000), name };
    },

    deleteUser: async (id: number): Promise<boolean> => {
      console.log(`🗑️  Deleting user: ${id}`);
      return true;
    },

    getUser: async (id: number): Promise<{ id: number; name: string } | null> => {
      console.log(`🔍 Getting user: ${id}`);
      return { id, name: 'Test User' };
    },

    updateUser: async (id: number, name: string): Promise<{ id: number; name: string }> => {
      console.log(`✏️  Updating user ${id} to: ${name}`);
      return { id, name };
    },
  })
);

// ============================================================================
// TIMING PROXY - Measure execution time for all methods
// ============================================================================

const timingPlugin = plugin('timing', '1.0.0')
  .store(() => new Map<string, number>()) // Store to track start times
  .depends(apiPlugin, '^1.0.0') // ✅ Required for proxy!
  .proxy(apiPlugin, {
    before: ctx => {
      const key = `${ctx.pluginName}.${ctx.method}`;
      ctx.store.set(key, Date.now());
      console.log(`⏱️  [TIMING] Starting ${ctx.method}...`);
    },
    after: (result, ctx) => {
      const key = `${ctx.pluginName}.${ctx.method}`;
      const startTime = ctx.store.get(key);
      if (startTime) {
        const duration = Date.now() - startTime;
        console.log(`⏱️  [TIMING] ${ctx.method} took ${duration}ms`);
        ctx.store.delete(key);
      }
      return result;
    },
  })
  .setup(() => ({}));

// ============================================================================
// AUTH PROXY - Check permissions for sensitive operations
// ============================================================================

const authPlugin = plugin('auth', '1.0.0')
  .depends(apiPlugin, '^1.0.0') // ✅ Required for proxy!
  .proxy(apiPlugin, {
    // Only proxy destructive operations
    include: ['delete*', 'update*', 'create*'],
    priority: 100, // Execute FIRST (higher priority)
    before: ctx => {
      console.log(`🔐 [AUTH] Checking permissions for ${ctx.method}...`);

      // Simulate auth check
      const isAuthenticated = true; // Would check real auth here

      if (!isAuthenticated) {
        ctx.skip();
        throw new Error('Unauthorized');
      }

      console.log(`✅ [AUTH] Permission granted for ${ctx.method}`);
    },
  })
  .setup(() => ({}));

// ============================================================================
// LOGGING PROXY - Log all operations except internal ones
// ============================================================================

const loggingPlugin = plugin('logging', '1.0.0')
  .depends(apiPlugin, '^1.0.0') // ✅ Required for proxy!
  .proxy(apiPlugin, {
    exclude: ['*Internal'], // Exclude internal methods (if any)
    priority: 50, // Execute AFTER auth (lower priority)
    before: ctx => {
      console.log(`📋 [LOG] ${ctx.method} called with:`, ctx.args);
    },
    after: (result, ctx) => {
      console.log(`📋 [LOG] ${ctx.method} returned:`, result);
      return result;
    },
  })
  .setup(() => ({}));

// ============================================================================
// ERROR HANDLING PROXY - Gracefully handle errors
// ============================================================================

const errorPlugin = plugin('error-handler', '1.0.0')
  .depends(apiPlugin, '^1.0.0') // ✅ Required for proxy!
  .proxy(apiPlugin, {
    onError: (error, ctx) => {
      console.error(`❌ [ERROR] ${ctx.method} failed:`, error.message);

      // Return fallback value for read operations
      if (ctx.method.startsWith('get')) {
        return null;
      }

      // Re-throw for destructive operations
      throw error;
    },
  })
  .setup(() => ({}));

// ============================================================================
// CACHING PROXY - Cache read operations
// ============================================================================

const cache = new Map<string, unknown>();

const cachePlugin = plugin('cache', '1.0.0')
  .depends(apiPlugin, '^1.0.0') // ✅ Required for proxy!
  .proxy(apiPlugin, {
    include: ['get*'], // Only cache read operations
    priority: 90, // Execute early to short-circuit if cached
    around: async (ctx, next) => {
      const cacheKey = `${ctx.method}:${JSON.stringify(ctx.args)}`;

      // Check cache
      if (cache.has(cacheKey)) {
        console.log(`💾 [CACHE] Hit for ${ctx.method}`);
        return cache.get(cacheKey);
      }

      console.log(`💾 [CACHE] Miss for ${ctx.method}`);

      // Execute and cache
      const result = await next();
      cache.set(cacheKey, result);

      return result;
    },
  })
  .setup(() => ({}));

// ============================================================================
// DEMO
// ============================================================================

async function main(): Promise<void> {
  console.log('🚀 Starting Proxy Demo\n');

  // Start kernel with all proxy plugins
  const kernel = await createKernel()
    .use(apiPlugin)
    .use(authPlugin) // Priority 100 - executes first
    .use(cachePlugin) // Priority 90 - executes second
    .use(loggingPlugin) // Priority 50 - executes third
    .use(timingPlugin) // Default priority 50
    .use(errorPlugin)
    .start();

  console.log('\n✅ Kernel started\n');

  // Get API (without generic for now to avoid type issues)
  const api = kernel.get('api');

  console.log('─'.repeat(60));
  console.log('TEST 1: Creating a user');
  console.log('─'.repeat(60));

  const user = await api.createUser('John Doe');

  console.log('\n' + '─'.repeat(60));
  console.log('TEST 2: Getting a user (first call - cache miss)');
  console.log('─'.repeat(60));

  await api.getUser(user.id);

  console.log('\n' + '─'.repeat(60));
  console.log('TEST 3: Getting same user (second call - cache hit)');
  console.log('─'.repeat(60));

  await api.getUser(user.id);

  console.log('\n' + '─'.repeat(60));
  console.log('TEST 4: Updating a user');
  console.log('─'.repeat(60));

  await api.updateUser(user.id, 'Jane Doe');

  console.log('\n' + '─'.repeat(60));
  console.log('TEST 5: Deleting a user');
  console.log('─'.repeat(60));

  await api.deleteUser(user.id);

  console.log('\n✨ Demo completed!\n');

  // Shutdown
  await kernel.shutdown();
}

main().catch(console.error);
