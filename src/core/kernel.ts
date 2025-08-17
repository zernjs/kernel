/**
 * @file Minimalist Zern Kernel implementation.
 * Provides core plugin management with clear separation of concerns.
 */

import type { Plugin, KernelConfig, PluginRegistrationOptions, PluginExtension } from './types.js';
import { KernelState, PluginState } from './types.js';

/**
 * Internal plugin metadata for kernel management.
 */
interface PluginMetadata<TDeps = Record<string, unknown>> {
  readonly plugin: Plugin<string, unknown, TDeps>;
  readonly options: PluginRegistrationOptions;
  state: PluginState;
  api?: unknown;
}

/**
 * Fluent builder for ZernKernel configuration with typed plugin registry.
 */
export class KernelBuilder<
  TPluginMap extends Record<string, unknown> = Record<string, never>,
  TExtensions extends Record<string, unknown> = Record<string, never>,
> {
  private readonly _plugins: Plugin[] = [];
  private readonly _config: KernelConfig = {};
  private readonly _extensions: Map<string, unknown> = new Map();

  /**
   * Adds a plugin to the kernel with type accumulation.
   * @param plugin - Plugin to add
   */
  plugin<
    TName extends string,
    TApi,
    TDeps = Record<string, unknown>,
    TPluginExtensions = Record<string, never>,
  >(
    plugin: Plugin<TName, TApi, TDeps> & { extensionTargets?: TPluginExtensions }
  ): KernelBuilder<TPluginMap & Record<TName, TApi>, TExtensions & TPluginExtensions> {
    this._plugins.push(plugin as Plugin<string, unknown, Record<string, unknown>>);

    // Track extensions for this plugin
    if (plugin.extensions) {
      for (const extension of plugin.extensions) {
        const targetName =
          typeof extension.target === 'string' ? extension.target : extension.target.name;
        this._extensions.set(`${plugin.name}->${targetName}`, extension);
      }
    }

    return this as KernelBuilder<TPluginMap & Record<TName, TApi>, TExtensions & TPluginExtensions>;
  }

  /**
   * Sets kernel configuration.
   * @param config - Configuration options
   */
  config(config: KernelConfig): this {
    Object.assign(this._config, config);
    return this;
  }

  /**
   * Builds and returns the configured kernel with typed plugin access.
   */
  build(): ZernKernelInstance<TPluginMap, TExtensions> {
    const kernel = new ZernKernelInstance<TPluginMap, TExtensions>(this._config);

    // Register all plugins
    for (const plugin of this._plugins) {
      kernel.register(plugin);
    }

    return kernel;
  }
}

/**
 * Minimalist kernel implementation focused on plugin lifecycle management.
 * Delegates complex operations to specialized modules.
 */
export class ZernKernelInstance<
  TPluginMap extends Record<string, unknown> = Record<string, never>,
  TExtensions extends Record<string, unknown> = Record<string, never>,
