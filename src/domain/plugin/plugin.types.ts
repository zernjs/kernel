/**
 * @file Plugin domain types - Core type definitions for plugin domain.
 * Contains all types related to plugin business logic and constraints.
 */

import type {
  PluginId,
  PluginName,
  Version,
  LifecycleState,
} from '../../shared/types/common.types.js';
import type { ExtensionCallback } from '../extension/extension.types.js';

// Re-export ExtensionCallback for external use
export type { ExtensionCallback };

/**
 * Plugin dependency specification with version constraints.
 */
export interface PluginDependency {
  readonly pluginId: PluginId;
  readonly pluginName: PluginName;
  readonly versionConstraint?: string;
  readonly isOptional: boolean;
}

/**
 * Legacy plugin dependency for backward compatibility.
 */
export interface LegacyPluginDependency<T = unknown> {
  readonly plugin: Plugin<string, T>;
  readonly version?: string;
}

/**
 * Plugin extension that modifies another plugin's API.
 */
export interface PluginExtension<TTargetApi = unknown, TResult = unknown> {
  readonly target: Plugin<TTargetApi>;
  readonly callback: ExtensionCallback<TTargetApi, TResult>;
  readonly dependencies: readonly LegacyPluginDependency[];
}

/**
 * Interface principal do plugin
 */
export interface Plugin<TApi = unknown, TDeps = Record<string, unknown>> {
  readonly id: PluginId;
  readonly name: PluginName;
  readonly version: Version;
  readonly dependencies: readonly PluginDependency[];
  readonly extensions?: readonly PluginExtension[];
  readonly setup: (dependencies: PluginDependencyContext<TDeps>) => TApi | Promise<TApi>;
  readonly destroy?: () => void | Promise<void>;
}

/**
 * Metadados do plugin
 */
export interface PluginMetadata {
  readonly id: PluginId;
  readonly name: PluginName;
  readonly version: Version;
  readonly description?: string;
  readonly author?: string;
  readonly tags?: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Estado do plugin no ciclo de vida
 */
export interface PluginLifecycle {
  readonly id: PluginId;
  readonly state: LifecycleState;
  readonly error?: Error;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
}

/**
 * Configuração de plugin
 */
export interface PluginConfig {
  readonly timeout?: number;
  readonly retries?: number;
  readonly priority?: number;
  readonly lazyLoad?: boolean;
  readonly optional?: boolean;
}

/**
 * Opções de registro de plugin
 */
export interface PluginRegistrationOptions {
  readonly config?: PluginConfig;
  readonly metadata?: Partial<PluginMetadata>;
}

/**
 * Contexto de dependências disponível no setup
 */
export interface PluginDependencyContext<TDeps = Record<string, unknown>> {
  readonly plugins: TDeps;
  readonly kernel: {
    readonly get: <K extends string>(name: K) => unknown;
  };
}

/**
 * Função de setup do plugin com contexto de dependências
 */
export type PluginSetupFunction<TApi, TDeps = Record<string, unknown>> = (
  dependencies: PluginDependencyContext<TDeps>
) => TApi | Promise<TApi>;

/**
 * Plugin com API tipada
 */
export interface TypedPlugin<TApi, TDeps = Record<string, unknown>> extends Plugin<TApi, TDeps> {
  readonly setup: PluginSetupFunction<TApi, TDeps>;
}
