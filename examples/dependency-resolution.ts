/**
 * Dependency Resolution Example
 *
 * This example demonstrates how the Zern Kernel handles plugin dependencies,
 * including dependency injection, load order resolution, and circular dependency detection.
 */

import { plugin, ZernKernel } from '../src/core/index.js';

// Base logger plugin (no dependencies)
const loggerPlugin = plugin('logger')
  .version('1.0.0')
  .setup(async () => {
    console.log('🔧 Logger plugin initialized');

    return {
      log: (message: string): void => {
        console.log(`[LOG] ${new Date().toISOString()}: ${message}`);
      },
      error: (message: string): void => {
        console.error(`[ERROR] ${new Date().toISOString()}: ${message}`);
      },
      debug: (message: string): void => {
        console.log(`[DEBUG] ${new Date().toISOString()}: ${message}`);
      },
    };
  })
  .build();

// Config plugin (no dependencies)
const configPlugin = plugin('config')
  .version('1.0.0')
  .setup(async () => {
    console.log('⚙️ Config plugin initialized');

    const config = new Map<string, unknown>();
    config.set('database.host', 'localhost');
    config.set('database.port', 5432);
    config.set('cache.ttl', 3600);
    config.set('api.timeout', 5000);

    return {
      get: <T = unknown>(key: string, defaultValue?: T): T => {
        return (config.get(key) ?? defaultValue) as T;
      },
      set: (key: string, value: unknown): void => {
        config.set(key, value);
      },
      getAll: (): Record<string, unknown> => Object.fromEntries(config.entries()),
    };
  })
  .build();

// Database plugin (depends on logger and config)
const databasePlugin = plugin('database')
  .version('1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .depends(configPlugin, '^1.0.0')
  .setup(async deps => {
    const logger = deps.logger;
    const config = deps.config;

    const host = config.get('database.host');
    const port = config.get('database.port');

    logger.log(`Connecting to database at ${host}:${port}`);

    // Simulate database connection
    const db = new Map<string, unknown>();

    logger.log('Database connection established');

    return {
      connect: async (): Promise<boolean> => {
        logger.log('Database connected');
        return true;
      },
      disconnect: async (): Promise<void> => {
        logger.log('Database disconnected');
      },
      query: async (sql: string): Promise<{ rows: unknown[]; count: number }> => {
        logger.debug(`Executing query: ${sql}`);
        return { rows: [], count: 0 };
      },
      insert: (table: string, data: unknown): string => {
        const key = `${table}:${Date.now()}`;
        db.set(key, data);
        logger.debug(`Inserted data into ${table}`);
        return key;
      },
      find: (table: string): unknown[] => {
        const results = Array.from(db.entries())
          .filter(([key]) => key.startsWith(`${table}:`))
          .map(([, value]) => value);
        logger.debug(`Found ${results.length} records in ${table}`);
        return results;
      },
    };
  })
  .build();

// Cache plugin (depends on logger and config)
const cachePlugin = plugin('cache')
  .version('1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .depends(configPlugin, '^1.0.0')
  .setup(async deps => {
    const logger = deps.logger;
    const config = deps.config;

    const ttl = config.get('cache.ttl', 3600);
    logger.log(`Initializing cache with TTL: ${ttl}s`);

    const cache = new Map<string, { value: unknown; expires: number }>();

    return {
      set: (key: string, value: unknown, customTtl?: number): void => {
        const expires = Date.now() + (customTtl || ttl) * 1000;
        cache.set(key, { value, expires });
        logger.debug(`Cached key: ${key}`);
      },
      get: (key: string): unknown => {
        const item = cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expires) {
          cache.delete(key);
          logger.debug(`Cache expired for key: ${key}`);
          return null;
        }

        logger.debug(`Cache hit for key: ${key}`);
        return item.value;
      },
      delete: (key: string): boolean => {
        const deleted = cache.delete(key);
        if (deleted) logger.debug(`Cache deleted for key: ${key}`);
        return deleted;
      },
      clear: (): void => {
        cache.clear();
        logger.log('Cache cleared');
      },
      size: (): number => cache.size,
    };
  })
  .build();

// API plugin (depends on database, cache, and logger)
const apiPlugin = plugin('api')
  .version('1.0.0')
  .depends(databasePlugin, '^1.0.0')
  .depends(cachePlugin, '^1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .setup(async deps => {
    const database = deps.database;
    const cache = deps.cache;
    const logger = deps.logger;

    logger.log('Initializing API service');

    return {
      getUser: async (id: number): Promise<{ id: number; name: string; email: string } | null> => {
        // Try cache first
        const cacheKey = `user:${id}`;
        let user = cache.get(cacheKey) as { id: number; name: string; email: string } | undefined;

        if (user) {
          logger.debug(`User ${id} found in cache`);
          return user;
        }

        // Fallback to database
        logger.debug(`Fetching user ${id} from database`);
        const users = database.find('users');
        user = users.find((u: unknown) => (u as { id: number }).id === id) as
          | { id: number; name: string; email: string }
          | undefined;

        if (user) {
          cache.set(cacheKey, user, 300); // Cache for 5 minutes
          return user;
        }

        return null;
      },
      createUser: async (userData: {
        name: string;
        email: string;
      }): Promise<{ id: number; name: string; email: string }> => {
        logger.log(`Creating user: ${userData.name}`);
        const id = Date.now();
        database.insert('users', { ...userData, id });

        // Invalidate related cache (no need to invalidate since we're creating, not updating)
        // cache.delete(`user:${userData.id}`);

        return { id, ...userData };
      },
      getStats: (): Record<string, number> => {
        return {
          cacheSize: 0, // Placeholder since cache doesn't expose size
          timestamp: Date.now(),
        };
      },
    };
  })
  .build();

