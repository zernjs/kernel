/**
 * @file Fluent API for building plugins with strong typing and validation.
 * Provides an intuitive interface for plugin creation with compile-time safety.
 */

import type { Plugin, PluginDependency, PluginExtension, ExtensionCallback } from './types.js';
import { parseConstraint } from './utils/version.js';

/**
 * Fluent builder interface for plugin dependencies.
 */
export interface DependencyBuilder<TDeps = Record<string, never>> {
  /**
   * Adds a dependency with version constraint.
   * @param plugin - Plugin instance or name
   * @param version - Version constraint (semver)
   */
  depends<TDepName extends string, TDepApi, TDepDeps = Record<string, unknown>>(
    plugin: Plugin<TDepName, TDepApi, TDepDeps>,
    version?: string
  ): DependencyBuilder<TDeps & Record<TDepName, TDepApi>>;
  depends(plugin: string, version?: string): this;

  /**
   * Adds an optional dependency.
   * @param plugin - Plugin instance or name
   * @param version - Version constraint (semver)
   */
  optionalDependency(plugin: Plugin | string, version?: string): this;
}

/**
 * Main plugin builder with fluent API.
 */
export interface PluginBuilder<
  TName extends string = string,
  TApi = unknown,
  TDeps = Record<string, never>,
  TExtensions = Record<string, never>,
> extends DependencyBuilder<TDeps> {
  /**
   * Sets the plugin version.
   * @param version - Semantic version string
   */
  version(version: string): this;

  /**
   * Adds a dependency with version constraint and type inference.
   * @param plugin - Plugin instance
   * @param version - Version constraint (semver)
   */
  depends<TDepName extends string, TDepApi, TDepDeps = Record<string, unknown>>(
    plugin: Plugin<TDepName, TDepApi, TDepDeps>,
    version?: string
  ): PluginBuilder<TName, TApi, TDeps & Record<TDepName, TDepApi>, TExtensions>;
  depends(plugin: string, version?: string): this;

  /**
   * Sets the plugin setup function with type inference.
   * @param setup - Function that initializes the plugin
   */
  setup<TNewApi>(
    setup: (dependencies: TDeps) => TNewApi | Promise<TNewApi>
  ): PluginBuilder<TName, TNewApi, TDeps, TExtensions>;

  /**
   * Sets the plugin setup function.
   * @param setup - Function that initializes the plugin
   */
  setup(setup: (dependencies: TDeps) => TApi | Promise<TApi>): this;

  /**
   * Sets the plugin destroy function.
   * @param destroy - Function that cleans up the plugin
   */
  destroy(destroy: () => void | Promise<void>): this;

  /**
   * Adds an extension to another plugin with automatic type inference.
   * @param target - Target plugin name to extend
   * @param callback - Extension callback function
   */
  extend<
    TTargetName extends string,
    TTargetApi,
    TTargetDeps = Record<string, unknown>,
    TResult = unknown,
  >(
    target: Plugin<TTargetName, TTargetApi, TTargetDeps>,
    callback: ExtensionCallback<TTargetApi, TResult>
  ): PluginBuilder<TName, TApi, TDeps, TExtensions & Record<TTargetName, TResult>>;

  /**
   * Builds the final plugin object.
   * @throws {Error} If required fields are missing or invalid
   */
  build(): Plugin<TName, TApi, TDeps> & { extensionTargets: TExtensions };
}

/**
 * Implementation of the plugin builder.
 */
class PluginBuilderImpl<
  TName extends string,
  TApi,
  TDeps = Record<string, never>,
  TExtensions = Record<string, never>,
