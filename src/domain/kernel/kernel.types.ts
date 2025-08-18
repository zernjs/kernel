/**
 * @file Kernel domain types - Core type definitions for kernel domain.
 * Contains all types related to kernel business logic and configuration.
 */

import type { KernelId } from '../../shared/types/common.types.js';
import type { Plugin } from '../plugin/plugin.types.js';

/**
 * Kernel lifecycle states following domain rules.
 */
export enum KernelState {
  UNINITIALIZED = 'uninitialized',
  BUILDING = 'building',
  BUILT = 'built',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  DESTROYING = 'destroying',
  DESTROYED = 'destroyed',
  ERROR = 'error',
}

/**
 * Kernel configuration options.
 */
export interface KernelConfig {
  readonly id?: KernelId;
  readonly autoGlobal?: boolean;
  readonly strictVersioning?: boolean;
  readonly allowCircularDependencies?: boolean;
  readonly timeout?: number;
  readonly retries?: number;
  readonly debug?: boolean;
  readonly maxPlugins?: number;
  readonly maxDependencyDepth?: number;
  readonly maxInitializationTime?: number;
  readonly enableExtensions?: boolean;
  readonly logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Kernel metadata for management.
 */
export interface KernelMetadata {
  readonly id: KernelId;
  readonly version: string;
  readonly createdAt: Date;
  readonly buildAt?: Date;
  readonly initializedAt?: Date;
  readonly pluginCount: number;
  readonly dependencyCount: number;
  readonly lastModified: Date;
}

/**
 * Estado do ciclo de vida do kernel
 */
export interface KernelLifecycle {
  readonly id: KernelId;
  readonly state: KernelState;
  readonly error?: Error;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly plugins: readonly string[];
}

/**
 * Contexto de execução do kernel
 */
export interface KernelContext {
  readonly config: KernelConfig;
  readonly metadata: KernelMetadata;
  readonly lifecycle: KernelLifecycle;
}

/**
 * Mapa de plugins registrados no kernel
 */
export type PluginMap<T extends Record<string, unknown> = Record<string, unknown>> = {
  readonly [K in keyof T]: T[K];
};

/**
 * Interface principal do kernel
 */
export interface Kernel<TPlugins extends Record<string, unknown> = Record<string, unknown>> {
  readonly id: KernelId;
  readonly config: KernelConfig;
  readonly state: KernelState;
  readonly plugins: PluginMap<TPlugins>;

  get<K extends keyof TPlugins>(name: K): TPlugins[K];
  getMetadata(): KernelMetadata;
  getLifecycle(): KernelLifecycle;
  destroy(): Promise<void>;
}

/**
 * Builder do kernel para configuração fluente
 */
export interface KernelBuilder<TPlugins extends Record<string, unknown> = Record<string, unknown>> {
  use<TName extends string, TApi>(
    plugin: Plugin<TName, TApi>
  ): KernelBuilder<TPlugins & Record<TName, TApi>>;

  config(config: Partial<KernelConfig>): KernelBuilder<TPlugins>;
  build(): BuiltKernel<TPlugins>;
}

/**
 * Kernel após o build, pronto para inicialização
 */
export interface BuiltKernel<TPlugins extends Record<string, unknown> = Record<string, unknown>> {
  readonly id: KernelId;
  readonly config: KernelConfig;
  readonly state: KernelState;

  init(): Promise<Kernel<TPlugins>>;
  start(): Promise<Kernel<TPlugins>>; // Conveniência: build + init
}

/**
 * Eventos do kernel
 */
export interface KernelEvent {
  readonly type: string;
  readonly kernelId: KernelId;
  readonly timestamp: Date;
  readonly data?: unknown;
}

/**
 * Listener de eventos do kernel
 */
export type KernelEventListener = (event: KernelEvent) => void | Promise<void>;

/**
 * Registry de eventos do kernel
 */
export interface KernelEventRegistry {
  on(event: string, listener: KernelEventListener): void;
  off(event: string, listener: KernelEventListener): void;
  emit(event: KernelEvent): Promise<void>;
}
