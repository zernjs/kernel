import type { CounterConfig, CounterMetadata } from './types';

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: CounterConfig = {
  initialValue: 0,
  maxValue: 100,
  minValue: -100,
  enableLogging: false,
};

/**
 * Plugin metadata
 */
export const PLUGIN_METADATA: CounterMetadata = {
  author: 'Zern Team',
  category: 'utilities',
  license: 'MIT',
};

/**
 * Plugin constants
 */
export const PLUGIN_NAME = 'counter';
export const PLUGIN_VERSION = '1.0.0';
