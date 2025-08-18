/* eslint-disable @typescript-eslint/no-empty-object-type */
/**
 * @file Kernel Builder API
 * Defines interfaces and factory functions for the kernel builder.
 * Implements the new API: createKernel().use().build().init()
 */

import type { Result } from '../../shared/types/result.types.js';
import type { KernelConfig } from '../../domain/kernel/kernel.types.js';
import type { Plugin, PluginRegistrationOptions } from '../../domain/plugin/plugin.types.js';
import { KernelEntity } from '../../domain/kernel/kernel.entity.js';
import { KernelBuilderImpl } from './kernel.builder.impl.js';
import { KernelBuilderError } from './kernel.builder.utils.js';
import { getGlobalContainer, type ServiceContainer } from '../../infrastructure/di/container.js';
import type { IPluginBuilder } from './plugin.builder.js';

// Re-export for convenience
export { KernelBuilderError } from './kernel.builder.utils.js';

/**
 * Built kernel interface that provides init() method.
 */
export interface IBuiltKernel<TPlugins extends Record<string, unknown> = Record<string, unknown>> {
  /**
   * Initializes the kernel and all registered plugins.
   * @returns Promise with initialized kernel (throws on error)
   */
  init(): Promise<import('../../domain/kernel/kernel.types.js').Kernel<TPlugins>>;
}

/**
 * Kernel builder interface following new API specification.
 */
export interface IKernelBuilder<
  TPlugins extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * Enables automatic global kernel registration.
   */
  withAutoGlobal(enabled?: boolean): this;

  /**
   * Enables strict version checking for dependencies.
   */
  withStrictVersioning(enabled?: boolean): this;

  /**
   * Allows circular dependencies between plugins.
   */
  withCircularDependencies(enabled?: boolean): this;

  /**
   * Sets maximum initialization timeout.
   */
  withInitializationTimeout(timeoutMs: number): this;

  /**
   * Enables or disables extensions.
   */
  withExtensions(enabled?: boolean): this;

  /**
   * Sets log level for kernel operations.
   */
  withLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): this;

  /**
   * Registers a plugin with the kernel.
   * @param plugin - Plugin instance or builder to register
   * @param options - Optional registration configuration
   */
  use<TName extends string, TApi, TDeps extends Record<string, unknown> = Record<string, unknown>>(
    plugin: Plugin<TName, TApi> | IPluginBuilder<TName, TApi, TDeps>,
    options?: PluginRegistrationOptions
  ): IKernelBuilder<TPlugins & Record<TName, TApi>>;

  /**
   * Registers multiple plugins at once.
   * @param plugins - Array of plugins to register
   */
  usePlugins(plugins: readonly Plugin<unknown, Record<string, unknown>>[]): this;

  /**
   * Sets custom configuration.
   * @param config - Partial kernel configuration
   */
  withConfig(config: Partial<KernelConfig>): this;

  /**
   * Builds the kernel with all registered plugins.
   * @returns Built kernel ready for initialization
   */
  build(): IBuiltKernel<TPlugins>;

  /**
   * Convenience method that combines build() and init() in a single call.
   * @returns Promise that resolves to the initialized kernel
   */
  start(): Promise<import('../../domain/kernel/kernel.types.js').Kernel<TPlugins>>;

  /**
   * Legacy method that builds and starts the kernel with Result pattern.
   * @deprecated Use start() instead
   * @returns Promise with initialized kernel or error
   */
  buildAndStart(): Promise<Result<KernelEntity, KernelBuilderError>>;
}

/**
 * Creates a new kernel builder instance.
 * @param container - Optional service container (uses global if not provided)
 * @returns New kernel builder instance
 */
export function createKernel(container?: ServiceContainer): IKernelBuilder<{}> {
  const serviceContainer = container || getGlobalContainer();
  return new KernelBuilderImpl(serviceContainer);
}

/**
 * Creates a production-optimized kernel builder.
 * @param container - Optional service container (uses global if not provided)
 * @returns Kernel builder with production defaults
 */
export function createProductionKernel(container?: ServiceContainer): IKernelBuilder<{}> {
  const serviceContainer = container || getGlobalContainer();
  return new KernelBuilderImpl(serviceContainer).withStrictVersioning(true).withLogLevel('warn');
}

/**
 * Creates a development-optimized kernel builder.
 * @param container - Optional service container (uses global if not provided)
 * @returns Kernel builder with development defaults
 */
export function createDevelopmentKernel(container?: ServiceContainer): IKernelBuilder<{}> {
  const serviceContainer = container || getGlobalContainer();
  return new KernelBuilderImpl(serviceContainer).withLogLevel('debug').withStrictVersioning(false);
}

/**
 * Creates a test-optimized kernel builder.
 * @param container - Optional service container (uses global if not provided)
 * @returns Kernel builder with test defaults
 */
export function createTestKernel(container?: ServiceContainer): IKernelBuilder<{}> {
  const serviceContainer = container || getGlobalContainer();
  return new KernelBuilderImpl(serviceContainer)
    .withLogLevel('error')
    .withStrictVersioning(false)
    .withInitializationTimeout(5000);
}

/**
 * Quick kernel creation utility for simple use cases.
 * @param plugins - Plugins to register
 * @param config - Optional configuration
 * @param container - Optional service container (uses global if not provided)
 * @returns Promise with initialized kernel or error
 */
export async function quickKernel(
  plugins: readonly Plugin[],
  config?: Partial<KernelConfig>,
  container?: ServiceContainer
): Promise<Result<KernelEntity, KernelBuilderError>> {
  const builder = createKernel(container).usePlugins(plugins);
  if (config) {
    builder.withConfig(config);
  }
  return await builder.buildAndStart();
}