> {
  private readonly _plugins = new Map<string, PluginMetadata<Record<string, unknown>>>();
  private readonly config: Required<KernelConfig>;
  private state: KernelState = KernelState.UNINITIALIZED;

  /**
   * Creates a new kernel instance with the specified configuration.
   * @param config - Kernel configuration options
   */
  constructor(config: KernelConfig = {}) {
    this.config = {
      autoGlobal: config.autoGlobal ?? true,
      strictVersioning: config.strictVersioning ?? true,
      allowCircularDependencies: config.allowCircularDependencies ?? false,
    };
  }

  /**
   * Creates a new kernel builder for fluent configuration.
   */
  static create(): KernelBuilder<Record<string, never>, Record<string, never>> {
    return new KernelBuilder();
  }

  /**
   * Gets the current kernel state.
   */
  get currentState(): KernelState {
    return this.state;
  }

  /**
   * Gets the kernel configuration.
   */
  get configuration(): Required<KernelConfig> {
    return { ...this.config };
  }

  /**
   * Plugin accessor with automatic type inference.
   */
  get plugins(): {
    get<K extends keyof TPluginMap>(
      name: K
    ): import('./types.js').GetPluginType<TPluginMap, TExtensions, K>;
    get(name: string): unknown | undefined;
  } {
    return {
      /**
       * Gets a plugin API by name with automatic type inference and augmentation support.
       * @param name - Plugin name
       */
      get: (name: string): unknown | undefined => {
        const metadata = this._plugins.get(name);
        return metadata?.api;
      },
    } as {
      get<K extends keyof TPluginMap>(
        name: K
      ): import('./types.js').GetPluginType<TPluginMap, TExtensions, K>;
      get(name: string): unknown | undefined;
    };
  }

  /**
   * Gets a plugin instance by name with type safety and applied extensions.
   * @param name - Plugin name
   * @returns Plugin API instance with all extensions applied
   * @throws {Error} If plugin is not found or not initialized
   */
  plugin<TName extends keyof TPluginMap>(name: TName): TPluginMap[TName] {
    const metadata = this._plugins.get(name as string);
    if (!metadata) {
      throw new Error(`Plugin '${String(name)}' not found`);
    }

    // Apply all extensions to the plugin API
    let extendedApi = metadata.api;

    // Find all extensions that target this plugin
    for (const [, pluginMetadata] of this._plugins) {
      for (const extension of pluginMetadata.plugin.extensions || []) {
        if (extension.target.name === name) {
          // Apply the extension to the API
          try {
            const extensionResult = extension.callback(extendedApi);

            // If the extension returns something, merge it with the API
            if (
              extensionResult &&
              typeof extensionResult === 'object' &&
              !Array.isArray(extensionResult)
            ) {
              const currentApi =
                extendedApi && typeof extendedApi === 'object' && !Array.isArray(extendedApi)
                  ? (extendedApi as Record<string, unknown>)
                  : {};
              extendedApi = { ...currentApi, ...(extensionResult as Record<string, unknown>) };
            }
          } catch (error) {
            console.warn(`Failed to apply extension to ${String(name)}:`, error);
          }
        }
      }
    }

    return extendedApi as TPluginMap[TName];
  }

  /**
   * Registers a plugin with the kernel.
   * @param plugin - The plugin to register
   * @param options - Registration options
   * @throws {Error} If plugin is already registered or kernel is not in valid state
   */
  register<TName extends string, TApi, TDeps = Record<string, unknown>>(
    plugin: Plugin<TName, TApi, TDeps>,
    options: PluginRegistrationOptions = {}
  ): this {
    this.validateState([KernelState.UNINITIALIZED, KernelState.INITIALIZED]);

    if (this._plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }

    this._plugins.set(plugin.name, {
      plugin: plugin as Plugin<string, unknown, Record<string, unknown>>,
      options,
      state: PluginState.REGISTERED,
    });

    return this;
  }

  /**
   * Unregisters a plugin from the kernel.
   * @param name - Name of the plugin to unregister
   * @throws {Error} If plugin is not found or in invalid state
   */
  unregister(name: string): this {
    this.validateState([KernelState.UNINITIALIZED, KernelState.INITIALIZED]);

    const metadata = this._plugins.get(name);
    if (!metadata) {
      throw new Error(`Plugin '${name}' is not registered`);
    }

    if (metadata.state === PluginState.INITIALIZED) {
      throw new Error(`Cannot unregister initialized plugin '${name}'. Destroy it first.`);
    }

    this._plugins.delete(name);
    return this;
  }

  /**
   * Checks if a plugin is registered.
   * @param name - Name of the plugin to check
   */
  has(name: string): boolean {
    return this._plugins.has(name);
  }

  /**
   * Gets the API of an initialized plugin.
   * @param name - Name of the plugin
   * @returns The plugin's API or undefined if not initialized
   */
  get<T = unknown>(name: string): T | undefined {
    const metadata = this._plugins.get(name);
    return metadata?.state === PluginState.INITIALIZED ? (metadata.api as T) : undefined;
  }

  /**
   * Gets all registered plugin names.
   */
  getPluginNames(): readonly string[] {
    return Array.from(this._plugins.keys());
  }

  /**
   * Gets the state of a specific plugin.
   * @param name - Name of the plugin
   */
  getPluginState(name: string): PluginState | undefined {
    return this._plugins.get(name)?.state;
  }

  /**
   * Initializes all registered plugins in dependency order.
   * Transitions kernel to INITIALIZED state and registers as global singleton.
   * @throws {Error} If initialization fails
   */
  async initialize(): Promise<void> {
    this.validateState([KernelState.UNINITIALIZED]);
    this.state = KernelState.INITIALIZING;

    try {
      // Resolve dependencies and get initialization order
      const pluginEntries = new Map<
        string,
        {
          plugin: Plugin<string, unknown, Record<string, unknown>>;
          options: PluginRegistrationOptions;
        }
      >();
      for (const [name, metadata] of this._plugins) {
        pluginEntries.set(name, {
          plugin: metadata.plugin,
          options: metadata.options,
        });
      }

      // Use dependency resolver to get correct initialization order
      const { quickResolve } = await import('./dependency-resolver/index.js');
      const pluginMap = new Map<string, Plugin<string, unknown, Record<string, unknown>>>();
      for (const [name, entry] of pluginEntries) {
        pluginMap.set(name, entry.plugin);
      }

      const resolutionResult = await quickResolve(pluginMap, this.config);

      if (!resolutionResult.success) {
        throw new Error(`Dependency resolution failed: ${resolutionResult.summary}`);
      }

      // Initialize plugins in resolved order
      for (const pluginName of resolutionResult.order) {
        const metadata = this._plugins.get(pluginName);
        if (!metadata || metadata.state !== PluginState.REGISTERED) {
          continue;
        }

        metadata.state = PluginState.INITIALIZING;

        try {
          // Resolve dependencies for this plugin
          const dependencies: Record<string, unknown> = {};

          for (const dep of metadata.plugin.dependencies) {
            const depMetadata = this._plugins.get(dep.plugin.name);
            if (depMetadata && depMetadata.api) {
              dependencies[dep.plugin.name] = depMetadata.api;
            }
          }

          // Call plugin setup function with resolved dependencies
          const api = await metadata.plugin.setup(dependencies);
          metadata.api = api;
          metadata.state = PluginState.INITIALIZED;
        } catch (error) {
          metadata.state = PluginState.REGISTERED;
          throw new Error(`Failed to initialize plugin '${pluginName}': ${error}`);
        }
      }

      // Process extensions after all plugins are initialized
      await this.processExtensions();

      this.state = KernelState.INITIALIZED;

      // Register as global singleton if autoGlobal is enabled
      if (this.config.autoGlobal) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        globalKernel = this;
      }
    } catch (error) {
      this.state = KernelState.UNINITIALIZED;
      throw error;
    }
  }

  /**
   * Destroys all initialized plugins in reverse dependency order.
   * @throws {Error} If destruction fails
   */
  async destroy(): Promise<void> {
    this.validateState([KernelState.INITIALIZED]);
    this.state = KernelState.DESTROYING;

    try {
      // Destroy plugins in reverse order
      const pluginNames = Array.from(this._plugins.keys()).reverse();

      for (const name of pluginNames) {
        const metadata = this._plugins.get(name);
        if (metadata && metadata.state === PluginState.INITIALIZED) {
          await this.destroyPlugin(metadata);
        }
      }

      this.state = KernelState.DESTROYED;

      // Clear all plugins
      this._plugins.clear();
    } catch (error) {
      this.state = KernelState.INITIALIZED;
      throw error;
    }
  }

  /**
   * Validates that the kernel is in one of the allowed states.
   * @param allowedStates - Array of allowed states
   * @throws {Error} If kernel is not in an allowed state
   */
  private validateState(allowedStates: readonly KernelState[]): void {
    if (!allowedStates.includes(this.state)) {
      throw new Error(
        `Invalid kernel state '${this.state}'. Expected one of: ${allowedStates.join(', ')}`
      );
    }
  }

  /**
   * Destroys a single plugin.
   * @param metadata - Plugin metadata
   */
  private async destroyPlugin(metadata: PluginMetadata): Promise<void> {
    metadata.state = PluginState.DESTROYING;

    try {
      if (metadata.plugin.destroy) {
        await metadata.plugin.destroy();
      }
      metadata.state = PluginState.DESTROYED;
      metadata.api = undefined;
    } catch (error) {
      metadata.state = PluginState.INITIALIZED;
      throw new Error(`Failed to destroy plugin '${metadata.plugin.name}': ${error}`);
    }
  }

  /**
   * Processes all plugin extensions and applies them to target plugins.
   */
  private async processExtensions(): Promise<void> {
    const extensions: Array<{ extension: PluginExtension; sourcePlugin: string }> = [];

    // Collect all extensions from all plugins
    for (const [pluginName, metadata] of this._plugins) {
      if (metadata.plugin.extensions) {
        for (const extension of metadata.plugin.extensions) {
          extensions.push({ extension, sourcePlugin: pluginName });
        }
      }
    }

    // Apply extensions to target plugins
    for (const { extension, sourcePlugin } of extensions) {
      const targetName =
        typeof extension.target === 'string' ? extension.target : extension.target.name;
      const targetMetadata = this._plugins.get(targetName);
      if (!targetMetadata || targetMetadata.state !== PluginState.INITIALIZED) {
        console.warn(
          `Extension from '${sourcePlugin}' targets '${targetName}' but target plugin is not initialized`
        );
        continue;
      }

      try {
        // Execute the extension callback with only the target API
        const extensionResult = await extension.callback(targetMetadata.api);

        // Apply the extension result to the target plugin's API
        if (
          extensionResult &&
          typeof extensionResult === 'object' &&
          !Array.isArray(extensionResult)
        ) {
          targetMetadata.api = {
            ...(targetMetadata.api as Record<string, unknown>),
            ...(extensionResult as Record<string, unknown>),
          };
        }
      } catch (error) {
        console.error(
          `Failed to apply extension from '${sourcePlugin}' to '${targetName}': ${error}`
        );
      }
    }
  }
}

/**
 * Global kernel instance for automatic resolution.
 * Only available when autoGlobal is enabled.
 */
let globalKernel: ZernKernelInstance<Record<string, unknown>> | undefined;

/**
 * Gets or creates the global kernel instance.
 * @param config - Configuration for new kernel (ignored if already exists)
 */
export function getGlobalKernel(
  config?: KernelConfig
): ZernKernelInstance<Record<string, unknown>> {
  if (!globalKernel) {
    globalKernel = new ZernKernelInstance(config);
  }
  return globalKernel;
}

/**
 * ZernKernel constructor that returns a KernelBuilder instance.
 */
export function ZernKernel(): KernelBuilder<Record<string, never>, Record<string, never>> {
  return new KernelBuilder();
}

/**
 * Resets the global kernel instance.
 * Useful for testing or when you need a fresh kernel.
 */
export function resetGlobalKernel(): void {
  globalKernel = undefined;
}
