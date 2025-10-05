/**
 * @file API helpers for combining implementations
 * @description Generic, strongly-typed helpers for auto-binding and API creation
 */

type AnyFunction = (...args: unknown[]) => unknown;

type MethodNames<T> = {
  [K in keyof T]: T[K] extends AnyFunction ? K : never;
}[keyof T];

type MethodsOnly<T> = Pick<T, MethodNames<T>>;

type BoundMethods<T> = {
  [K in keyof MethodsOnly<T>]: T[K];
};

/**
 * Binds all methods of an instance to the instance context
 * @param instance - Class instance to bind methods from
 * @param excludeMethods - Method names to exclude from binding
 * @returns Object with all bound methods
 */
export function bindMethods<T extends object>(
  instance: T,
  excludeMethods: readonly string[] = ['constructor']
): BoundMethods<T> {
  const boundMethods = {} as BoundMethods<T>;

  const allMethods = new Set<string>();

  Object.getOwnPropertyNames(instance).forEach(name => {
    const value = (instance as Record<string, unknown>)[name];
    if (typeof value === 'function' && !excludeMethods.includes(name)) {
      allMethods.add(name);
    }
  });

  Object.getOwnPropertyNames(Object.getPrototypeOf(instance)).forEach(name => {
    const value = (instance as Record<string, unknown>)[name];
    if (typeof value === 'function' && !excludeMethods.includes(name)) {
      allMethods.add(name);
    }
  });

  allMethods.forEach(methodName => {
    const method = (instance as Record<string, unknown>)[methodName] as AnyFunction;
    (boundMethods as Record<string, AnyFunction>)[methodName] = method.bind(instance);
  });

  return boundMethods;
}

/**
 * Combines multiple implementation instances into a single API object
 * @param implementations - Array of class instances to combine
 * @returns Combined API with all methods from all implementations
 */
export function combineImplementations<T = Record<string, AnyFunction>>(
  ...implementations: readonly object[]
): T {
  const combined = {} as Record<string, AnyFunction>;

  implementations.forEach(impl => {
    const boundMethods = bindMethods(impl);
    Object.assign(combined, boundMethods);
  });

  return combined as T;
}

/**
 * Creates a typed API by combining implementations with optional overrides
 * @param implementations - Array of class instances to combine
 * @param overrides - Optional methods to override or add
 * @returns Typed API with combined methods and overrides
 */
export function createAPI<T>(implementations: readonly object[], overrides: Partial<T> = {}): T {
  const combined = combineImplementations<T>(...implementations);
  return { ...combined, ...overrides };
}

/**
 * Creates a factory function for a specific API type
 * @param implementations - Array of class constructors or factory functions
 * @returns Factory function that creates the API with optional config
 */
export function createAPIFactory<T, TConfig = Record<string, unknown>>(
  implementations: readonly (() => object)[]
): (config?: TConfig) => T {
  return (config?: TConfig) => {
    const instances = implementations.map(factory => factory());

    if (config) {
      instances.forEach(instance => {
        if (instance && typeof instance === 'object' && 'configure' in instance) {
          const configureMethod = (instance as { configure: (config: TConfig) => void }).configure;
          if (typeof configureMethod === 'function') {
            configureMethod(config);
          }
        }
      });
    }

    return combineImplementations<T>(...instances);
  };
}

/**
 * Helper for creating extension functions that augment existing APIs
 * @param baseAPI - The base API to extend
 * @param extensions - Object with extension methods
 * @returns Extended API with both base and extension methods
 */
export function extendAPI<TBase, TExt>(baseAPI: TBase, extensions: TExt): TBase & TExt {
  return { ...baseAPI, ...extensions };
}

/**
 * Type-safe method picker - extracts specific methods from an implementation
 * @param instance - Instance to pick methods from
 * @param methodNames - Array of method names to pick
 * @returns Object with only the specified methods
 */
export function pickMethods<T extends object, K extends keyof MethodsOnly<T>>(
  instance: T,
  methodNames: readonly K[]
): Pick<MethodsOnly<T>, K> {
  const boundMethods = bindMethods(instance);
  const picked = {} as Pick<MethodsOnly<T>, K>;

  methodNames.forEach(methodName => {
    if (methodName in boundMethods) {
      (picked as Record<string, AnyFunction>)[methodName as string] = (
        boundMethods as Record<string, AnyFunction>
      )[methodName as string];
    }
  });

  return picked;
}
