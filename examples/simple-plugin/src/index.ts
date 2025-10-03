/**
 * Simple Counter Plugin - Public API
 */

// Plugin export (for use with kernel)
export { counterPlugin } from './plugin';

// Type exports
export type { CounterAPI, CounterConfig, CounterMetadata } from './types';

// Direct API exports (for use without kernel)
import { createDirectMethod } from '../../../src';
import type { CounterAPI } from './types';

export const increment: CounterAPI['increment'] = createDirectMethod('counter', 'increment');
export const decrement: CounterAPI['decrement'] = createDirectMethod('counter', 'decrement');
export const reset: CounterAPI['reset'] = createDirectMethod('counter', 'reset');
export const getValue: CounterAPI['getValue'] = createDirectMethod('counter', 'getValue');
export const configure: CounterAPI['configure'] = createDirectMethod('counter', 'configure');
