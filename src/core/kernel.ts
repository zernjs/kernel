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
import { SecurityManager } from './security/manager';
import { PluginSandbox } from './security/sandbox';
import { PluginManifest, SecurityMode } from './security/types';
import * as fs from 'fs';

/**
 * Kernel Builder Class.
 * Manages the configuration, lifecycle, and initialization of plugins.
 * It provides a type-safe way to compose plugins and infer the resulting context.
 */
export class KernelBuilder<Context = {}, Hooks extends HookMap = KernelHooks> {
  private plugins: PluginDefinition<any, any, any, any>[] = [];
  public hooks = new LifecycleManager<any>(); // Type cast to any to allow internal flexibility, but exposed types are strict
  public security: SecurityManager;
  private sandbox: PluginSandbox;

  constructor(securityMode: SecurityMode = 'strict') {
    this.security = new SecurityManager(securityMode);
    this.sandbox = new PluginSandbox(this.security);
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
   * Loads a plugin securely from the filesystem using the Sandbox.
   * This ensures that the plugin runs in an isolated environment and permissions are enforced.
   *
   * @param pluginPath - Absolute path to the plugin entry file.
   * @param manifest - The security manifest for the plugin.
   */
  public loadSecurePlugin(pluginPath: string, manifest: PluginManifest) {
    if (!fs.existsSync(pluginPath)) {
      throw new Error(`Plugin file not found: ${pluginPath}`);
    }

    // Load plugin in sandbox
    const exports = this.sandbox.load(pluginPath, manifest);

    // Identify the PluginDefinition in the exports
    // It could be the default export or a named export
    let pluginDef: PluginDefinition<any, any, any, any> | undefined;

    if (this.isPluginDefinition(exports)) {
      pluginDef = exports;
    } else if (exports.default && this.isPluginDefinition(exports.default)) {
      pluginDef = exports.default;
    } else {
      // Search for any export that looks like a plugin
      const values = Object.values(exports);
      for (const val of values) {
        if (this.isPluginDefinition(val)) {
          pluginDef = val;
          break;
        }
      }
    }

    if (!pluginDef) {
      throw new Error(`Could not find a valid PluginDefinition export in ${pluginPath}`);
    }

    // Enforce name match
    if (pluginDef.name !== manifest.name) {
      throw new Error(
        `Plugin name mismatch. Manifest: ${manifest.name}, Plugin: ${pluginDef.name}`
      );
    }

    this.use(pluginDef);
    return this;
  }

  private isPluginDefinition(obj: any): obj is PluginDefinition<any, any, any, any> {
    return obj && typeof obj === 'object' && 'name' in obj && 'setup' in obj && 'version' in obj;
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