> implements PluginBuilder<TName, TApi, TDeps, TExtensions>
{
  private _version?: string;
  private _setup?: (dependencies: TDeps) => TApi | Promise<TApi>;
  private _destroy?: () => void | Promise<void>;
  private readonly _dependencies: PluginDependency[] = [];
  private readonly _extensions: PluginExtension<unknown, unknown>[] = [];

  constructor(private readonly name: TName) {}

  version(version: string): this {
    this.validateVersion(version);
    this._version = version;
    return this;
  }

  setup<TNewApi>(
    setup: (dependencies: TDeps) => TNewApi | Promise<TNewApi>
  ): PluginBuilder<TName, TNewApi, TDeps, TExtensions>;
  setup(setup: (dependencies: TDeps) => TApi | Promise<TApi>): this;
  setup(setup: (dependencies: TDeps) => unknown): unknown {
    this._setup = setup as (dependencies: TDeps) => TApi | Promise<TApi>;
    return this as unknown;
  }

  destroy(destroy: () => void | Promise<void>): this {
    this._destroy = destroy;
    return this;
  }

  extend<
    TTargetName extends string,
    TTargetApi,
    TTargetDeps = Record<string, unknown>,
    TResult = unknown,
  >(
    target: Plugin<TTargetName, TTargetApi, TTargetDeps>,
    callback: ExtensionCallback<TTargetApi, TResult>
  ): PluginBuilder<TName, TApi, TDeps, TExtensions & Record<TTargetName, TResult>> {
    this.validateExtensionTarget(target as Plugin<string, unknown, Record<string, unknown>>);

    // Create extension with new callback signature
    const extension: PluginExtension<TTargetApi, TResult> = {
      target: target as Plugin<string, unknown, Record<string, unknown>>,
      callback,
      dependencies: [...this._dependencies],
    };

    this._extensions.push(extension as PluginExtension<unknown, unknown>);
    return this as PluginBuilder<TName, TApi, TDeps, TExtensions & Record<TTargetName, TResult>>;
  }

  depends<TDepName extends string, TDepApi, TDepDeps = Record<string, unknown>>(
    plugin: Plugin<TDepName, TDepApi, TDepDeps>,
    version?: string
  ): PluginBuilder<TName, TApi, TDeps & Record<TDepName, TDepApi>, TExtensions>;
  depends(plugin: string, version?: string): this;
  depends(
    plugin: Plugin<string, unknown, Record<string, unknown>> | string,
    version?: string
  ): unknown {
    const name = typeof plugin === 'string' ? plugin : plugin.name;
    this.validateDependencyName(name);
    if (version) {
      this.validateVersion(version);
    }

    // Create a placeholder plugin for the dependency
    const dependencyPlugin: Plugin<string, unknown, Record<string, unknown>> = typeof plugin ===
    'string'
      ? {
          name: plugin,
          version: version || '*',
          dependencies: [],
          setup: () => ({}),
        }
      : (plugin as Plugin<string, unknown, Record<string, unknown>>);

    this._dependencies.push({
      plugin: dependencyPlugin,
      version,
    });

    return this as unknown;
  }

  optionalDependency(plugin: Plugin | string, version?: string): this {
    const name = typeof plugin === 'string' ? plugin : plugin.name;
    this.validateDependencyName(name);
    if (version) {
      this.validateVersion(version);
    }

    // Create a placeholder plugin for the dependency
    const dependencyPlugin: Plugin<string, unknown, Record<string, unknown>> = typeof plugin ===
    'string'
      ? {
          name: plugin,
          version: version || '*',
          dependencies: [],
          setup: () => ({}),
        }
      : (plugin as Plugin<string, unknown, Record<string, unknown>>);

    this._dependencies.push({
      plugin: dependencyPlugin,
      version,
    });

    return this;
  }

  build(): Plugin<TName, TApi, TDeps> & { extensionTargets: TExtensions } {
    this.validateBuild();

    return {
      name: this.name,
      version: this._version!,
      dependencies: [...this._dependencies],
      extensions: this._extensions.length > 0 ? [...this._extensions] : undefined,
      setup: this._setup!,
      destroy: this._destroy,
      extensionTargets: {} as TExtensions,
    };
  }

  private validateVersion(version: string): void {
    try {
      parseConstraint(version);
    } catch (error) {
      throw new Error(`Invalid version format '${version}': ${error}`);
    }
  }

  private validateDependencyName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('Dependency name must be a non-empty string');
    }

    if (name === this.name) {
      throw new Error('Plugin cannot depend on itself');
    }

    if (this._dependencies.some(dep => dep.plugin.name === name)) {
      throw new Error(`Dependency '${name}' is already added`);
    }
  }

  private validateExtensionTarget(target: Plugin<string, unknown, Record<string, unknown>>): void {
    if (!target || !target.name || typeof target.name !== 'string') {
      throw new Error('Extension target must be a valid plugin');
    }

    if (target.name === this.name) {
      throw new Error('Plugin cannot extend itself');
    }

    // Allow extending plugins that are already dependencies
    // Extensions are different from dependencies and should be allowed
  }

  private validateBuild(): void {
    if (!this._version) {
      throw new Error('Plugin version is required');
    }

    if (!this._setup) {
      throw new Error('Plugin setup function is required');
    }
  }
}

/**
 * Creates a new plugin builder with the specified name.
 * @param name - Unique plugin name
 * @returns Fluent plugin builder
 */
export function plugin<TName extends string>(
  name: TName
): PluginBuilder<TName, unknown, Record<string, never>, Record<string, never>> {
  if (!name || typeof name !== 'string') {
    throw new Error('Plugin name must be a non-empty string');
  }
  return new PluginBuilderImpl<TName, unknown, Record<string, never>, Record<string, never>>(name);
}

/**
 * Creates a typed plugin builder with the specified name and API type.
 * @param name - Unique plugin name
 * @returns Typed fluent plugin builder
 */
export function typedPlugin<TName extends string, TApi = unknown>(
  name: TName
): PluginBuilder<TName, TApi, Record<string, never>, Record<string, never>> {
  return plugin(name) as PluginBuilder<TName, TApi, Record<string, never>, Record<string, never>>;
}

/**
 * Utility function to create a simple plugin with minimal configuration.
 * @param name - Plugin name
 * @param version - Plugin version
 * @param setup - Setup function
 * @returns Complete plugin object
 */
export function simplePlugin<TName extends string, TApi>(
  name: TName,
  version: string,
  setup: (dependencies: Record<string, never>) => TApi | Promise<TApi>
): Plugin<TName, TApi, Record<string, never>> {
  return typedPlugin<TName, TApi>(name).version(version).setup(setup).build();
}
