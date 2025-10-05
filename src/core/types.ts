/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Store } from '@/store';

export type PluginId = string & { readonly __brand: 'PluginId' };
export type KernelId = string & { readonly __brand: 'KernelId' };
export type Version = string & { readonly __brand: 'Version' };

export interface KernelContext {
  readonly id: KernelId;
  readonly config: KernelConfig;
  readonly get: <T>(pluginId: string) => T;
}

export interface KernelConfig {
  readonly autoGlobal?: boolean;
  readonly strictVersioning?: boolean;
  readonly circularDependencies?: boolean;
  readonly initializationTimeout?: number;
  readonly extensionsEnabled?: boolean;
  readonly logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export enum PluginState {
  UNLOADED = 'UNLOADED',
  LOADING = 'LOADING',
  LOADED = 'LOADED',
  ERROR = 'ERROR',
}

export interface PluginMetadata {
  readonly id: PluginId;
  readonly name: string;
  readonly version: Version;
  readonly state: PluginState;
  readonly dependencies: readonly PluginDependency[];
  readonly extensions: readonly PluginExtension[];

  readonly proxies: readonly any[];
}

export interface PluginDependency {
  readonly pluginId: PluginId;
  readonly versionRange: string;
}

export interface PluginExtension {
  readonly targetPluginId: PluginId;
  readonly extensionFn: (api: unknown) => unknown;
}

export interface LifecycleHookContext<
  TDepsWithMeta = Record<string, unknown>,
  TStore extends Record<string, any> = Record<string, never>,
  TApi = unknown,
> {
  readonly pluginName: string;
  readonly pluginId: PluginId;
  readonly kernel: KernelContext;
  readonly plugins: TDepsWithMeta;
  readonly store: Store<TStore>;
  readonly api?: TApi;
}

export type LifecycleHook<
  TDeps = Record<string, unknown>,
  TStore extends Record<string, any> = Record<string, never>,
  TApi = unknown,
> = (context: LifecycleHookContext<TDeps, TStore, TApi>) => void | Promise<void>;

export interface PluginLifecycleHooks<
  TDeps = Record<string, unknown>,
  TStore extends Record<string, any> = Record<string, never>,
  TApi = unknown,
> {
  readonly onInit?: LifecycleHook<TDeps, TStore, never>;
  readonly onReady?: LifecycleHook<TDeps, TStore, TApi>;
  readonly onShutdown?: LifecycleHook<TDeps, TStore, TApi>;
  readonly onError?: (
    error: Error,
    context: LifecycleHookContext<TDeps, TStore, never>
  ) => void | Promise<void>;
}

/**
 * Creates a branded PluginId from a string.
 *
 * @param value - String identifier for the plugin
 * @returns Branded PluginId type
 */
export function createPluginId(value: string): PluginId {
  return value as PluginId;
}

/**
 * Creates a branded KernelId from a string.
 *
 * @param value - String identifier for the kernel
 * @returns Branded KernelId type
 */
export function createKernelId(value: string): KernelId {
  return value as KernelId;
}

/**
 * Creates a branded Version from a semantic version string.
 *
 * @param value - Semantic version string (e.g., "1.2.3")
 * @returns Branded Version type
 * @throws Error if version format is invalid
 *
 * @example
 * ```typescript
 * const version = createVersion('1.0.0');
 * const versionWithPrerelease = createVersion('2.0.0-beta.1');
 * ```
 */
export function createVersion(value: string): Version {
  if (!isValidVersion(value)) {
    throw new Error(`Invalid version: ${value}`);
  }
  return value as Version;
}

function isValidVersion(version: string): boolean {
  const semverRegex = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/;
  return semverRegex.test(version);
}
