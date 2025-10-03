/**
 * Math Plugin - Public API
 *
 * This is what users import when they use your plugin
 */

// ============================================================================
// Plugin Export (for kernel usage)
// ============================================================================

export { mathPlugin } from './plugin';

// ============================================================================
// Type Exports
// ============================================================================

export type { MathAPI } from './types/api.types';
export type { MathConfig } from './types/config.types';
export type { MathOperation, MathOperator } from './types/domain.types';

// Re-export error types for advanced usage
export { MathError, MathErrorCode } from './errors';

// ============================================================================
// Direct API Exports (for use without kernel)
// ============================================================================

import { createDirectMethod } from '../../../src';
import type { MathAPI } from './types';

// Basic operations
export const add: MathAPI['add'] = createDirectMethod('math', 'add');
export const subtract: MathAPI['subtract'] = createDirectMethod('math', 'subtract');
export const multiply: MathAPI['multiply'] = createDirectMethod('math', 'multiply');
export const divide: MathAPI['divide'] = createDirectMethod('math', 'divide');

// Advanced operations
export const power: MathAPI['power'] = createDirectMethod('math', 'power');
export const sqrt: MathAPI['sqrt'] = createDirectMethod('math', 'sqrt');
export const factorial: MathAPI['factorial'] = createDirectMethod('math', 'factorial');

// Utilities
export const isEven: MathAPI['isEven'] = createDirectMethod('math', 'isEven');
export const isOdd: MathAPI['isOdd'] = createDirectMethod('math', 'isOdd');
export const round: MathAPI['round'] = createDirectMethod('math', 'round');

// Configuration & History
export const configure: MathAPI['configure'] = createDirectMethod('math', 'configure');
export const getConfig: MathAPI['getConfig'] = createDirectMethod('math', 'getConfig');
export const getHistory: MathAPI['getHistory'] = createDirectMethod('math', 'getHistory');
export const clearHistory: MathAPI['clearHistory'] = createDirectMethod('math', 'clearHistory');
