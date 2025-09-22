import type { MathConfig, MathOperation } from '../interfaces';

// Implementação pura - sem dependências do Zern
export class BasicMathImpl {
  private config: MathConfig = { precision: 2, enableLogging: false };
  private history: MathOperation[] = [];

  configure(newConfig: Partial<MathConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  add(a: number, b: number): number {
    this.validateInputs(a, b);
    const result = a + b;
    this.logOperation([a, b], 'add', result);
    return this.applyPrecision(result);
  }

  subtract(a: number, b: number): number {
    this.validateInputs(a, b);
    const result = a - b;
    this.logOperation([a, b], 'subtract', result);
    return this.applyPrecision(result);
  }

  multiply(a: number, b: number): number {
    this.validateInputs(a, b);
    const result = a * b;
    this.logOperation([a, b], 'multiply', result);
    return this.applyPrecision(result);
  }

  divide(a: number, b: number): number {
    this.validateInputs(a, b);
    if (b === 0) throw new Error('DIVISION_BY_ZERO');
    const result = a / b;
    this.logOperation([a, b], 'divide', result);
    return this.applyPrecision(result);
  }

  getHistory(): readonly MathOperation[] {
    return [...this.history];
  }

  private validateInputs(...values: number[]): void {
    for (const value of values) {
      if (!Number.isFinite(value)) {
        throw new Error('INVALID_INPUT');
      }
    }
  }

  private logOperation(operands: number[], operator: string, result: number): void {
    if (this.config.enableLogging) {
      this.history.push({ operands, operator, result });
    }
  }

  private applyPrecision(value: number): number {
    return Number(value.toFixed(this.config.precision));
  }
}
