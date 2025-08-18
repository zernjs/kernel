/**
 * @file Kernel Builder Implementation
 * Contains the concrete implementations of kernel builder interfaces.
 */

import type { Result } from '../../shared/types/result.types.js';
import type {
  KernelConfig,
  PluginMap,
  Kernel,
  KernelMetadata,
  KernelLifecycle,
} from '../../domain/kernel/kernel.types.js';
import { KernelState } from '../../domain/kernel/kernel.types.js';
import type { Plugin, PluginRegistrationOptions } from '../../domain/plugin/plugin.types.js';
import { KernelEntity } from '../../domain/kernel/kernel.entity.js';
import { success, failure } from '../../shared/types/result.types.js';
import { createKernelId, type KernelId } from '../../shared/types/common.types.js';
import type { IBuiltKernel, IKernelBuilder } from './kernel.builder.js';
import {
  type PluginEntry,
  KernelBuilderError,
  createDefaultKernelConfig,
  validatePlugin,
  convertPluginToEntity,
} from './kernel.builder.utils.js';
import { KernelService } from '../services/kernel.service.js';
import type { ServiceContainer } from '../../infrastructure/di/container.js';
import type { IPluginBuilder } from './plugin.builder.js';

/**
 * Implementation of the built kernel interface.
 */
export class BuiltKernelImpl<TPlugins extends Record<string, unknown> = Record<string, unknown>>
  implements IBuiltKernel<TPlugins>, Kernel<TPlugins>
{
  private pluginInstances = {} as TPlugins;
  private initialized = false;

  constructor(
    private readonly kernel: KernelEntity,
    private readonly kernelService: KernelService,
    private readonly pluginEntries: Array<PluginEntry<string, unknown>>
  ) {}

  // Implement Kernel interface properties
  get id(): KernelId {
    return this.kernel.id;
  }
  get config(): KernelConfig {
    return this.kernel.config;
  }
  get state(): KernelState {
    return this.initialized ? KernelState.INITIALIZED : KernelState.BUILT;
  }
  get plugins(): PluginMap<TPlugins> {
    return this.pluginInstances as PluginMap<TPlugins>;
  }

  // Implement Kernel interface methods
  get<K extends keyof TPlugins>(name: K): TPlugins[K] {
    const plugin = this.pluginInstances[name];
    if (plugin === undefined) {
      throw new Error(`Plugin '${String(name)}' not found`);
    }
    return plugin;
  }

  getMetadata(): KernelMetadata {
    return {
      id: this.kernel.id,
      version: '1.0.0',
      createdAt: new Date(),
      pluginCount: Object.keys(this.pluginInstances).length,
      dependencyCount: 0,
      lastModified: new Date(),
    };
  }

  getLifecycle(): KernelLifecycle {
    return {
      id: this.kernel.id,
      state: this.state,
      plugins: Object.keys(this.pluginInstances),
    };
  }

  async destroy(): Promise<void> {
    // Clean up plugins
    this.pluginInstances = {} as TPlugins;
  }

  async init(): Promise<Kernel<TPlugins>> {
    // Initialize plugins with dependency injection
    await this.initializePlugins();
    this.initialized = true;

    // Return this instance as it now implements Kernel<TPlugins>
    return this;
  }

  private async initializePlugins(): Promise<void> {
    const builtPlugins: {
      plugin: Plugin<unknown, Record<string, unknown>>;
      entry: PluginEntry<string, unknown>;
    }[] = [];

    // Build plugins from builders first
    for (const entry of this.pluginEntries) {
      const { plugin } = entry;
      let actualPlugin: Plugin<unknown, Record<string, unknown>>;

      // If it's a plugin builder, build it first
      if ('build' in plugin && typeof plugin.build === 'function') {
        const buildResult = (plugin as IPluginBuilder).build();
        if (!buildResult.success) {
          throw new Error(`Failed to build plugin: ${buildResult.error.message}`);
        }
        actualPlugin = buildResult.data as Plugin<unknown, Record<string, unknown>>;
      } else {
        actualPlugin = plugin as Plugin<unknown, Record<string, unknown>>;
      }

      builtPlugins.push({ plugin: actualPlugin, entry });
    }

    // Initialize plugins in dependency order
    for (const { plugin, entry } of builtPlugins) {
      if (plugin.setup) {
        // Create dependency context
        const deps = {
          plugins: this.createPluginDependencies(plugin),
          kernel: {
            get: <K extends keyof TPlugins>(name: K): TPlugins[K] | undefined =>
              this.pluginInstances[name],
          },
        };

        // Call setup with dependency context
        const api = await plugin.setup(deps);
        // Use the plugin name from the entry to maintain type consistency
        const pluginName = entry.name || plugin.name;
        (this.pluginInstances as Record<string, unknown>)[pluginName] = api;
      }
    }
  }

  private createPluginDependencies(plugin: Plugin): Record<string, unknown> {
    const deps: Record<string, unknown> = {};

    for (const dependency of plugin.dependencies) {
      const depInstance = (this.pluginInstances as Record<string, unknown>)[dependency.pluginName];
      if (depInstance) {
        deps[dependency.pluginName] = depInstance;
      }
    }

    return deps;
  }
}

/**
 * Implementation of the kernel builder interface.
 */
