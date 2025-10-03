/**
 * @file Lifecycle Hooks with Metadata Example
 * @description Demonstrates lifecycle hooks with typed plugins access and custom metadata
 */

import { createKernel, plugin } from '../src';

// ========================================
// Example: Plugins with Metadata
// ========================================

interface LoggerAPI {
  log: (message: string) => void;
  info: (message: string) => void;
}

interface DatabaseAPI {
  connect: () => Promise<void>;
  query: (sql: string) => Promise<{ rows: unknown[]; count: number }>;
}

// 1. Logger Plugin with Metadata
const loggerPlugin = plugin('logger', '1.0.0')
  .metadata({
    author: 'Zern Team',
    description: 'Simple logging system',
    category: 'utility',
  })
  .onInit(({ pluginName }): void => {
    console.log(`[${pluginName}] 🔄 Initializing...`);
  })
  .onReady(({ pluginName }): void => {
    console.log(`[${pluginName}] ✅ Ready!`);
  })
  .onShutdown(({ pluginName }): void => {
    console.log(`[${pluginName}] 👋 Shutting down...`);
  })
  .setup(
    (): LoggerAPI => ({
      log: (message: string): void => console.log(`📝 ${message}`),
      info: (message: string): void => console.log(`ℹ️  ${message}`),
    })
  );

// 2. Database Plugin with Metadata
const databasePlugin = plugin('database', '1.0.0')
  .metadata({
    author: 'Zern Team',
    description: 'Database connection manager',
    category: 'data',
    connectionString: 'postgresql://localhost:5432/mydb',
  })
  .depends(loggerPlugin, '^1.0.0')
  .onInit(({ pluginName, plugins }): void => {
    // ✅ Access logger plugin with full type safety!
    plugins.logger.info(`[${pluginName}] 🔄 Initializing...`);

    // ✅ Access logger's metadata directly with $meta!
    console.log(`  Logger author: ${plugins.logger.$meta.author}`);
    console.log(`  Logger category: ${plugins.logger.$meta.category}`);
  })
  .onReady(({ pluginName, plugins }): void => {
    plugins.logger.log(`[${pluginName}] ✅ Ready!`);
  })
  .onShutdown(({ pluginName, plugins }): void => {
    plugins.logger.info(`[${pluginName}] 🔌 Closing connections...`);
  })
  .setup(
    ({ plugins }): DatabaseAPI => ({
      connect: async (): Promise<void> => {
        plugins.logger.log('Connecting to database...');
        await new Promise(resolve => setTimeout(resolve, 100));
        plugins.logger.info('Connected!');
      },
      query: async (sql: string): Promise<{ rows: unknown[]; count: number }> => {
        plugins.logger.log(`Executing: ${sql}`);
        return { rows: [], count: 0 };
      },
    })
  );

// 3. Analytics Plugin accessing both Logger and Database
const analyticsPlugin = plugin('analytics', '1.0.0')
  .metadata({
    author: 'Zern Team',
    description: 'Analytics and tracking',
    category: 'monitoring',
    apiKey: 'analytics-key-123',
  })
  .depends(loggerPlugin, '^1.0.0')
  .depends(databasePlugin, '^1.0.0')
  .onInit(({ pluginName, plugins }): void => {
    // ✅ Access multiple plugins with type safety
    plugins.logger.info(`[${pluginName}] 🔄 Initializing...`);

    // ✅ Access metadata directly from dependencies
    console.log(`  Database connection: ${plugins.database.$meta.connectionString}`);
  })
  .onReady(async ({ pluginName, plugins }): Promise<void> => {
    plugins.logger.log(`[${pluginName}] ✅ Ready!`);

    // ✅ Can use database methods
    await plugins.database.query('SELECT * FROM analytics_config');
  })
  .onShutdown(({ pluginName, plugins }): void => {
    plugins.logger.info(`[${pluginName}] 📤 Flushing analytics data...`);
  })
  .setup(
    ({
      plugins,
    }): {
      track: (event: string) => void;
      getInfo: () => string;
    } => ({
      track: (event: string): void => {
        plugins.logger.info(`📊 Event: ${event}`);
      },
      getInfo: (): string => {
        return 'Analytics plugin initialized';
      },
    })
  );

// ========================================
// Main Execution
// ========================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('🚀 Lifecycle Hooks with Metadata');
  console.log('========================================\n');

  const kernel = await createKernel()
    .use(loggerPlugin)
    .use(databasePlugin)
    .use(analyticsPlugin)
    .start();

  console.log('\n========================================');
  console.log('✨ Kernel Started!');
  console.log('========================================\n');

  // Access plugins
  const logger = kernel.get('logger');
  const db = kernel.get('database');
  const analytics = kernel.get('analytics');

  // Use plugins
  logger.log('Application started');
  await db.connect();
  await db.query('SELECT * FROM users');
  analytics.track('app_started');

  // Get info from analytics
  const info = analytics.getInfo();
  console.log('\n📋 Plugin Info:');
  console.log('  ', info);

  console.log('\n========================================');
  console.log('🛑 Shutting Down');
  console.log('========================================\n');

  await kernel.shutdown();

  console.log('\n✅ Done!');
}

// Run the example
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
