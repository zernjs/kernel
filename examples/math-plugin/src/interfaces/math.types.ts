// Tipos do domínio - sem implementação
export interface MathOperation {
  readonly operands: readonly number[];
  readonly operator: string;
  readonly result: number;
}

export interface MathConfig {
  readonly precision?: number;
  readonly maxValue?: number;
  readonly enableLogging?: boolean;
}

export type MathError = 'DIVISION_BY_ZERO' | 'INVALID_INPUT' | 'OVERFLOW_ERROR';