export class KernelBuilderImpl<TPlugins extends Record<string, unknown> = Record<string, unknown>>
  implements IKernelBuilder<TPlugins>
{
  private config: Partial<KernelConfig> = {};
  private readonly pluginEntries: Array<PluginEntry<string, unknown, Record<string, unknown>>> = [];
  private readonly pluginTypeRegistry = new Map<string, unknown>();

  constructor(private readonly serviceContainer: ServiceContainer) {}

  /**
   * Extracts plugin name in a type-safe way
   */
  private extractPluginName<
    TName extends string,
    TApi,
    TDeps extends Record<string, unknown> = Record<string, unknown>,
  >(plugin: Plugin<TName, TApi> | IPluginBuilder<TName, TApi, TDeps>): string {
    if ('name' in plugin && typeof plugin.name === 'string') {
      return plugin.name;
    }

    // For IPluginBuilder, check if it has a pluginName property
    const builderPlugin = plugin as unknown as { pluginName?: string };
    if (builderPlugin.pluginName && typeof builderPlugin.pluginName === 'string') {
      return builderPlugin.pluginName;
    }

    // Fallback to 'unknown' if we can't determine the name
    return 'unknown';
  }

  withAutoGlobal(enabled = true): this {
    this.config = { ...this.config, autoGlobal: enabled };
    return this;
  }

  withStrictVersioning(enabled = true): this {
    this.config = { ...this.config, strictVersioning: enabled };
    return this;
  }

  withCircularDependencies(enabled = true): this {
    this.config = { ...this.config, allowCircularDependencies: enabled };
    return this;
  }

  withInitializationTimeout(timeoutMs: number): this {
    if (timeoutMs <= 0) {
      throw new Error('Initialization timeout must be positive');
    }
    this.config = { ...this.config, maxInitializationTime: timeoutMs };
    return this;
  }

  withExtensions(enabled = true): this {
    this.config = { ...this.config, enableExtensions: enabled };
    return this;
  }

  withLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): this {
    this.config = { ...this.config, logLevel: level };
    return this;
  }

  use<TName extends string, TApi, TDeps extends Record<string, unknown> = Record<string, unknown>>(
    plugin: Plugin<TName, TApi> | IPluginBuilder<TName, TApi, TDeps>,
    options: PluginRegistrationOptions = {}
  ): IKernelBuilder<TPlugins & Record<TName, TApi>> {
    // Extract plugin name in a type-safe way
    const pluginName = this.extractPluginName<TName, TApi, TDeps>(plugin);

    // Convert plugin to entity with proper types
    const pluginEntity = convertPluginToEntity<TName, TApi, TDeps>(plugin, options);

    // Store the plugin with preserved types
    this.pluginEntries.push(pluginEntity as PluginEntry<string, unknown, Record<string, unknown>>);

    // Register the plugin type for better inference
    this.pluginTypeRegistry.set(pluginName, plugin);

    return this as IKernelBuilder<TPlugins & Record<TName, TApi>>;
  }

  usePlugins(plugins: readonly Plugin<unknown, Record<string, unknown>>[]): this {
    for (const plugin of plugins) {
      this.use(plugin as Plugin<string, Record<string, unknown>>);
    }
    return this;
  }

  withConfig(config: Partial<KernelConfig>): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  build(): IBuiltKernel<TPlugins> {
    try {
      const finalConfig = createDefaultKernelConfig(this.config);

      // Create a simple kernel entity for now
      const kernelId = createKernelId(`kernel-${Date.now()}`);
      const kernel = new KernelEntity(kernelId, finalConfig);

      // Validate plugins (build them first if they are builders)
      for (const { plugin } of this.pluginEntries) {
        let actualPlugin: Plugin<unknown, Record<string, unknown>>;

        if ('build' in plugin && typeof plugin.build === 'function') {
          const buildResult = (plugin as IPluginBuilder).build();
          if (!buildResult.success) {
            throw KernelBuilderError.buildFailed(
              `Failed to build plugin: ${buildResult.error.message}`
            );
          }
          actualPlugin = buildResult.data as Plugin<unknown, Record<string, unknown>>;
        } else {
          actualPlugin = plugin as Plugin<unknown, Record<string, unknown>>;
        }

        const validationResult = validatePlugin(actualPlugin);
        if (!validationResult.success) {
          throw KernelBuilderError.buildFailed(
            `Plugin '${actualPlugin.name}' validation failed: ${validationResult.error.message}`
          );
        }
      }

      return new BuiltKernelImpl<TPlugins>(
        kernel,
        this.serviceContainer.kernelService,
        this.pluginEntries
      );
    } catch (error) {
      throw KernelBuilderError.buildFailed(error instanceof Error ? error.message : String(error));
    }
  }

  async start(): Promise<Kernel<TPlugins>> {
    const builtKernel = this.build();
    return await builtKernel.init();
  }

  /**
   * @deprecated Use start() instead
   */
  async buildAndStart(): Promise<Result<KernelEntity, KernelBuilderError>> {
    try {
      const kernel = await this.start();
      // Convert Kernel back to KernelEntity for compatibility
      const kernelEntity = new KernelEntity(kernel.id, kernel.config);
      return success(kernelEntity);
    } catch (error) {
      return failure(
        KernelBuilderError.buildFailed(error instanceof Error ? error.message : String(error))
      );
    }
  }
}
