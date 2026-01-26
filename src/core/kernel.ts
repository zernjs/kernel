/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {
  PluginDefinition,
  PluginContext,
  DeepMerge,
  InferPluginAPI,
  InferPluginAugmentations,
  AnyPluginAPI,
  InferPluginHooks,
  Merge,
  KernelHooks,
  HookMap,
} from './types';
import { LifecycleManager } from './lifecycle';
import { CoreDependencyResolverPlugin } from '../plugins/dependency-resolver';
import { CoreMiddlewarePlugin } from '../plugins/middleware';

/**
 * Kernel Builder Class.
 * Manages the configuration, lifecycle, and initialization of plugins.
 * It provides a type-safe way to compose plugins and infer the resulting context.
 */
export class KernelBuilder<Context = {}, Hooks extends HookMap = KernelHooks> {
  private plugins: PluginDefinition<any, any, any, any>[] = [];
  public hooks = new LifecycleManager<any>(); // Type cast to any to allow internal flexibility, but exposed types are strict

  constructor() {
    this.hooks.emitSync('onInit', this);
  }

  /**
   * Retrieves the current list of registered plugins.
   *
   * @returns An array of PluginDefinition objects.
   */
  public getPlugins() {
    return this.plugins;
  }

  /**
   * Sets the list of registered plugins.
   * Useful for plugins that need to reorder or modify the plugin list (e.g., dependency resolvers).
   *
   * @param plugins - The new array of PluginDefinition objects.
   */
  public setPlugins(plugins: PluginDefinition<any, any, any, any>[]) {
    this.plugins = plugins;
  }

  /**
   * Registers a plugin in the kernel.
   * The type of the kernel context is automatically updated to include the plugin's API and augmentations.
   *
   * @param plugin - The plugin definition to register.
   * @returns The KernelBuilder instance with updated type inference.
   */
  use<P extends PluginDefinition<any, any, any, any, any>>(
    plugin: P
  ): KernelBuilder<
    DeepMerge<
      DeepMerge<Context, InferPluginAugmentations<P>>,
      { [K in P['name']]: InferPluginAPI<P> }
    >,
    Merge<Hooks, InferPluginHooks<P>>
  > {
    this.plugins.push(plugin);
    return this as any;
  }

  /**
   * Constructs and initializes the kernel synchronously.
   * This method will throw an error if any plugin requires asynchronous setup.
   *
   * @returns The fully initialized kernel context containing all plugin APIs.
   * @throws Error if any plugin returns a Promise during setup.
   */
  startSync(): { plugins: Context; hooks: LifecycleManager<Hooks> } {
    this.hooks.emitSync('onInit', this);

    const sortedPlugins = this.getPlugins();

    const pluginsMap: Record<string, AnyPluginAPI> = {};

    // We cast the hooks manager to the specific Hooks type for the context
    const runtimeContext: PluginContext<any, any> = {
      plugins: pluginsMap,
      hooks: this.hooks,
    };

    for (const plugin of sortedPlugins) {
      this.hooks.emitSync('onPluginSetup', plugin, runtimeContext);

      let result;
      try {
        result = plugin.setup(runtimeContext);
      } catch (error: any) {
        this.hooks.emitSync('onPluginError', plugin, error);
        throw error;
      }

      if (result instanceof Promise) {
        throw new Error(
          `Plugin '${plugin.name}' returned a Promise in startSync(). Use .start() instead.`
        );
      }

      this.hooks.emitSync('onPluginReady', plugin, result, pluginsMap);
    }

    return { plugins: pluginsMap as any, hooks: this.hooks as any };
  }

  /**
   * Constructs and initializes the kernel asynchronously.
   * This is the preferred method for initializing the kernel.
   *
   * @returns A Promise resolving to the fully initialized kernel context.
   */
  async start(): Promise<{ plugins: Context; hooks: LifecycleManager<Hooks> }> {
    await this.hooks.emitAsync('onInit', this);

    const sortedPlugins = this.getPlugins();

    const pluginsMap: Record<string, AnyPluginAPI> = {};

    const runtimeContext: PluginContext<any, any> = {
      plugins: pluginsMap,
      hooks: this.hooks,
    };

    for (const plugin of sortedPlugins) {
      await this.hooks.emitAsync('onPluginSetup', plugin, runtimeContext);

      let result;
      try {
        result = await plugin.setup(runtimeContext);
      } catch (error: any) {
        await this.hooks.emitAsync('onPluginError', plugin, error);
        throw error;
      }

      await this.hooks.emitAsync('onPluginReady', plugin, result, pluginsMap);
    }

    return { plugins: pluginsMap as any, hooks: this.hooks as any };
  }
}

/**
 * Creates a new Kernel Builder instance.
 * Automatically registers the Core Plugins (Dependency Resolver and Middleware).
 *
 * @returns A new KernelBuilder instance with default plugins.
 */
export function createKernel() {
  return new KernelBuilder().use(CoreDependencyResolverPlugin).use(CoreMiddlewarePlugin);
}
