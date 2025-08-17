/**
 * @file Extension utilities for plugin method override, overload, and extension.
 * Provides helper functions to facilitate common extension patterns.
 */

/**
 * Extension operation types.
 */
export type ExtensionOperation = 'override' | 'extend' | 'overload' | 'middleware';

/**
 * Extension context for method operations.
 */
export interface ExtensionContext<TTarget = unknown> {
  readonly target: TTarget;
  readonly methodName: string;
  readonly originalMethod?: (...args: unknown[]) => unknown;
}

/**
 * Middleware function type for method interception.
 */
export type MiddlewareFunction<TArgs extends unknown[] = unknown[], TReturn = unknown> = (
  next: (...args: TArgs) => TReturn | Promise<TReturn>,
  ...args: TArgs
) => TReturn | Promise<TReturn>;

/**
 * Type utility for adding a new method to an API.
 */
export type WithAddedMethod<T, K extends string, V> = T & Record<K, V>;

/**
 * Type utility for overriding an existing method in an API.
 */
export type WithOverriddenMethod<T, K extends keyof T, V> = Omit<T, K> & Record<K, V>;

/**
 * Type utility for capturing extension results with automatic type inference.
 */
export type ExtensionResult<TTarget, TExtensions> = TTarget & TExtensions;

/**
 * Type utility for inferring method additions from extension callbacks.
 */
export type InferAddedMethods<T> = T extends {
  addMethod: <K extends string, V>(name: K, method: V) => infer R;
}
  ? R extends WithAddedMethod<unknown, infer K, infer V>
    ? Record<K, V>
    : object
  : object;

/**
 * Type utility for inferring method overrides from extension callbacks.
 */
export type InferOverriddenMethods<T> = T extends {
  override: <K extends keyof unknown, V>(name: K, method: V) => infer R;
}
  ? R extends WithOverriddenMethod<unknown, infer K, infer V>
    ? Record<K, V>
    : object
  : object;

/**
 * Type utility for creating a chainable API where methods return the API itself.
 */
export type ChainableAPI<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Return
    ? Return extends number
      ? (...args: Args) => ChainableAPI<T> & { value: Return }
      : T[K]
    : T[K];
};

/**
 * Type utility for fluent method chaining.
 */
export type FluentChain<T> = T & {
  chain: (value: number) => ChainableResult<T>;
};

/**
 * Type for chainable result with value access.
 */
export type ChainableResult<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => number
    ? (...args: Args) => ChainableResult<T>
    : never;
} & {
  value: number;
};

/**
 * Override a method in the target API.
 * @param target - Target API object
 * @param methodName - Name of the method to override
 * @param newMethod - New method implementation
 */
export function override<T extends Record<string, unknown>, K extends keyof T, V>(
  target: T,
  methodName: K,
  newMethod: V
): WithOverriddenMethod<T, K, V> {
  const result = { ...target };
  result[methodName] = newMethod as T[K];
  return result as WithOverriddenMethod<T, K, V>;
}

/**
 * Extend a method by wrapping it with additional functionality.
 * @param target - Target API object
 * @param methodName - Name of the method to extend
 * @param wrapper - Wrapper function that receives the original method
 */
