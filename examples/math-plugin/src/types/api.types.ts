/**
 * Public API Interface - What users of this plugin will interact with
 */

import type { MathConfig } from './config.types';
import type { MathOperation } from './domain.types';

export interface MathAPI {
  // Basic operations
  add: (a: number, b: number) => number;
  subtract: (a: number, b: number) => number;
  multiply: (a: number, b: number) => number;
  divide: (a: number, b: number) => number;

  // Advanced operations
  power: (base: number, exponent: number) => number;
  sqrt: (value: number) => number;
  factorial: (n: number) => number;

  // Utilities
  isEven: (n: number) => boolean;
  isOdd: (n: number) => boolean;
  round: (value: number, precision?: number) => number;

  // Configuration
  configure: (config: Partial<MathConfig>) => void;
  getConfig: () => Readonly<MathConfig>;

  // History
  getHistory: () => readonly MathOperation[];
  clearHistory: () => void;
}
