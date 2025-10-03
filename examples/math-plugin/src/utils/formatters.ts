/**
 * Number Formatting Utilities
 */

/**
 * Format number with specified precision
 */
export function formatNumber(value: number, precision: number): number {
  return Number(value.toFixed(precision));
}

/**
 * Format number as percentage
 */
export function formatPercentage(value: number, precision = 2): string {
  return `${(value * 100).toFixed(precision)}%`;
}

/**
 * Format large numbers with K/M/B suffixes
 */
export function formatLargeNumber(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1e9) {
    return `${sign}${(absValue / 1e9).toFixed(1)}B`;
  }
  if (absValue >= 1e6) {
    return `${sign}${(absValue / 1e6).toFixed(1)}M`;
  }
  if (absValue >= 1e3) {
    return `${sign}${(absValue / 1e3).toFixed(1)}K`;
  }

  return value.toString();
}

/**
 * Clamp number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Check if two numbers are approximately equal (within epsilon)
 */
export function approximatelyEqual(a: number, b: number, epsilon = 1e-10): boolean {
  return Math.abs(a - b) < epsilon;
}
