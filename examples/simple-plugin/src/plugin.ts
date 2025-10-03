import { plugin } from '../../../src';
import type { CounterAPI, CounterConfig } from './types';
import { DEFAULT_CONFIG, PLUGIN_METADATA, PLUGIN_NAME, PLUGIN_VERSION } from './config';

/**
 * Counter Plugin - Simple example of a Zern plugin
 *
 * Demonstrates:
 * - Basic plugin setup
 * - Metadata
 * - Lifecycle hooks
 * - State management
 * - Configuration
 */
export const counterPlugin = plugin(PLUGIN_NAME, PLUGIN_VERSION)
  // Custom metadata
  .metadata(PLUGIN_METADATA)

  // Lifecycle: Called when plugin is registered
  .onInit(({ plugins }) => {
    console.log('🔢 Counter plugin initializing...');

    // Example: Check if logger plugin is available
    if (plugins.logger) {
      console.log('  ✅ Logger plugin detected');
    }
  })

  // Lifecycle: Called when all plugins are ready
  .onReady(() => {
    console.log('✅ Counter plugin ready!');
  })

  // Lifecycle: Called during kernel shutdown
  .onShutdown(() => {
    console.log('👋 Counter plugin shutting down...');
  })

  // Setup: Create the plugin API
  .setup((): CounterAPI => {
    // Internal state
    let value = DEFAULT_CONFIG.initialValue;
    let config = { ...DEFAULT_CONFIG };

    // Helper: Log if enabled
    const log = (message: string): void => {
      if (config.enableLogging) {
        console.log(`[Counter] ${message}`);
      }
    };

    // Helper: Validate bounds
    const validateBounds = (newValue: number): number => {
      if (newValue > config.maxValue) {
        log(`Value ${newValue} exceeds max ${config.maxValue}, clamping`);
        return config.maxValue;
      }
      if (newValue < config.minValue) {
        log(`Value ${newValue} below min ${config.minValue}, clamping`);
        return config.minValue;
      }
      return newValue;
    };

    // Public API
    return {
      increment: (): number => {
        const newValue = validateBounds(value + 1);
        value = newValue;
        log(`Incremented to ${value}`);
        return value;
      },

      decrement: (): number => {
        const newValue = validateBounds(value - 1);
        value = newValue;
        log(`Decremented to ${value}`);
        return value;
      },

      reset: (): void => {
        value = config.initialValue;
        log(`Reset to ${value}`);
      },

      getValue: (): number => {
        return value;
      },

      configure: (newConfig: Partial<CounterConfig>): void => {
        config = { ...config, ...newConfig };
        log(`Configuration updated: ${JSON.stringify(config)}`);
      },
    };
  });