// Metrics plugin (depends on all other plugins to collect metrics)
const metricsPlugin = plugin('metrics')
  .version('1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .depends(databasePlugin, '^1.0.0')
  .depends(cachePlugin, '^1.0.0')
  .depends(apiPlugin, '^1.0.0')
  .setup(async deps => {
    const logger = deps.logger;

    logger.log('Initializing metrics collection');

    const metrics = new Map<string, number>();

    return {
      increment: (key: string, value = 1): void => {
        const current = metrics.get(key) || 0;
        metrics.set(key, current + value);
        logger.debug(`Metric ${key} incremented to ${current + value}`);
      },
      get: (key: string): number => metrics.get(key) || 0,
      getAll: (): Record<string, number> => Object.fromEntries(metrics.entries()),
      collectSystemMetrics: (): void => {
        const cache = deps.cache as { size?: () => number };
        const api = deps.api as { getStats: () => Record<string, number> };

        metrics.set('cache.size', cache.size?.() || 0);
        metrics.set('system.timestamp', Date.now());

        const stats = api.getStats();
        metrics.set('api.cache_size', stats.cacheSize);

        logger.log('System metrics collected');
      },
    };
  })
  .build();

async function runDependencyExample(): Promise<void> {
  console.log('🚀 Starting Dependency Resolution Example\n');

  try {
    // Create kernel instance using fluent API
    console.log('📦 Creating kernel with plugins in random order...');
    const kernel = ZernKernel()
      .plugin(metricsPlugin) // Depends on all others
      .plugin(apiPlugin) // Depends on database, cache, logger
      .plugin(configPlugin) // No dependencies
      .plugin(databasePlugin) // Depends on logger, config
      .plugin(loggerPlugin) // No dependencies
      .plugin(cachePlugin) // Depends on logger, config
      .build();

    console.log('\n🔄 Resolving dependencies and initializing kernel...');

    // The kernel will automatically resolve the correct load order:
    // 1. logger, config (no dependencies)
    // 2. database, cache (depend on logger, config)
    // 3. api (depends on database, cache, logger)
    // 4. metrics (depends on all others)

    await kernel.initialize();

    console.log('\n✅ All plugins initialized in correct dependency order!\n');

    // Get plugin APIs using automatic type inference
    const logger = kernel.plugins.get('logger');
    const database = kernel.plugins.get('database');
    const cache = kernel.plugins.get('cache');
    const api = kernel.plugins.get('api');
    const metrics = kernel.plugins.get('metrics');

    // Log that we have access to all plugin APIs
    logger?.log(`Database connected: ${database ? 'Yes' : 'No'}`);
    logger?.log(`Cache available: ${cache ? 'Yes' : 'No'}`);

    // Demonstrate the working system
    console.log('🎯 Demonstrating integrated functionality:\n');

    // Create some test data
    const user1 = await api?.createUser({ name: 'Alice', email: 'alice@example.com' });
    const user2 = await api?.createUser({ name: 'Bob', email: 'bob@example.com' });

    logger?.log(`Created user1: ${user1?.name} (${user1?.email})`);
    logger?.log(`Created user2: ${user2?.name} (${user2?.email})`);

    metrics?.increment('users.created', 2);

    // Test cache functionality
    logger?.log('Testing cache and database integration...');
    const fetchedUser1 = user1?.id ? await api?.getUser(user1.id) : null;
    const fetchedUser1Again = user1?.id ? await api?.getUser(user1.id) : null; // Should hit cache

    logger?.log(`Fetched user1 first time: ${fetchedUser1?.name}`);
    logger?.log(`Fetched user1 second time (cached): ${fetchedUser1Again?.name}`);

    metrics?.increment('api.requests', 2);

    // Collect system metrics
    metrics?.collectSystemMetrics();

    // Show final state
    console.log('\n📊 Final System State:');
    console.log(`Kernel State: ${kernel.currentState}`);
    console.log(`Load Order: ${kernel.getPluginNames().join(' → ')}`);
    console.log(`Metrics: ${JSON.stringify(metrics?.getAll(), null, 2)}`);

    // Cleanup
    console.log('\n🧹 Shutting down system...');
    await kernel.destroy();

    console.log('\n✅ Dependency resolution example completed successfully!');
  } catch (error) {
    console.error('❌ Error running dependency example:', error);
    process.exit(1);
  }
}

// Run the example
if (import.meta.url.endsWith('dependency-resolution.ts')) {
  runDependencyExample().catch(console.error);
}

export { runDependencyExample };
