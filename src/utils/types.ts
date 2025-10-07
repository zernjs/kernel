/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Type utilities for advanced TypeScript operations
 * @description Provides reusable type-level functions for the kernel
 */

import type { BuiltPlugin } from '@/plugin';

/**
 * Extracts the plugin name from a BuiltPlugin type
 */
export type PluginNameOf<P> =
  P extends BuiltPlugin<infer N, any, any, any, any> ? (N extends string ? N : never) : never;

/**
 * Extracts the extension map from a BuiltPlugin type
 */
export type PluginExtMapOf<P> = P extends BuiltPlugin<string, any, infer M, any, any> ? M : never;

/**
 * Extracts the metadata type from a BuiltPlugin type
 */
export type PluginMetadataOf<P> = P extends BuiltPlugin<string, any, any, infer M, any> ? M : never;

/**
 * Gets extensions for a specific target plugin
 */
export type ExtFor<P, Target extends string> =
  PluginExtMapOf<P> extends Record<string, unknown>
    ? Target extends keyof PluginExtMapOf<P>
      ? PluginExtMapOf<P>[Target]
      : unknown
    : unknown;

/**
 * Converts a union type to an intersection type
 * Example: UnionToIntersection<{ a: string } | { b: number }> = { a: string } & { b: number }
 */
export type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I
) => void
  ? I
  : never;

/**
 * Extracts the API type for a plugin with a specific name
 */
export type ApiForName<U, Name extends string> =
  Extract<U, BuiltPlugin<Name, any, any, any, any>> extends infer Match
    ? Match extends BuiltPlugin<Name, infer A, any, any, any>
      ? A
      : never
    : never;

/**
 * Extracts the metadata type for a plugin with a specific name
 */
export type MetadataForName<U, Name extends string> =
  Extract<U, BuiltPlugin<Name, any, any, any, any>> extends infer Match
    ? Match extends BuiltPlugin<Name, any, any, infer M, any>
      ? M
      : never
    : never;

/**
 * Extracts the store type for a plugin with a specific name
 */
export type StoreForName<U, Name extends string> =
  Extract<U, BuiltPlugin<Name, any, any, any, any>> extends infer Match
    ? Match extends BuiltPlugin<Name, any, any, any, infer S>
      ? S
      : Record<string, any>
    : Record<string, any>;

/**
 * Computes all extensions that apply to a plugin with a specific name
 */
export type ExtensionsForName<U, Name extends string> = UnionToIntersection<ExtFor<U, Name>>;

/**
 * Computes the final plugin map with all APIs and their extensions
 */
export type PluginsMap<U> = { [K in PluginNameOf<U>]: ApiForName<U, K> & ExtensionsForName<U, K> };

/**
 * Plugin with metadata - combines API with plugin metadata (name, version, id, custom metadata)
 */
export type PluginWithMetadata<TApi, TName extends string, TVersion, TId, TMetadata> = TApi & {
  readonly $meta: {
    readonly name: TName;
    readonly version: TVersion;
    readonly id: TId;
  } & TMetadata;
};

/**
 * Extracts the metadata type from a dependency
 */
type ExtractMetadata<T> = T extends { __meta__?: infer M } ? M : Record<string, never>;

/**
 * Removes the __meta__ marker from the API type
 */
type CleanApi<T> = T extends { __meta__?: unknown } ? Omit<T, '__meta__'> : T;

/**
 * Adds $meta to each plugin dependency (for lifecycle hooks)
 * Each plugin will have: API & { $meta: { name, version, id, ...customMetadata } }
 */
export type DepsWithMetadata<TDeps> = {
  [K in keyof TDeps]: CleanApi<TDeps[K]> & {
    readonly $meta: {
      readonly name: K;
      readonly version: unknown;
      readonly id: unknown;
    } & ExtractMetadata<TDeps[K]>;
  };
};

/**
 * Computes the final plugin map with APIs, extensions, and metadata for lifecycle hooks
 */
export type PluginsMapWithMetadata<U> = {
  [K in PluginNameOf<U>]: PluginWithMetadata<
    ApiForName<U, K> & ExtensionsForName<U, K>,
    K,
    Extract<U, BuiltPlugin<K, any, any, any, any>>['version'],
    Extract<U, BuiltPlugin<K, any, any, any, any>>['id'],
    MetadataForName<U, K>
  >;
};

/**
 * Plugin access for proxy context - combines API with $store and $meta
 */
export type ProxyPluginAccess<TApi, TStore extends Record<string, any>, TMetadata> = TApi & {
  readonly $store: import('@/store').Store<TStore>;
  readonly $meta: TMetadata & {
    readonly name: string;
    readonly version: string;
  };
};

/**
 * Computes the plugins map for kernel proxy context with $store and $meta access
 */
export type ProxyPluginsMapForKernel<U> = {
  [K in PluginNameOf<U>]: ProxyPluginAccess<
    ApiForName<U, K> & ExtensionsForName<U, K>,
    StoreForName<U, K>,
    MetadataForName<U, K>
  >;
};

/**
 * Computes the plugins map for kernel.get() with $store and $meta access
 * Similar to ProxyPluginAccess but for direct kernel access
 */
export type KernelPluginsMap<U> = {
  [K in PluginNameOf<U>]: ProxyPluginAccess<
    ApiForName<U, K> & ExtensionsForName<U, K>,
    StoreForName<U, K>,
    MetadataForName<U, K>
  >;
};
