/**
 * @file Store Example
 * @description Demonstrates shared store across lifecycle/setup/proxy
 */

import { createKernel, plugin } from '../src';

// ============================================================================
// Example: Database Plugin with Shared Store
// ============================================================================

interface Connection {
  connected: boolean;
  queries: number;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string): Promise<unknown[]>;
}

const databasePlugin = plugin('database', '1.0.0')
  // ✅ Define shared store with automatic type inference
  .store(() => ({
    connection: null as Connection | null,
    metrics: {
      totalQueries: 0,
      errors: 0,
      startTime: 0,
    },
    config: {
      host: 'localhost',
      port: 5432,
    },
  }))
  // ✅ Access store in onInit (before setup)
  .onInit(async ({ pluginName, store }) => {
    console.log(`[${pluginName}] 🔄 Initializing...`);
    store.metrics.startTime = Date.now();

    // Create connection
    store.connection = {
      connected: false,
      queries: 0,
      async connect(): Promise<void> {
        console.log(`  📡 Connecting to ${store.config.host}:${store.config.port}...`);
        await new Promise(resolve => setTimeout(resolve, 100));
        this.connected = true;
        console.log('  ✅ Connected!');
      },
      async disconnect(): Promise<void> {
        console.log('  🔌 Disconnecting...');
        await new Promise(resolve => setTimeout(resolve, 50));
        this.connected = false;
        console.log('  ✅ Disconnected!');
      },
      async query(sql: string): Promise<unknown[]> {
        if (!this.connected) await this.connect();
        this.queries++;
        store.metrics.totalQueries++;
        console.log(`  🔍 Executing: ${sql}`);
        return [];
      },
    };

    await store.connection.connect();
  })
  // ✅ Access store in proxy
  .proxy({
    include: ['*'], // Proxy all methods
    before: ctx => {
      console.log(`  📊 Before ${ctx.method}()`);
      // ✅ Access store with full type safety!
      ctx.store.metrics.totalQueries++;
    },
    after: (result, ctx) => {
      console.log(`  ✅ After ${ctx.method}() - Total queries: ${ctx.store.metrics.totalQueries}`);
      return result;
    },
    onError: (error, ctx) => {
      console.log(`  ❌ Error in ${ctx.method}():`, error.message);
      // ✅ Track errors in store
      ctx.store.metrics.errors++;
      throw error;
    },
  })
  // ✅ Access store in setup
  .setup(({ store }) => ({
    query: async (sql: string): Promise<unknown[]> => {
      if (!store.connection) {
        throw new Error('Database not initialized');
      }
      return await store.connection.query(sql);
    },
    getMetrics: (): {
      totalQueries: number;
      errors: number;
      startTime: number;
      uptime: number;
    } => ({
      ...store.metrics,
      uptime: Date.now() - store.metrics.startTime,
    }),
  }))
  // ✅ Access store + API in onReady (after setup)
  .onReady(({ pluginName, store, api }) => {
    console.log(`[${pluginName}] ✅ Ready!`);
    console.log(`  Uptime: ${Date.now() - store.metrics.startTime}ms`);

    // ✅ Can call API methods!
    const metrics = api!.getMetrics();
    console.log(`  Metrics:`, metrics);
  })
  // ✅ Access store + API in onShutdown (after setup)
  .onShutdown(async ({ pluginName, store, api }) => {
    console.log(`[${pluginName}] 🛑 Shutting down...`);

    // ✅ Can call API methods before shutdown!
    const finalMetrics = api!.getMetrics();
    console.log(`  Final metrics:`, finalMetrics);

    if (store.connection) {
      await store.connection.disconnect();
    }
  });

// ============================================================================
// Example: Logger Plugin using Store
// ============================================================================

const loggerPlugin = plugin('logger', '1.0.0')
  .store(() => ({
    logs: [] as Array<{ level: string; message: string; timestamp: number }>,
    maxLogs: 100,
  }))
  .setup(({ store }) => ({
    log: (message: string): void => {
      const entry = { level: 'info', message, timestamp: Date.now() };
      store.logs.push(entry);

      // Keep only last N logs
      if (store.logs.length > store.maxLogs) {
        store.logs.shift();
      }

      console.log(`📝 ${message}`);
    },
    error: (message: string): void => {
      const entry = { level: 'error', message, timestamp: Date.now() };
      store.logs.push(entry);

      if (store.logs.length > store.maxLogs) {
        store.logs.shift();
      }

      console.error(`❌ ${message}`);
    },
    getLogs: (): Array<{ level: string; message: string; timestamp: number }> => store.logs,
  }))
  .onReady(({ store, api }) => {
    api!.log('Logger initialized successfully!');
    console.log(`  Logs stored: ${store.logs.length}`);
  });

// ============================================================================
// Example: Analytics Plugin with Store
// ============================================================================

const analyticsPlugin = plugin('analytics', '1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .depends(databasePlugin, '^1.0.0')
  .store(() => ({
    events: new Map<string, number>(),
    sessionStart: Date.now(),
  }))
  .proxy({
    include: ['track'], // Only proxy the track method
    before: _ctx => {
      console.log(`  🎯 Tracking event...`);
    },
  })
  .setup(({ plugins, store }) => ({
    track: (event: string): void => {
      const count = store.events.get(event) || 0;
      store.events.set(event, count + 1);
      plugins.logger.log(`📊 Event tracked: ${event} (${count + 1}x)`);
    },
    getStats: (): {
      totalEvents: number;
      uniqueEvents: number;
      sessionDuration: number;
      eventBreakdown: { [key: string]: number };
    } => ({
      totalEvents: Array.from(store.events.values()).reduce((a, b) => a + b, 0),
      uniqueEvents: store.events.size,
      sessionDuration: Date.now() - store.sessionStart,
      eventBreakdown: Object.fromEntries(store.events),
    }),
  }))
  .onReady(({ pluginName, store }) => {
    console.log(
      `[${pluginName}] ✅ Session started at ${new Date(store.sessionStart).toISOString()}`
    );
  })
  .onShutdown(({ api }) => {
    const stats = api!.getStats();
    console.log(`[analytics] 📈 Final stats:`, stats);
  });

// ============================================================================
// Main Execution
// ============================================================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('🚀 Store Example - Shared State Demo');
  console.log('========================================\n');

  // Create and start kernel
  const kernel = await createKernel()
    .use(loggerPlugin)
    .use(databasePlugin)
    .use(analyticsPlugin)
    .start();

  console.log('\n========================================');
  console.log('✨ Kernel Started! Using plugins...');
  console.log('========================================\n');

  // Use plugins
  const db = kernel.get('database');
  const analytics = kernel.get('analytics');

  // Execute queries (will increment store metrics)
  await db.query('SELECT * FROM users');
  await db.query('SELECT * FROM orders');
  await db.query('SELECT * FROM products');

  // Track analytics events (will increment store events)
  analytics.track('page_view');
  analytics.track('button_click');
  analytics.track('page_view');
  analytics.track('form_submit');

  // Get metrics from store
  console.log('\n📊 Current metrics:');
  console.log(db.getMetrics());
  console.log(analytics.getStats());

  console.log('\n========================================');
  console.log('🛑 Shutting Down Kernel');
  console.log('========================================\n');

  // Shutdown (will call onShutdown hooks with store + api)
  await kernel.shutdown();

  console.log('\n========================================');
  console.log('✅ Shutdown Complete!');
  console.log('========================================');
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
