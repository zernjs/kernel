/**
 * Default Configuration Values
 */

import type { MathConfig, MathPluginMetadata } from '../types';

/**
 * Default math plugin configuration
 */
export const DEFAULT_CONFIG: MathConfig = {
  precision: 2,
  maxValue: Infinity,
  minValue: -Infinity,
  enableHistory: true,
  enableLogging: false,
  maxHistorySize: 100,
};

/**
 * Plugin metadata
 */
export const PLUGIN_METADATA: MathPluginMetadata = {
  author: 'Zern Team',
  category: 'utilities',
  license: 'MIT',
  description: 'Professional math plugin with history tracking and validation',
  tags: ['math', 'calculator', 'utilities', 'arithmetic'],
};
