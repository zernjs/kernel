export class AdvancedMathImpl {
  power(base: number, exponent: number): number {
    if (!Number.isFinite(base) || !Number.isFinite(exponent)) {
      throw new Error('INVALID_INPUT');
    }
    return Math.pow(base, exponent);
  }

  sqrt(value: number): number {
    if (value < 0) throw new Error('INVALID_INPUT');
    return Math.sqrt(value);
  }

  factorial(n: number): number {
    if (n < 0 || !Number.isInteger(n)) throw new Error('INVALID_INPUT');
    if (n === 0 || n === 1) return 1;
    return n * this.factorial(n - 1);
  }

  isEven(n: number): boolean {
    return Number.isInteger(n) && n % 2 === 0;
  }

  isOdd(n: number): boolean {
    return Number.isInteger(n) && n % 2 !== 0;
  }

  round(value: number, precision = 0): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }
}
