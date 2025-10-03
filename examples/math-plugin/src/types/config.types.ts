/**
 * Configuration Types
 */

export interface MathConfig {
  /**
   * Number of decimal places for results
   * @default 2
   */
  precision: number;

  /**
   * Maximum allowed value for operations
   * @default Infinity
   */
  maxValue: number;

  /**
   * Minimum allowed value for operations
   * @default -Infinity
   */
  minValue: number;

  /**
   * Enable operation history tracking
   * @default true
   */
  enableHistory: boolean;

  /**
   * Enable console logging for operations
   * @default false
   */
  enableLogging: boolean;

  /**
   * Maximum number of operations to keep in history
   * @default 100
   */
  maxHistorySize: number;
}
