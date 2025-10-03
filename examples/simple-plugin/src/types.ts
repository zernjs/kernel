/**
 * Counter Plugin Types
 */

// Public API interface
export interface CounterAPI {
  increment: () => number;
  decrement: () => number;
  reset: () => void;
  getValue: () => number;
  configure: (config: Partial<CounterConfig>) => void;
}

// Configuration interface
export interface CounterConfig {
  initialValue: number;
  maxValue: number;
  minValue: number;
  enableLogging: boolean;
}

// Plugin metadata
export interface CounterMetadata extends Record<string, unknown> {
  author: string;
  category: string;
  license: string;
}
