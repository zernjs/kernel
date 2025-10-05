export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

/**
 * Creates a successful Result.
 *
 * @param data - The success value
 * @returns Result with success status
 */
export function success<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Creates a failed Result.
 *
 * @param error - The error value
 * @returns Result with failure status
 */
export function failure<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Type guard to check if a Result is successful.
 *
 * @param result - Result to check
 * @returns True if result is successful
 */
export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}

/**
 * Type guard to check if a Result is a failure.
 *
 * @param result - Result to check
 * @returns True if result is a failure
 */
export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}

/**
 * Maps the value inside a successful Result.
 *
 * @param result - Result to map
 * @param fn - Transform function
 * @returns New Result with transformed value, or original error
 */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
  if (result.success === false) {
    return result;
  }

  return success(fn(result.data));
}

/**
 * Chains a function that returns a Result.
 *
 * @param result - Result to chain
 * @param fn - Function that returns a new Result
 * @returns Chained Result or original error
 */
export function chainResult<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> {
  if (result.success === false) {
    return result;
  }

  return fn(result.data);
}

/**
 * Collects multiple Results into a single Result of arrays.
 *
 * @param results - Array of Results
 * @returns Result containing array of values, or first error encountered
 */
export function collectResults<T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> {
  const data: T[] = [];

  for (const result of results) {
    if (result.success === false) {
      return result;
    }

    data.push(result.data);
  }

  return success(data);
}