export function extend<T extends Record<string, unknown>>(
  target: T,
  methodName: keyof T,
  wrapper: (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown
): T {
  const result = { ...target };
  const originalMethod = target[methodName] as (...args: unknown[]) => unknown;

  if (typeof originalMethod === 'function') {
    result[methodName] = wrapper(originalMethod) as T[keyof T];
  } else {
    throw new Error(`Method '${String(methodName)}' is not a function`);
  }

  return result;
}

/**
 * Add method overloads by creating a dispatcher function.
 * @param target - Target API object
 * @param methodName - Name of the method to overload
 * @param overloads - Array of overload functions with their conditions
 */
export function overload<T extends Record<string, unknown>>(
  target: T,
  methodName: keyof T,
  overloads: Array<{
    condition: (...args: unknown[]) => boolean;
    implementation: (...args: unknown[]) => unknown;
  }>
): T {
  const result = { ...target };
  const originalMethod = target[methodName] as (...args: unknown[]) => unknown;

  const dispatcher = (...args: unknown[]): unknown => {
    // Try overloads first
    for (const overload of overloads) {
      if (overload.condition(...args)) {
        return overload.implementation(...args);
      }
    }

    // Fall back to original method if no overload matches
    if (typeof originalMethod === 'function') {
      return originalMethod(...args);
    }

    throw new Error(`No matching overload found for method '${String(methodName)}'`);
  };

  result[methodName] = dispatcher as T[keyof T];
  return result;
}

/**
 * Add middleware to a method for interception and modification.
 * @param target - Target API object
 * @param methodName - Name of the method to add middleware to
 * @param middleware - Middleware function
 */
export function addMiddleware<T extends Record<string, unknown>>(
  target: T,
  methodName: keyof T,
  middleware: MiddlewareFunction
): T {
  const result = { ...target };
  const originalMethod = target[methodName] as (...args: unknown[]) => unknown;

  if (typeof originalMethod !== 'function') {
    throw new Error(`Method '${String(methodName)}' is not a function`);
  }

  const wrappedMethod = (...args: unknown[]): unknown => {
    const next = (...nextArgs: unknown[]): unknown => originalMethod(...nextArgs);
    return middleware(next, ...args);
  };

  result[methodName] = wrappedMethod as T[keyof T];
  return result;
}

/**
 * Add a new method to the target API.
 * @param target - Target API object
 * @param methodName - Name of the new method
 * @param method - Method implementation
 */
export function addMethod<T extends Record<string, unknown>, K extends string, V>(
  target: T,
  methodName: K,
  method: V
): WithAddedMethod<T, K, V> {
  const result = { ...target, [methodName]: method };
  return result as WithAddedMethod<T, K, V>;
}

/**
 * Creates a typed extension helper that captures all applied extensions.
 * This allows TypeScript to automatically infer the final type.
 */
type TypedExtensionHelper<T extends Record<string, unknown>> = {
  addMethod<K extends string, V>(
    methodName: K,
    method: V
  ): TypedExtensionHelper<T> & { __extensions: WithAddedMethod<T, K, V> };
  override<K extends keyof T, V>(
    methodName: K,
    newMethod: V
  ): TypedExtensionHelper<T> & { __extensions: WithOverriddenMethod<T, K, V> };
  build(): T;
};

export function createTypedExtensionHelper<T extends Record<string, unknown>>(
  target: T
): TypedExtensionHelper<T> {
  let currentTarget = target;

  const helper: TypedExtensionHelper<T> = {
    addMethod<K extends string, V>(
      methodName: K,
      method: V
    ): TypedExtensionHelper<T> & { __extensions: WithAddedMethod<T, K, V> } {
      currentTarget = addMethod(currentTarget, methodName, method) as T;
      return helper as TypedExtensionHelper<T> & { __extensions: WithAddedMethod<T, K, V> };
    },

    override<K extends keyof T, V>(
      methodName: K,
      newMethod: V
    ): TypedExtensionHelper<T> & { __extensions: WithOverriddenMethod<T, K, V> } {
      currentTarget = override(currentTarget, methodName, newMethod) as T;
      return helper as TypedExtensionHelper<T> & { __extensions: WithOverriddenMethod<T, K, V> };
    },

    build(): T {
      return currentTarget;
    },
  };

  return helper;
}

/**
 * Extends an API with additional methods while preserving type safety.
 * This is the recommended way to extend plugin APIs in extensions.
 * @param baseApi - The base API to extend
 * @param extensions - Object containing the new methods/properties
 * @returns New API object with merged types
 */
export function extendApi<TApi, TExtensions extends Record<string, unknown>>(
  baseApi: TApi,
  extensions: TExtensions
): TApi & TExtensions {
  return { ...baseApi, ...extensions } as TApi & TExtensions;
}

/**
 * Extension helper interface for fluent chaining.
 */
interface ExtensionHelper<T extends Record<string, unknown>> {
  override(methodName: keyof T, newMethod: (...args: unknown[]) => unknown): ExtensionHelper<T>;
  extend(
    methodName: keyof T,
    wrapper: (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown
  ): ExtensionHelper<T>;
  overload(
    methodName: keyof T,
    overloads: Array<{
      condition: (...args: unknown[]) => boolean;
      implementation: (...args: unknown[]) => unknown;
    }>
  ): ExtensionHelper<T>;
  middleware(methodName: keyof T, middleware: MiddlewareFunction): ExtensionHelper<T>;
  addMethod(methodName: string, method: (...args: unknown[]) => unknown): ExtensionHelper<T>;
  build(): T;
}

/**
 * Create a chainable API from a base API.
 * @param target - Target API object
 * @param methodName - Name for the chain method
 * @param chainMethods - Methods to add to the chainable result
 */
export function createChainableAPI<T extends Record<string, unknown>>(
  target: T,
  methodName: string,
  chainMethods: Record<string, (...args: unknown[]) => unknown>
): WithAddedMethod<T, typeof methodName, (value: number) => ChainableResult<typeof chainMethods>> {
  const chainFunction = (value: number): ChainableResult<typeof chainMethods> => {
    const createChainableResult = (currentValue: number): ChainableResult<typeof chainMethods> => {
      const result = {} as ChainableResult<typeof chainMethods>;

      // Add all chain methods
      for (const [name, fn] of Object.entries(chainMethods)) {
        (result as Record<string, unknown>)[name] = (
          ...args: unknown[]
        ): ChainableResult<typeof chainMethods> => {
          const newValue = fn(currentValue, ...args) as number;
          return createChainableResult(newValue);
        };
      }

      // Add value property
      Object.defineProperty(result, 'value', {
        get: () => currentValue,
        enumerable: true,
        configurable: false,
      });

      return result;
    };

    return createChainableResult(value);
  };

  return addMethod(target, methodName, chainFunction);
}

/**
 * Create an extension helper that provides a fluent API for method operations.
 * @param target - Target API object
 */
export function createExtensionHelper<T extends Record<string, unknown>>(
  target: T
): ExtensionHelper<T> {
  let result = { ...target };

  return {
    /**
     * Override a method.
     */
    override(methodName: keyof T, newMethod: (...args: unknown[]) => unknown): ExtensionHelper<T> {
      result = override(result, methodName, newMethod) as T;
      return this;
    },

    /**
     * Extend a method.
     */
    extend(
      methodName: keyof T,
      wrapper: (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown
    ): ExtensionHelper<T> {
      result = extend(result, methodName, wrapper);
      return this;
    },

    /**
     * Add method overloads.
     */
    overload(
      methodName: keyof T,
      overloads: Array<{
        condition: (...args: unknown[]) => boolean;
        implementation: (...args: unknown[]) => unknown;
      }>
    ): ExtensionHelper<T> {
      result = overload(result, methodName, overloads);
      return this;
    },

    /**
     * Add middleware to a method.
     */
    middleware(methodName: keyof T, middleware: MiddlewareFunction): ExtensionHelper<T> {
      result = addMiddleware(result, methodName, middleware);
      return this;
    },

    /**
     * Add a new method.
     */
    addMethod(methodName: string, method: (...args: unknown[]) => unknown): ExtensionHelper<T> {
      result = addMethod(result, methodName, method);
      return this;
    },

    /**
     * Get the final result.
     */
    build(): T {
      return result;
    },
  };
}
