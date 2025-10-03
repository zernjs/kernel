/**
 * Math Service - Core mathematical operations
 */

import type { MathConfig } from '../types/config.types';
import { NumberValidator } from '../validators';
import { createMathError, MathErrorCode } from '../errors';
import { formatNumber } from '../utils';
import type { HistoryService } from './history.service';

export class MathService {
  private config: MathConfig;

  constructor(
    private readonly historyService: HistoryService,
    initialConfig: MathConfig
  ) {
    this.config = { ...initialConfig };
  }

  // ============================================================================
  // Basic Operations
  // ============================================================================

  add(a: number, b: number): number {
    NumberValidator.validateInputs(a, b);
    const result = a + b;
    this.historyService.record('add', [a, b], result);
    this.log(`${a} + ${b} = ${result}`);
    return this.applyPrecision(result);
  }

  subtract(a: number, b: number): number {
    NumberValidator.validateInputs(a, b);
    const result = a - b;
    this.historyService.record('subtract', [a, b], result);
    this.log(`${a} - ${b} = ${result}`);
    return this.applyPrecision(result);
  }

  multiply(a: number, b: number): number {
    NumberValidator.validateInputs(a, b);
    const result = a * b;
    this.historyService.record('multiply', [a, b], result);
    this.log(`${a} × ${b} = ${result}`);
    return this.applyPrecision(result);
  }

  divide(a: number, b: number): number {
    NumberValidator.validateInputs(a, b);

    if (b === 0) {
      throw createMathError(MathErrorCode.DIVISION_BY_ZERO, { dividend: a });
    }

    const result = a / b;
    this.historyService.record('divide', [a, b], result);
    this.log(`${a} ÷ ${b} = ${result}`);
    return this.applyPrecision(result);
  }

  // ============================================================================
  // Advanced Operations
  // ============================================================================

  power(base: number, exponent: number): number {
    NumberValidator.validateInputs(base, exponent);
    const result = Math.pow(base, exponent);

    if (!Number.isFinite(result)) {
      throw createMathError(MathErrorCode.OVERFLOW, { base, exponent });
    }

    this.historyService.record('power', [base, exponent], result);
    this.log(`${base}^${exponent} = ${result}`);
    return this.applyPrecision(result);
  }

  sqrt(value: number): number {
    NumberValidator.validateFinite(value);
    NumberValidator.validateNonNegative(value, 'value');

    const result = Math.sqrt(value);
    this.historyService.record('sqrt', [value], result);
    this.log(`√${value} = ${result}`);
    return this.applyPrecision(result);
  }

  factorial(n: number): number {
    NumberValidator.validateFactorialInput(n);

    const result = this.calculateFactorial(n);
    this.historyService.record('factorial', [n], result);
    this.log(`${n}! = ${result}`);
    return result;
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  isEven(n: number): boolean {
    NumberValidator.validateInteger(n);
    return n % 2 === 0;
  }

  isOdd(n: number): boolean {
    NumberValidator.validateInteger(n);
    return n % 2 !== 0;
  }

  round(value: number, precision = 0): number {
    NumberValidator.validateFinite(value);
    NumberValidator.validatePrecision(precision);

    const factor = Math.pow(10, precision);
    const result = Math.round(value * factor) / factor;

    this.historyService.record('round', [value, precision], result);
    return result;
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  configure(newConfig: Partial<MathConfig>): void {
    // Validate precision if provided
    if (newConfig.precision !== undefined) {
      NumberValidator.validatePrecision(newConfig.precision);
    }

    this.config = { ...this.config, ...newConfig };
    this.log(`Configuration updated: ${JSON.stringify(this.config)}`);
  }

  getConfig(): Readonly<MathConfig> {
    return { ...this.config };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private calculateFactorial(n: number): number {
    if (n === 0 || n === 1) return 1;
    return n * this.calculateFactorial(n - 1);
  }

  private applyPrecision(value: number): number {
    return formatNumber(value, this.config.precision);
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[Math] ${message}`);
    }
  }
}
