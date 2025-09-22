import type { MathConfig, MathOperation } from './math.types';

// Interface principal - contrato público
export interface MathAPI {
  // Operações básicas
  readonly add: (a: number, b: number) => number;
  readonly subtract: (a: number, b: number) => number;
  readonly multiply: (a: number, b: number) => number;
  readonly divide: (a: number, b: number) => number;

  // Operações avançadas
  readonly power: (base: number, exponent: number) => number;
  readonly sqrt: (value: number) => number;
  readonly factorial: (n: number) => number;

  // Utilitários
  readonly isEven: (n: number) => boolean;
  readonly isOdd: (n: number) => boolean;
  readonly round: (value: number, precision?: number) => number;

  // Configuração
  readonly configure: (config: Partial<MathConfig>) => void;
  readonly getHistory: () => readonly MathOperation[];
}
