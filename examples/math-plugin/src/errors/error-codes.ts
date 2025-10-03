/**
 * Error Codes - Enum for all possible math errors
 */

export enum MathErrorCode {
  // Input validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_A_NUMBER = 'NOT_A_NUMBER',
  NOT_FINITE = 'NOT_FINITE',
  NOT_INTEGER = 'NOT_INTEGER',
  NEGATIVE_NUMBER = 'NEGATIVE_NUMBER',

  // Operation errors
  DIVISION_BY_ZERO = 'DIVISION_BY_ZERO',
  OVERFLOW = 'OVERFLOW',
  UNDERFLOW = 'UNDERFLOW',
  OUT_OF_RANGE = 'OUT_OF_RANGE',

  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  INVALID_PRECISION = 'INVALID_PRECISION',
}

/**
 * Error messages for each code
 */
export const ERROR_MESSAGES: Record<MathErrorCode, string> = {
  [MathErrorCode.INVALID_INPUT]: 'Invalid input provided',
  [MathErrorCode.NOT_A_NUMBER]: 'Value is not a number',
  [MathErrorCode.NOT_FINITE]: 'Value must be finite',
  [MathErrorCode.NOT_INTEGER]: 'Value must be an integer',
  [MathErrorCode.NEGATIVE_NUMBER]: 'Value must be non-negative',
  [MathErrorCode.DIVISION_BY_ZERO]: 'Cannot divide by zero',
  [MathErrorCode.OVERFLOW]: 'Result too large',
  [MathErrorCode.UNDERFLOW]: 'Result too small',
  [MathErrorCode.OUT_OF_RANGE]: 'Value out of allowed range',
  [MathErrorCode.INVALID_CONFIG]: 'Invalid configuration',
  [MathErrorCode.INVALID_PRECISION]: 'Precision must be between 0 and 15',
};
