/**
 * Basic Kernel Usage Example
 *
 * This example demonstrates the fundamental usage of the Zern Kernel
 * with simple plugins that don't have dependencies.
 */

import { ZernKernel, plugin } from '../src/index.js';

// Create a simple logger plugin
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
      warn: (message: string): void => {
        console.warn(`[WARN] ${new Date().toISOString()}: ${message}`);
      },
    };
  })
  .destroy(async () => {
    console.log('🔧 Logger plugin destroyed');
  })
  .build();

// Create a simple metrics plugin
const metricsPlugin = plugin('metrics')
  .version('1.0.0')
  .setup(async () => {
    console.log('📊 Metrics plugin initialized');

    const metrics = new Map<string, number>();

    return {
      increment: (key: string, value = 1): void => {
        const current = metrics.get(key) || 0;
        metrics.set(key, current + value);
      },
      get: (key: string): number => metrics.get(key) || 0,
      getAll: (): Record<string, number> => Object.fromEntries(metrics.entries()),
      reset: (): void => metrics.clear(),
    };
  })
  .destroy(async () => {
    console.log('📊 Metrics plugin destroyed');
  })
  .build();

// Create a simple config plugin
const configPlugin = plugin('config')
  .version('1.0.0')
  .setup(async () => {
    console.log('⚙️ Config plugin initialized');

    const config = new Map<string, unknown>();

    // Set some default values
    config.set('app.name', 'Zern Kernel Example');
    config.set('app.version', '1.0.0');
    config.set('debug', true);

    return {
      get: <T = unknown>(key: string, defaultValue?: T): T => {
        return (config.get(key) ?? defaultValue) as T;
      },
      set: (key: string, value: unknown): void => {
        config.set(key, value);
      },
      has: (key: string): boolean => config.has(key),
      delete: (key: string): boolean => config.delete(key),
      getAll: (): Record<string, unknown> => Object.fromEntries(config.entries()),
    };
  })
  .destroy(async () => {
    console.log('⚙️ Config plugin destroyed');
  })
  .build();

async function runBasicExample(): Promise<void> {
  console.log('🚀 Starting Basic Kernel Example\n');

  try {
    // Create and configure kernel using fluent API
    console.log('📦 Creating kernel with plugins...');
    const kernel = ZernKernel()
      .plugin(loggerPlugin)
      .plugin(metricsPlugin)
      .plugin(configPlugin)
      .build();

    // Initialize kernel
    console.log('\n🔄 Initializing kernel...');
    await kernel.initialize();

    // Get plugin APIs using automatic type inference
    const logger = kernel.plugins.get('logger');
    const metrics = kernel.plugins.get('metrics');
    const config = kernel.plugins.get('config');

    console.log('\n✅ Kernel initialized successfully!\n');

    // Demonstrate plugin usage
    console.log('🎯 Demonstrating plugin functionality:\n');

    // Use logger
    logger?.log('Application started successfully');
    logger?.warn('This is a warning message');

    // Use config
    const appName = config?.get('app.name');
    const debugMode = config?.get('debug');
    logger?.log(`App: ${appName}, Debug: ${debugMode}`);

    // Use metrics
    metrics?.increment('requests');
    metrics?.increment('requests');
    metrics?.increment('errors');

    const allMetrics = metrics?.getAll();
    logger?.log(`Current metrics: ${JSON.stringify(allMetrics)}`);

    // Show kernel state
    console.log(`\n📊 Kernel State: ${kernel.currentState}`);
    console.log(`📦 Registered Plugins: ${kernel.getPluginNames().join(', ')}`);

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await kernel.destroy();

    console.log('\n✅ Example completed successfully!');
  } catch (error) {
    console.error('❌ Error running example:', error);
    process.exit(1);
  }
}

// Run the example
if (import.meta.url.endsWith('basic-usage.ts')) {
  runBasicExample().catch(console.error);
}

export { runBasicExample };
