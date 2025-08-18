/**
 * @file Kernel Builder Utilities
 * Contains utility functions and validation logic for the kernel builder.
 */

import type { Result } from '../../shared/types/result.types.js';
import type { Plugin, PluginRegistrationOptions } from '../../domain/plugin/plugin.types.js';
import type { KernelConfig } from '../../domain/kernel/kernel.types.js';
import { success, failure } from '../../shared/types/result.types.js';
import {
  createKernelId,
  createPluginId,
  createPluginName,
  createVersion,
} from '../../shared/types/common.types.js';
import { PluginEntity } from '../../domain/plugin/plugin.entity.js';
import { KernelEntity } from '../../domain/kernel/kernel.entity.js';
import type { IPluginBuilder } from './plugin.builder.js';

/**
 * Plugin registration entry for the builder.
 */
export interface PluginEntry<
  TName extends string = string,
  TApi = unknown,
  TDeps extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly plugin: Plugin<TName, TApi> | IPluginBuilder<TName, TApi, TDeps>;
  readonly options: PluginRegistrationOptions;
  readonly name: TName;
  readonly api: TApi;
}

/**
 * Kernel builder error class.
 */
export class KernelBuilderError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'KernelBuilderError';
    this.code = code;
    this.details = details;
  }

  static invalidPlugin(pluginName: string, reason: string): KernelBuilderError {
    return new KernelBuilderError(`Invalid plugin '${pluginName}': ${reason}`, 'INVALID_PLUGIN', {
      pluginName,
      reason,
    });
  }

  static buildFailed(reason: string): KernelBuilderError {
    return new KernelBuilderError(`Kernel build failed: ${reason}`, 'BUILD_FAILED', { reason });
  }

  static initializationFailed(reason: string): KernelBuilderError {
    return new KernelBuilderError(
      `Kernel initialization failed: ${reason}`,
      'INITIALIZATION_FAILED',
      { reason }
    );
  }
}

/**
 * Creates default kernel configuration with sensible defaults.
 */
export function createDefaultKernelConfig(overrides: Partial<KernelConfig> = {}): KernelConfig {
  return {
    autoGlobal: false,
    strictVersioning: true,
    allowCircularDependencies: false,
    maxInitializationTime: 30000,
    enableExtensions: true,
    logLevel: 'info',
    ...overrides,
  };
}

/**
 * Validates a plugin before registration.
 */
export function validatePlugin(plugin: Plugin): Result<void, KernelBuilderError> {
  if (!plugin) {
    return failure(KernelBuilderError.invalidPlugin('unknown', 'Plugin is null or undefined'));
  }

  if (!plugin.name || typeof plugin.name !== 'string') {
    return failure(
      KernelBuilderError.invalidPlugin(
        plugin.name || 'unknown',
        'Plugin name is required and must be a string'
      )
    );
  }

  if (!plugin.version || typeof plugin.version !== 'string') {
    return failure(
      KernelBuilderError.invalidPlugin(
        plugin.name,
        'Plugin version is required and must be a string'
      )
    );
  }

  if (!plugin.setup || typeof plugin.setup !== 'function') {
    return failure(
      KernelBuilderError.invalidPlugin(plugin.name, 'Plugin setup function is required')
    );
  }

  return success(undefined);
}

/**
 * Converts a Plugin to a PluginEntity.
 */
export function convertPluginToEntity<
  TName extends string,
  TApi,
  TDeps extends Record<string, unknown> = Record<string, unknown>,
>(
  plugin: Plugin<TName, TApi> | IPluginBuilder<TName, TApi, TDeps>,
  options: PluginRegistrationOptions = {}
): PluginEntry<TName, TApi, TDeps> {
  const pluginName = typeof plugin === 'object' && 'name' in plugin ? plugin.name : 'unknown';

  return {
    plugin,
    options,
    name: pluginName as TName,
    api: undefined as TApi,
  };
}

/**
 * Converts a Plugin to a PluginEntity for internal use.
 */
export function convertPluginToPluginEntity<
  TName extends string,
  TApi,
  TDeps extends Record<string, unknown> = Record<string, unknown>,
>(plugin: Plugin<TName, TApi> | IPluginBuilder<TName, TApi, TDeps>): PluginEntity {
  let actualPlugin: Plugin<unknown, Record<string, unknown>>;

  // If it's a builder, build it first
  if ('build' in plugin && typeof plugin.build === 'function') {
    const buildResult = (
      plugin as IPluginBuilder<string, unknown, Record<string, unknown>>
    ).build();
    if (!buildResult.success) {
      throw new Error(`Failed to build plugin: ${buildResult.error.message}`);
    }
    actualPlugin = buildResult.data;
  } else {
    actualPlugin = plugin as Plugin<unknown, Record<string, unknown>>;
  }

  return new PluginEntity(
    createPluginId(`${actualPlugin.name}-${Date.now()}`),
    createPluginName(actualPlugin.name),
    createVersion(actualPlugin.version),
    actualPlugin.setup,
    actualPlugin.dependencies || [],
    actualPlugin.extensions || [],
    actualPlugin.destroy
  );
}

/**
 * Registers all plugins in a kernel.
 */
export function registerPluginsInKernel<TName extends string = string, TApi = unknown>(
  kernel: KernelEntity,
  pluginEntries: readonly PluginEntry<TName, TApi>[]
): Result<void, KernelBuilderError> {
  for (const { plugin } of pluginEntries) {
    const pluginEntity = convertPluginToPluginEntity(
      plugin as
        | Plugin<string, Record<string, unknown>>
        | IPluginBuilder<string, Record<string, unknown>, Record<string, unknown>>
    );
    const registerResult = kernel.registerPlugin(pluginEntity);

    if (!registerResult.success) {
      return failure(
        KernelBuilderError.buildFailed(
          `Failed to register plugin '${plugin.name}': ${registerResult.error.message}`
        )
      );
    }
  }

  return success(undefined);
}

/**
 * Creates a new kernel instance with the given configuration.
 */
export function createKernelInstance(config: KernelConfig): KernelEntity {
  const kernelId = createKernelId(`kernel-${Date.now()}`);
  return new KernelEntity(kernelId, config);
}
