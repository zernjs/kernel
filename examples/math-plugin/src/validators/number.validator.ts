/**
 * Number Validation Utilities
 */

import { createMathError, MathErrorCode } from '../errors';
import { VALIDATION } from '../config';

/**
 * Number Validator - Pure validation functions
 */
export class NumberValidator {
  /**
   * Check if value is a finite number
   */
  static isFinite(value: number): boolean {
    return Number.isFinite(value);
  }

  /**
   * Check if value is an integer
   */
  static isInteger(value: number): boolean {
    return Number.isInteger(value);
  }

  /**
   * Check if value is positive
   */
  static isPositive(value: number): boolean {
    return value > 0;
  }

  /**
   * Check if value is non-negative
   */
  static isNonNegative(value: number): boolean {
    return value >= 0;
  }

  /**
   * Check if value is within safe integer range
   */
  static isSafeInteger(value: number): boolean {
    return Number.isSafeInteger(value);
  }

  /**
   * Validate that value is a finite number (throws on failure)
   */
  static validateFinite(value: number, name = 'value'): void {
    if (!this.isFinite(value)) {
      throw createMathError(MathErrorCode.NOT_FINITE, { [name]: value });
    }
  }

  /**
   * Validate that value is an integer (throws on failure)
   */
  static validateInteger(value: number, name = 'value'): void {
    if (!this.isInteger(value)) {
      throw createMathError(MathErrorCode.NOT_INTEGER, { [name]: value });
    }
  }

  /**
   * Validate that value is non-negative (throws on failure)
   */
  static validateNonNegative(value: number, name = 'value'): void {
    if (!this.isNonNegative(value)) {
      throw createMathError(MathErrorCode.NEGATIVE_NUMBER, { [name]: value });
    }
  }

  /**
   * Validate multiple inputs are finite numbers
   */
  static validateInputs(...values: number[]): void {
    for (const value of values) {
      this.validateFinite(value);
    }
  }

  /**
   * Validate value is within allowed range
   */
  static validateRange(value: number, min: number, max: number, name = 'value'): void {
    if (value < min || value > max) {
      throw createMathError(MathErrorCode.OUT_OF_RANGE, {
        [name]: value,
        min,
        max,
      });
    }
  }

  /**
   * Validate factorial input
   */
  static validateFactorialInput(n: number): void {
    this.validateInteger(n, 'n');
    this.validateNonNegative(n, 'n');
    this.validateRange(n, 0, VALIDATION.MAX_FACTORIAL_INPUT, 'n');
  }

  /**
   * Validate precision value
   */
  static validatePrecision(precision: number): void {
    this.validateInteger(precision, 'precision');
    this.validateRange(precision, 0, VALIDATION.MAX_PRECISION, 'precision');
  }
}
