/**
 * Plugin Constants
 */

export const PLUGIN_NAME = 'math';
export const PLUGIN_VERSION = '1.0.0';

/**
 * Mathematical constants
 */
export const MATH_CONSTANTS = {
  PI: Math.PI,
  E: Math.E,
  SQRT2: Math.SQRT2,
  LN2: Math.LN2,
  LN10: Math.LN10,
} as const;

/**
 * Validation limits
 */
export const VALIDATION = {
  MAX_SAFE_INTEGER: Number.MAX_SAFE_INTEGER,
  MIN_SAFE_INTEGER: Number.MIN_SAFE_INTEGER,
  MAX_FACTORIAL_INPUT: 170, // Factorial(171) = Infinity
  MAX_PRECISION: 15, // JavaScript number precision limit
} as const;

/**
 * Messages
 */
export const MESSAGES = {
  INIT: '🧮 Math plugin initializing...',
  READY: '✅ Math plugin ready!',
  SHUTDOWN: '👋 Math plugin shutting down...',
  LOGGER_DETECTED: '  ✅ Logger plugin detected',
  LOGGER_NOT_FOUND: '  ⚠️  Logger plugin not found',
} as const;
