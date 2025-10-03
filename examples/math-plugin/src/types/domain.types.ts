/**
 * Domain Models - Business entities and value objects
 */

/**
 * Represents a mathematical operation that was performed
 */
export interface MathOperation {
  /**
   * Name of the operation (add, subtract, etc.)
   */
  readonly operation: MathOperator;

  /**
   * Input values for the operation
   */
  readonly operands: readonly number[];

  /**
   * Result of the operation
   */
  readonly result: number;

  /**
   * When the operation was performed (Unix timestamp)
   */
  readonly timestamp: number;
}

/**
 * Supported mathematical operators
 */
export type MathOperator =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'power'
  | 'sqrt'
  | 'factorial'
  | 'round';

/**
 * Plugin metadata structure
 */
export interface MathPluginMetadata extends Record<string, unknown> {
  readonly author: string;
  readonly category: string;
  readonly license: string;
  readonly description: string;
  readonly tags: readonly string[];
}
