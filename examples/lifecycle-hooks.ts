/**
 * @file Lifecycle Hooks Example
 * @description Demonstrates how to use lifecycle hooks in plugins
 */

import { createKernel, plugin } from '../src';

// ========================================
// Example 1: Basic Lifecycle Hooks
// ========================================

interface LoggerAPI {
  log: (message: string) => void;
  error: (message: string) => void;
}

const loggerPlugin = plugin('logger', '1.0.0')
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
      error: (message: string): void => console.error(`❌ ${message}`),
    })
  );

// ========================================
// Example 2: Database Connection with Hooks
// ========================================

interface DatabaseConnection {
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

const databasePlugin = plugin('database', '1.0.0')
  .onInit(async ({ pluginName }): Promise<void> => {
    console.log(`[${pluginName}] 🔌 Preparing database connection...`);
  })
  .onReady(async ({ pluginName, kernel }): Promise<void> => {
    console.log(`[${pluginName}] 🚀 Database ready for queries!`);

    // Access kernel context if needed
    console.log(`  Kernel ID: ${kernel.id}`);
  })
  .onShutdown(async ({ pluginName }): Promise<void> => {
    console.log(`[${pluginName}] 🔌 Closing database connection...`);
  })
  .setup(() => {
    const connection: DatabaseConnection = {
      connected: false,
      async connect(): Promise<void> {
        console.log('  Connecting to database...');
        await new Promise(resolve => setTimeout(resolve, 100));
        this.connected = true;
        console.log('  Connected!');
      },
      async disconnect(): Promise<void> {
        console.log('  Disconnecting from database...');
        await new Promise(resolve => setTimeout(resolve, 50));
        this.connected = false;
        console.log('  Disconnected!');
      },
    };

    return {
      query: async (sql: string): Promise<{ rows: unknown[]; count: number }> => {
        if (!connection.connected) {
          await connection.connect();
        }
        console.log(`  Executing: ${sql}`);
        return { rows: [], count: 0 };
      },
      disconnect: (): Promise<void> => connection.disconnect(),
    };
  });

// ========================================
// Example 3: Error Handling Hook
// ========================================

const errorHandlerPlugin = plugin('error-handler', '1.0.0')
  .onError((error, { pluginName }): void => {
    console.error(`[${pluginName}] ⚠️ Error during initialization:`, error.message);
    // Could send to error tracking service here
  })
  .setup(() => ({
    reportError: (error: Error): void => console.error('Error reported:', error),
  }));

// ========================================
// Example 4: Resource Management with All Hooks
// ========================================

const resourcePlugin = plugin('resources', '1.0.0')
  .onInit(async ({ pluginName }): Promise<void> => {
    console.log(`[${pluginName}] 📦 Allocating resources...`);
    // Pre-initialization setup
    await new Promise(resolve => setTimeout(resolve, 50));
  })
  .onReady(async ({ pluginName }): Promise<void> => {
    console.log(`[${pluginName}] 🎉 Resources allocated successfully!`);
    // Post-initialization tasks
  })
  .onShutdown(async ({ pluginName }): Promise<void> => {
    console.log(`[${pluginName}] 🧹 Cleaning up resources...`);
    // Cleanup logic
    await new Promise(resolve => setTimeout(resolve, 50));
  })
  .onError((error, { pluginName }): void => {
    console.error(`[${pluginName}] 💥 Failed to allocate resources:`, error.message);
  })
  .setup(() => ({
    getResource: (name: string): string => `Resource: ${name}`,
    releaseResource: (name: string): void => console.log(`Released: ${name}`),
  }));

// ========================================
// Example 5: Plugin with Dependencies and Hooks
// ========================================

const analyticsPlugin = plugin('analytics', '1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .onInit(({ pluginName, kernel }): void => {
    const logger = kernel.get<LoggerAPI>('logger');
    logger.log(`[${pluginName}] Initializing analytics...`);
  })
  .onReady(({ pluginName, kernel }): void => {
    const logger = kernel.get<LoggerAPI>('logger');
    logger.log(`[${pluginName}] Analytics tracking started!`);
  })
  .onShutdown(({ pluginName, kernel }): void => {
    const logger = kernel.get<LoggerAPI>('logger');
    logger.log(`[${pluginName}] Flushing analytics data...`);
  })
  .setup(({ plugins }) => ({
    track: (event: string): void => {
      plugins.logger.log(`📊 Event tracked: ${event}`);
    },
    flush: (): void => {
      plugins.logger.log('📤 Flushing analytics...');
    },
  }));

// ========================================
// Main Execution
// ========================================

async function main(): Promise<void> {
  console.log('========================================');
  console.log('🚀 Starting Kernel with Lifecycle Hooks');
  console.log('========================================\n');

  // Create and start kernel
  const kernel = await createKernel()
    .use(loggerPlugin)
    .use(databasePlugin)
    .use(errorHandlerPlugin)
    .use(resourcePlugin)
    .use(analyticsPlugin)
    .start();

  console.log('\n========================================');
  console.log('✨ Kernel Started Successfully!');
  console.log('========================================\n');

  // Use plugins
  const logger = kernel.get('logger');
  const db = kernel.get('database');
  const analytics = kernel.get('analytics');
  const resources = kernel.get('resources');

  logger.log('Testing plugin APIs...');
  await db.query('SELECT * FROM users');
  analytics.track('app_started');
  console.log(`  ${resources.getResource('config')}`);

  console.log('\n========================================');
  console.log('🛑 Shutting Down Kernel');
  console.log('========================================\n');

  // Shutdown (triggers onShutdown hooks)
  await kernel.shutdown();

  console.log('\n========================================');
  console.log('✅ Shutdown Complete!');
  console.log('========================================');
}

// Run the example
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
