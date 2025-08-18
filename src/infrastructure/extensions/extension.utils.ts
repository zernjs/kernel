/**
 * Utilitários de extensão com tipagem estrita
 */

import type { Result } from '../../shared/types';
import { success, failure } from '../../shared/types';

/**
 * Operações de extensão disponíveis
 */
export type ExtensionOperation = 'override' | 'extend' | 'overload' | 'middleware' | 'add';

/**
 * Contexto de extensão tipado
 */
export interface ExtensionContext<TTarget, TMethod extends keyof TTarget> {
  readonly target: TTarget;
  readonly methodName: TMethod;
  readonly originalMethod: TTarget[TMethod];
}

/**
 * Função de middleware tipada
 */
export type MiddlewareFunction<TArgs extends readonly unknown[], TReturn> = (
  next: (...args: TArgs) => TReturn | Promise<TReturn>,
  ...args: TArgs
) => TReturn | Promise<TReturn>;

/**
 * Tipo para adicionar método
 */
export type WithAddedMethod<T, K extends string, V> = T & Record<K, V>;

/**
 * Tipo para sobrescrever método
 */
export type WithOverriddenMethod<T, K extends keyof T, V> = Omit<T, K> & Record<K, V>;

/**
 * Resultado de extensão
 */
export type ExtensionResult<TTarget, TExtensions> = TTarget & TExtensions;

/**
 * Sobrescreve um método existente
 */
export function overrideMethod<
  T extends Record<string, unknown>,
  K extends keyof T,
  V extends T[K],
>(target: T, methodName: K, newMethod: V): Result<WithOverriddenMethod<T, K, V>, Error> {
  try {
    const result = { ...target, [methodName]: newMethod } as WithOverriddenMethod<T, K, V>;
    return success(result);
  } catch (error) {
    return failure(new Error(`Failed to override method ${String(methodName)}: ${error}`));
  }
}

/**
 * Estende um método existente com wrapper
 */
export function extendMethod<
  T extends Record<string, unknown>,
  K extends keyof T,
  TMethod extends T[K],
>(target: T, methodName: K, wrapper: (original: TMethod) => TMethod): Result<T, Error> {
  try {
    const originalMethod = target[methodName] as TMethod;
    const wrappedMethod = wrapper(originalMethod);
    const result = { ...target, [methodName]: wrappedMethod };
    return success(result);
  } catch (error) {
    return failure(new Error(`Failed to extend method ${String(methodName)}: ${error}`));
  }
}

/**
 * Adiciona um novo método
 */
export function addMethod<T extends Record<string, unknown>, K extends string, V>(
  target: T,
  methodName: K,
  method: V
): Result<WithAddedMethod<T, K, V>, Error> {
  try {
    if (methodName in target) {
      return failure(new Error(`Method ${methodName} already exists`));
    }
    const result = { ...target, [methodName]: method } as WithAddedMethod<T, K, V>;
    return success(result);
  } catch (error) {
    return failure(new Error(`Failed to add method ${methodName}: ${error}`));
  }
}

/**
 * Configuração de overload
 */
export interface OverloadConfig<TArgs extends readonly unknown[], TReturn> {
  readonly condition: (...args: TArgs) => boolean;
  readonly implementation: (...args: TArgs) => TReturn;
}

/**
 * Adiciona overloads a um método
 */
export function addOverloads<
  T extends Record<string, unknown>,
  K extends keyof T,
  TArgs extends readonly unknown[],
  TReturn,
>(
  target: T,
  methodName: K,
  overloads: readonly OverloadConfig<TArgs, TReturn>[]
): Result<T, Error> {
  try {
    const originalMethod = target[methodName] as (...args: TArgs) => TReturn;

    const dispatcher = (...args: TArgs): TReturn => {
      for (const overload of overloads) {
        if (overload.condition(...args)) {
          return overload.implementation(...args);
        }
      }
      return originalMethod(...args);
    };

    const result = { ...target, [methodName]: dispatcher };
    return success(result);
  } catch (error) {
    return failure(new Error(`Failed to add overloads to ${String(methodName)}: ${error}`));
  }
}
