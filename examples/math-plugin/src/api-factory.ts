/**
 * API Factory - Assembles the public API from services
 */

import type { PluginSetupContext } from '../../../src';
import type { MathAPI } from './types';
import { MathService, HistoryService } from './services';
import { DEFAULT_CONFIG } from './config';

/**
 * Creates the Math Plugin API
 * This is the setup function that will be passed to plugin().setup()
 */
export function createMathAPI(_ctx: PluginSetupContext): MathAPI {
  // Initialize services with default config
  const config = { ...DEFAULT_CONFIG };
  const historyService = new HistoryService(config);
  const mathService = new MathService(historyService, config);

  // Return public API - all methods delegate to services
  return {
    // Basic operations
    add: (a, b) => mathService.add(a, b),
    subtract: (a, b) => mathService.subtract(a, b),
    multiply: (a, b) => mathService.multiply(a, b),
    divide: (a, b) => mathService.divide(a, b),

    // Advanced operations
    power: (base, exp) => mathService.power(base, exp),
    sqrt: n => mathService.sqrt(n),
    factorial: n => mathService.factorial(n),

    // Utilities
    isEven: n => mathService.isEven(n),
    isOdd: n => mathService.isOdd(n),
    round: (value, precision) => mathService.round(value, precision),

    // Configuration
    configure: config => mathService.configure(config),
    getConfig: () => mathService.getConfig(),

    // History
    getHistory: () => historyService.getAll(),
    clearHistory: () => historyService.clear(),
  };
}
