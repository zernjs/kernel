/**
 * @file Result pattern for type-safe error handling
 * @description Avoids exceptions and makes errors explicit
 */

export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

// Create result helpers
export function success<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function failure<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// Result utilities to work with results
export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}

export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}

// Map function to transform data in result
export function mapResult<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
  if (result.success === false) {
    return result;
  }

  return success(fn(result.data));
}

// Chain function to sequencial operations
export function chainResult<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> {
  if (result.success === false) {
    return result;
  }

  return fn(result.data);
}

// Collect multiple results
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
