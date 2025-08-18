/**
 * Result pattern para operações que podem falhar
 * Elimina o uso de exceptions para controle de fluxo
 */
export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

/**
 * Cria um resultado de sucesso
 */
export function success<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Cria um resultado de falha
 */
export function failure<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Type guard para verificar se o resultado é sucesso
 */
export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}

/**
 * Type guard para verificar se o resultado é falha
 */
export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}

/**
 * Mapeia o valor de um resultado de sucesso
 */
export function mapResult<T, U, E>(result: Result<T, E>, mapper: (value: T) => U): Result<U, E> {
  return isSuccess(result) ? success(mapper(result.data)) : (result as Result<U, E>);
}

/**
 * Mapeia o erro de um resultado de falha
 */
export function mapError<T, E, F>(result: Result<T, E>, mapper: (error: E) => F): Result<T, F> {
  return isFailure(result) ? failure(mapper(result.error)) : (result as Result<T, F>);
}
