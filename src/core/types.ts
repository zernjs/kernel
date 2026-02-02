/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-object-type */

import { KernelBuilder } from './kernel';
import type { LifecycleManager } from './lifecycle';

export * from './security/types';

/**
 * Base type for any hook map.
 * Keys are hook names, values are hook functions.
 */
export type HookMap = { [key: string]: any };

/**
 * Supported Kernel Lifecycle Hook names.
 */
export type KernelHookName =
  | 'onInit'
  | 'onPluginSetup'
  | 'onPluginReady'
  | 'onPluginError'
  | 'onTeardown';

/**
 * Definition of Kernel Lifecycle Hooks.
 * Plugins can subscribe to these events to intercept or extend kernel behavior.
 */
export interface KernelHooks {
  /**
   * Triggered when the kernel is initialized.
   * Useful for registering core services or modifying kernel configuration before plugins load.
   */
  onInit: (kernel: any) => void | Promise<void>;

  /**
   * Triggered before a plugin's setup function is called.
   */
  onPluginSetup: (
    plugin: PluginDefinition<any, any, any, any>,
    context: any
  ) => void | Promise<void>;

  /**
   * Triggered after a plugin has been successfully set up.
   * This is where middlewares and augmentations are typically applied.
   */
  onPluginReady: (
    plugin: PluginDefinition<any, any, any, any>,
    result: any,
    pluginsMap: Record<string, AnyPluginAPI>
  ) => void | Promise<void>;

  /**
   * Triggered when an error occurs during plugin setup.
   */
  onPluginError: (
    plugin: PluginDefinition<any, any, any, any>,
    error: Error
  ) => void | Promise<void>;

  /**
   * Triggered when the kernel is shutting down.
   * Used for cleanup operations.
   */
  onTeardown: () => void | Promise<void>;
}

/**
 * Utility type to simplify the display of complex types in the editor.
 * It forces the intersection of properties to be evaluated.
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Converts a Union type to an Intersection type.
 * Useful for merging multiple dependency types into a single context.
 */
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

/**
 * Performs a shallow merge of two types.
 * Properties from B overwrite properties from A.
 */
export type Merge<A, B> = Simplify<Omit<A, keyof B> & B>;

/**
 * Performs a deep merge of two types.
 * Used for inferring the result of plugin augmentations.
 */
export type DeepMerge<T, U> = T extends object
  ? U extends object
    ? Simplify<{
        [K in keyof T | keyof U]: K extends keyof T
          ? K extends keyof U
            ? DeepMerge<T[K], U[K]>
            : T[K]
          : K extends keyof U
            ? U[K]
            : never;
      }>
    : U
  : U;

/**
 * Base type for any plugin API definition.
 */
export type AnyPluginAPI = Record<string, any>;

/**
 * Generic definition for a middleware function.
 * It receives the 'next' function and the original arguments.
 */
export type MiddlewareFn = (next: (...args: any[]) => any, ...args: any[]) => any;

/**
 * Generic map of middlewares for a plugin.
 * Keys are method names and values are middleware functions.
 */
export type MiddlewareMap = Record<string, Record<string, MiddlewareFn>>;

/**
 * Extracts the typed middleware signature for a specific function.
 * It ensures type safety for the 'next' function and arguments.
 */
export type TypedMiddlewareFor<F> = F extends (...args: infer Args) => infer Return
  ? (next: (...args: Args) => Return, ...args: Args) => Return
  : never;

/**
 * Maps a plugin API to its corresponding typed middlewares.
 */
export type PluginMiddlewares<API> = {
  [K in keyof API]?: TypedMiddlewareFor<API[K]>;
};

/**
 * Maps all dependencies in a Context to their respective middlewares.
 * Handles optional dependencies correctly.
 */
export type MiddlewaresForContext<Context> = {
  [PluginName in keyof Context]?: PluginMiddlewares<Exclude<Context[PluginName], undefined | null>>;
};

/**
 * Defines a plugin dependency.
 * Can be a direct PluginDefinition, an object with version range, or a recursive array.
 */
export type PluginDependency =
  | PluginDefinition<any, any, any, any, any>
  | { plugin: PluginDefinition<any, any, any, any, any>; range: string }
  | readonly PluginDependency[];

/**
 * Infers the API type from a PluginDefinition.
 */
