/**
 * @file Core type definitions for the Zern Kernel system.
 * Provides strongly typed interfaces for plugins, dependencies, and kernel operations.
 */

/**
 * Semantic version structure following semver specification.
 */
export interface SemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease?: string;
  readonly build?: string;
}

/**
 * Version constraint for dependency resolution.
 */
export interface VersionConstraint {
  readonly operator: '^' | '~' | '>=' | '<=' | '>' | '<' | '=' | '';
  readonly version: SemVer;
  readonly raw: string;
}

/**
 * Plugin dependency specification with version constraints.
 */
export interface PluginDependency<T = unknown> {
  readonly plugin: Plugin<string, T>;
  readonly version?: string;
}

/**
 * Load order constraints for plugin initialization.
 */
export interface LoadOrderConstraint {
  readonly loadBefore?: readonly string[];
  readonly loadAfter?: readonly string[];
}

/**
 * Extension callback function type.
 */
export type ExtensionCallback<TTargetApi = unknown, TResult = unknown> = (
  targetApi: TTargetApi
) => TResult | Promise<TResult>;

/**
 * Extension registry that tracks which plugins extend which targets.
 */
export type ExtensionRegistry<T = Record<string, unknown>> = {
  [TargetPlugin in keyof T]?: Record<string, unknown>;
};

/**
 * Merges a plugin's base API with its extensions
 */
export type MergePluginWithExtensions<
  TPlugin,
  TExtensions,
  TPluginName extends string,
> = TPluginName extends keyof TExtensions ? TPlugin & TExtensions[TPluginName] : TPlugin;

/**
 * Extracts extension types for a specific plugin from the extension registry
 */
export type ExtractPluginExtensions<
  TExtensions extends Record<string, unknown>,
  TPluginName extends string,
> = TPluginName extends keyof TExtensions ? TExtensions[TPluginName] : never;

/**
 * Gets the correct plugin type, merging with extensions if they exist
 */
export type GetPluginType<
  TPluginMap extends Record<string, unknown>,
  TExtensions extends Record<string, unknown>,
  K extends keyof TPluginMap,
> = K extends keyof TExtensions
  ? TExtensions[K] extends never
    ? TPluginMap[K] | undefined
    : (TPluginMap[K] & TExtensions[K]) | undefined
  : TPluginMap[K] | undefined;

/**
 * Plugin extension definition.
 */
export interface PluginExtension<TTargetApi = unknown, TResult = unknown> {
  readonly target: Plugin<string, unknown, Record<string, unknown>>;
  readonly callback: ExtensionCallback<TTargetApi, TResult>;
  readonly dependencies: readonly PluginDependency[];
}

/**
 * Core plugin interface with lifecycle hooks and metadata.
 */
export interface Plugin<
  TName extends string = string,
  TApi = unknown,
  TDeps = Record<string, unknown>,
> {
  readonly name: TName;
  readonly version: string;
  readonly dependencies: readonly PluginDependency[];
  readonly extensions?: readonly PluginExtension[];

  readonly setup: (dependencies: TDeps) => TApi | Promise<TApi>;
  readonly destroy?: () => void | Promise<void>;
}

/**
 * Kernel configuration options.
 */
export interface KernelConfig {
  readonly autoGlobal?: boolean;
  readonly strictVersioning?: boolean;
  readonly allowCircularDependencies?: boolean;
}

/**
 * Plugin registration options.
 */
export interface PluginRegistrationOptions {
  readonly loadOrder?: LoadOrderConstraint;
  readonly optional?: boolean;
}

/**
 * Dependency resolution result.
 */
export interface ResolutionResult {
  readonly success: boolean;
  readonly order: readonly string[];
  readonly conflicts: readonly DependencyConflict[];
  readonly summary: string;
}

/**
 * Types of dependency conflicts.
 */
export type ConflictType = 'version' | 'missing' | 'cycle' | 'load-order';

/**
 * Dependency conflict information.
 */
export interface DependencyConflict {
  readonly type: ConflictType;
  readonly message: string;
  readonly plugins: readonly string[];
  readonly suggestion: string;
  readonly details?: {
    readonly required?: string;
    readonly found?: string;
    readonly cycle?: readonly string[];
  };
}

/**
 * Error thrown during dependency resolution.
 */
export class DependencyError extends Error {
  constructor(
    public readonly type: ConflictType,
    public readonly details: DependencyConflict['details'],
    message?: string
  ) {
    super(message || `Dependency error: ${type}`);
    this.name = 'DependencyError';
  }
}

/**
 * Kernel state enumeration.
 */
export enum KernelState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  DESTROYING = 'destroying',
  DESTROYED = 'destroyed',
}

/**
 * Plugin state enumeration.
 */
export enum PluginState {
  REGISTERED = 'registered',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  DESTROYING = 'destroying',
  DESTROYED = 'destroyed',
}

/**
 * Type utility for automatic extension inference.
 * This captures extensions applied to plugins without manual augmentation.
 */
export type AutoExtendedPlugin<TApi, TExtensions = object> = TApi & TExtensions;

/**
 * Type utility for capturing extension results from plugin builders.
 */
export type CaptureExtensions<T> = T extends {
  extensions: infer E;
}
  ? E
  : object;

/**
 * Type utility for merging plugin API with its extensions.
 */
export type MergePluginExtensions<TApi, TExtensions> = TApi & TExtensions;

/**
 * Type utility to extract extension result type from extension callback.
 */
export type ExtractExtensionResult<T> =
  T extends ExtensionCallback<Record<string, unknown>, infer R> ? R : never;

/**
 * Type utility to track plugin extensions in the kernel.
 */
export type PluginWithExtensions<TApi, TExtensions = Record<string, unknown>> = TApi & TExtensions;

/**
 * Type utility to merge multiple extension results.
 */
export type MergeExtensions<T extends readonly unknown[]> = T extends readonly [
  infer First,
  ...infer Rest,
]
  ? First & MergeExtensions<Rest>
  : Record<string, unknown>;

/**
 * Type utility for kernel plugin map with extension tracking.
 */
export type ExtendedPluginMap<
  TBaseMap extends Record<string, unknown>,
  TExtensions extends Record<string, unknown> = Record<string, unknown>,
> = {
  [K in keyof TBaseMap]: K extends keyof TExtensions ? TBaseMap[K] & TExtensions[K] : TBaseMap[K];
};
