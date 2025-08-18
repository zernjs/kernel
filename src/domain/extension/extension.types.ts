/**
 * @file Extension domain types - Core type definitions for extension domain.
 * Contains all types related to plugin extension business logic.
 */

import type { PluginId, PluginName } from '../../shared/types/common.types.js';
import type { Plugin, PluginDependency } from '../plugin/plugin.types.js';

/**
 * Type-safe extension registry that tracks which plugins extend which targets
 */
export type ExtensionRegistry<T = Record<string, unknown>> = {
  [TargetPlugin in keyof T]?: Record<string, unknown>;
};

/**
 * Extension resolution context for type-safe extension application
 */
export interface ExtensionResolutionContext<TPluginMap = Record<string, unknown>> {
  readonly plugins: TPluginMap;
  readonly extensions: ExtensionRegistry<TPluginMap>;
  readonly resolutionOrder: readonly string[];
}

/**
 * Merge de plugin com suas extensões
 */
export type MergePluginWithExtensions<
  TPlugin,
  TExtensions,
  TPluginName extends string,
> = TPluginName extends keyof TExtensions ? TPlugin & TExtensions[TPluginName] : TPlugin;

/**
 * Extração de extensões de um plugin específico
 */
export type ExtractPluginExtensions<
  TExtensions extends Record<string, unknown>,
  TPluginName extends string,
> = TPluginName extends keyof TExtensions ? TExtensions[TPluginName] : never;

/**
 * Plugin type with applied extensions.
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
 * Auto-extended plugin type with proper type inference.
 */
export type AutoExtendedPlugin<TApi, TExtensions = object> = TApi & TExtensions;

/**
 * Type-safe extension application result
 */
export type ApplyExtensions<
  TBaseApi,
  TExtensions extends readonly unknown[],
> = TExtensions extends readonly [infer First, ...infer Rest]
  ? ApplyExtensions<TBaseApi & First, Rest>
  : TBaseApi;

/**
 * Extension compatibility check
 */
export type IsExtensionCompatible<TTargetApi, TExtension> = TExtension extends (
  api: TTargetApi
) => unknown
  ? true
  : false;

/**
 * Safe extension merge that preserves type information
 */
export type SafeExtensionMerge<TBase, TExtension> = TExtension extends (api: TBase) => infer R
  ? TBase & R
  : TBase;

/**
 * Extension priority levels.
 */
export enum ExtensionPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 20,
}

/**
 * Captura de extensões de um tipo
 */
export type CaptureExtensions<T> = T extends {
  extensions: infer E;
}
  ? E
  : object;

/**
 * Merge de extensões de plugin
 */
export type MergePluginExtensions<TApi, TExtensions> = TApi & TExtensions;

/**
 * Extração do resultado de uma extensão
 */
export type ExtractExtensionResult<T> =
  T extends ExtensionCallback<Record<string, unknown>, infer R> ? R : never;

/**
 * Plugin com extensões aplicadas
 */
export type PluginWithExtensions<TApi, TExtensions = Record<string, unknown>> = TApi & TExtensions;

/**
 * Merge de múltiplas extensões
 */
export type MergeExtensions<T extends readonly unknown[]> = T extends readonly [
  infer First,
  ...infer Rest,
]
  ? First & MergeExtensions<Rest>
  : Record<string, unknown>;

/**
 * Mapa de plugins estendidos
 */
export type ExtendedPluginMap<
  TBaseMap extends Record<string, unknown>,
  TExtensions extends Record<string, unknown> = Record<string, unknown>,
> = {
  [K in keyof TBaseMap]: K extends keyof TExtensions ? TBaseMap[K] & TExtensions[K] : TBaseMap[K];
};

/**
 * Extension callback function type with enhanced type safety.
 */
export type ExtensionCallback<TTargetApi = unknown, TResult = unknown> = (
  targetApi: TTargetApi
) => TResult | Promise<TResult>;

/**
 * Type-safe extension callback that ensures compatibility
 */
export type TypeSafeExtensionCallback<TTargetApi, TExtensionApi> = (
  targetApi: TTargetApi
) => TExtensionApi | Promise<TExtensionApi>;

/**
 * Extension validation function type
 */
export type ExtensionValidator<TTargetApi> = (targetApi: TTargetApi) => boolean | Promise<boolean>;

/**
 * Metadados de uma extensão
 */
export interface ExtensionMetadata {
  readonly id: string;
  readonly sourcePluginId: PluginId;
  readonly targetPluginId: PluginId;
  readonly targetPluginName: PluginName;
  readonly createdAt: Date;
  readonly appliedAt?: Date;
}

/**
 * Contexto de aplicação de extensão
 */
export interface ExtensionContext<TTargetApi = unknown> {
  readonly targetPlugin: Plugin<string, TTargetApi>;
  readonly targetApi: TTargetApi;
  readonly dependencies: Record<string, unknown>;
}

/**
 * Resultado da aplicação de uma extensão
 */
export interface ExtensionResult<TResult = unknown> {
  readonly success: boolean;
  readonly result?: TResult;
  readonly error?: Error;
  readonly executionTime: number;
  readonly metadata: ExtensionMetadata;
}

/**
 * Configuração de extensão
 */
/**
 * Extension configuration options.
 */
export interface ExtensionConfig {
  readonly priority?: ExtensionPriority;
  readonly optional?: boolean;
  readonly timeout?: number;
  readonly retries?: number;
  readonly conditions?: ExtensionCondition[];
}

/**
 * Extension condition for conditional execution.
 */
export interface ExtensionCondition {
  readonly type: 'version' | 'state' | 'config' | 'custom';
  readonly operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'matches';
  readonly value: unknown;
  readonly path?: string;
}

/**
 * Extensão completa com configuração
 */
export interface Extension<TTargetApi = unknown, TResult = unknown> {
  readonly metadata: ExtensionMetadata;
  readonly config: ExtensionConfig;
  readonly callback: ExtensionCallback<TTargetApi, TResult>;
  readonly dependencies: readonly PluginDependency[];
}