export type InferPluginAPI<T> =
  T extends PluginDefinition<infer _Name, infer API, infer _Aug, infer _Deps, infer _Hooks>
    ? API
    : never;

/**
 * Infers the Augmentations type from a PluginDefinition.
 */
export type InferPluginAugmentations<T> =
  T extends PluginDefinition<infer _Name, infer _API, infer Aug, infer _Deps, infer _Hooks>
    ? Aug
    : never;

/**
 * Infers the Provided Hooks type from a PluginDefinition.
 */
export type InferPluginHooks<T> =
  T extends PluginDefinition<infer _Name, infer _API, infer _Aug, infer _Deps, infer Hooks>
    ? Hooks
    : never;

/**
 * Extracts the raw PluginDefinition from a dependency wrapper.
 */
export type UnwrapDependency<T> =
  T extends PluginDefinition<any, any, any, any, any>
    ? T
    : T extends { plugin: infer P }
      ? P
      : T extends readonly (infer U)[]
        ? UnwrapDependency<U>
        : never;

/**
 * Distributes the Plugin API extraction over a Union type.
 * Ensures that unions of plugins are processed individually.
 */
export type DistributePluginAPI<D> =
  D extends PluginDefinition<infer Name, infer API, infer _Aug, infer _Deps, infer _Hooks>
    ? { [K in Name]: API }
    : never;

/**
 * Distributes the Plugin Hooks extraction over a Union type.
 */
export type DistributePluginHooks<D> =
  D extends PluginDefinition<infer _Name, infer _API, infer _Aug, infer _Deps, infer Hooks>
    ? Hooks
    : never;

/**
 * Maps an array of dependencies to a unified Context object.
 * The resulting type is an intersection of all dependency APIs.
 */
export type DependenciesMap<Deps extends readonly PluginDependency[]> = UnionToIntersection<
  DistributePluginAPI<UnwrapDependency<Deps[number]>>
>;

/**
 * Maps an array of dependencies to a unified Hooks object.
 * The resulting type is an intersection of all dependency Hooks plus KernelHooks.
 */
export type HooksForContext<Deps extends readonly PluginDependency[]> = KernelHooks &
  UnionToIntersection<DistributePluginHooks<UnwrapDependency<Deps[number]>>>;

/**
 * The context object passed to the plugin setup function.
 * Contains the APIs of all dependencies and the Lifecycle hooks.
 */
export interface PluginContext<GlobalContext = any, GlobalHooks = KernelHooks> {
  plugins: GlobalContext;
  hooks: LifecycleManager<GlobalHooks>;
}

/**
 * Infers the Context type from a KernelBuilder instance.
 */
export type InferKernelContext<T> = T extends KernelBuilder<infer C> ? C : never;

/**
 * The result returned by a plugin setup function.
 * Can contain the API, Extensions, and Middlewares.
 */
export interface PluginSetupResult<
  API extends AnyPluginAPI,
  Extensions extends Record<string, any> = {},
  Context = {},
> {
  api?: API;
  extensions?: Extensions;
  middlewares?: MiddlewaresForContext<Context>;
}

/**
 * Defines the structure of a Plugin.
 * Includes name, version, setup function, dependencies, API versions, and provided hooks.
 */
export interface PluginDefinition<
  Name extends string,
  API extends AnyPluginAPI,
  Augmentations extends Record<string, any> = {},
  Dependencies extends readonly PluginDependency[] = [],
  ProvidedHooks = {},
> {
  name: Name;
  version: string;
  setup: (
    ctx: PluginContext<DependenciesMap<Dependencies>, HooksForContext<Dependencies> & ProvidedHooks>
  ) =>
    | API
    | Promise<API>
    | PluginSetupResult<API, Augmentations, DependenciesMap<Dependencies>>
    | Promise<PluginSetupResult<API, Augmentations, DependenciesMap<Dependencies>>>;
  apiVersions?: Record<
    string,
    (
      ctx: PluginContext<
        DependenciesMap<Dependencies>,
        HooksForContext<Dependencies> & ProvidedHooks
      >
    ) =>
      | API
      | Promise<API>
      | PluginSetupResult<API, Augmentations, DependenciesMap<Dependencies>>
      | Promise<PluginSetupResult<API, Augmentations, DependenciesMap<Dependencies>>>
  >;
  dependencies?: Dependencies;
  // Phantom properties for type inference
  __augmentations?: Augmentations;
  __providedHooks?: ProvidedHooks;
}
