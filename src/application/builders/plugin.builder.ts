/**
 * @file New Plugin Builder following project rules API specification.
 * Implements the new API: plugin('name', 'version').setup().depends().extend()
 */

import type { Result } from '../../shared/types/result.types.js';
import { success, failure, isFailure } from '../../shared/types/result.types.js';
import type { PluginId, Version } from '../../shared/types/common.types.js';
import {
  createPluginId,
  createPluginName,
  createVersion,
} from '../../shared/types/common.types.js';
import type {
  Plugin,
  PluginDependency,
  PluginExtension,
  ExtensionCallback,
  PluginDependencyContext,
} from '../../domain/plugin/plugin.types.js';

/**
 * Plugin builder interface following new API specification.
 */
export interface IPluginBuilder<
  TName extends string = string,
  TApi = unknown,
  TDeps = Record<string, unknown>,
> {
  /** Plugin ID */
  readonly id: string;

  /** Plugin name */
  readonly name: string;

  /** Plugin version */
  readonly version: string;

  /** Plugin dependencies */
  readonly dependencies: readonly PluginDependency[];

  /**
   * Sets up the plugin with dependency injection.
   * @param setupFn - Function that receives dependencies and returns API
   */
  setup<TNewApi>(
    setupFn: (deps: PluginDependencyContext<TDeps>) => TNewApi | Promise<TNewApi>
  ): IPluginBuilder<TName, TNewApi, TDeps>;

  /**
   * Adds a dependency to another plugin.
   * @param plugin - Plugin instance to depend on
   * @param versionConstraint - Version constraint (semver)
   */
  depends<TDepName extends string, TDepApi>(
    plugin: Plugin<TDepApi> | IPluginBuilder<TDepName, TDepApi>,
    versionConstraint?: string
  ): IPluginBuilder<TName, TApi, TDeps & Record<TDepName, TDepApi>>;

  /**
   * Extends another plugin with additional functionality.
   * @param targetPlugin - Plugin to extend
   * @param extensionFn - Function that receives target API and returns extension
   */
  extend<TTargetApi, TExtensionApi>(
    targetPlugin: Plugin<TTargetApi>,
    extensionFn: ExtensionCallback<TTargetApi, TExtensionApi>
  ): IPluginBuilder<TName, TApi, TDeps>;

  /**
   * Sets the destroy lifecycle hook.
   * @param destroyFn - Function to call when plugin is destroyed
   */
  destroy(destroyFn: () => void | Promise<void>): IPluginBuilder<TName, TApi, TDeps>;

  /**
   * Builds the plugin into a Plugin instance.
   */
  build(): Result<Plugin<TApi, TDeps>, PluginBuilderError>;
}

/**
 * Plugin builder implementation.
 */
class PluginBuilderImpl<TName extends string, TApi = unknown, TDeps = Record<string, unknown>>
  implements IPluginBuilder<TName, TApi, TDeps>
{
  public readonly _id: PluginId;
  public readonly _name: TName;
  public readonly _version: Version;

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get version(): Version {
    return this._version;
  }

  get dependencies(): readonly PluginDependency[] {
    return this._dependencies;
  }
  private _setupFn?: (deps: PluginDependencyContext<TDeps>) => TApi | Promise<TApi>;
  private _destroyFn?: () => void | Promise<void>;
  private readonly _dependencies: PluginDependency[] = [];
  private readonly _extensions: PluginExtension<unknown, unknown>[] = [];

  constructor(name: TName, version: string) {
    this._name = name;
    this._version = createVersion(version);
    this._id = createPluginId(`${name}@${version}`);
  }

  setup<TNewApi>(
    setupFn: (deps: PluginDependencyContext<TDeps>) => TNewApi | Promise<TNewApi>
  ): IPluginBuilder<TName, TNewApi, TDeps> {
    const newBuilder = this as unknown as PluginBuilderImpl<TName, TNewApi, TDeps>;
    newBuilder._setupFn = setupFn as (
      deps: PluginDependencyContext<TDeps>
    ) => TNewApi | Promise<TNewApi>;
    return newBuilder;
  }

  depends<TDepName extends string, TDepApi>(
    plugin: Plugin<TDepApi> | IPluginBuilder<TDepName, TDepApi>,
    versionConstraint?: string
  ): IPluginBuilder<TName, TApi, TDeps & Record<TDepName, TDepApi>> {
    // Handle both Plugin and IPluginBuilder - both now have id, name, version properties
    const pluginData = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
    };

    const finalVersionConstraint = versionConstraint || '^' + pluginData.version;
    this.validateDependency(pluginData as Plugin<TDepApi>, finalVersionConstraint);

    const dependency: PluginDependency = {
      pluginId: createPluginId(pluginData.id),
      pluginName: createPluginName(pluginData.name),
      versionConstraint: finalVersionConstraint,
      isOptional: false,
    };

    this._dependencies.push(dependency);
    return this as unknown as IPluginBuilder<TName, TApi, TDeps & Record<TDepName, TDepApi>>;
  }

  extend<TTargetApi, TExtensionApi>(
    targetPlugin: Plugin<TTargetApi>,
    extensionFn: ExtensionCallback<TTargetApi, TExtensionApi>
  ): IPluginBuilder<TName, TApi, TDeps> {
    // Validate extension target with enhanced type safety
    const validationResult = this._validateExtensionTarget(targetPlugin.name);
    if (isFailure(validationResult)) {
      throw new PluginBuilderError(
        `Extension validation failed: ${validationResult.error}`,
        'EXTENSION_VALIDATION_FAILED'
      );
    }

    const extension: PluginExtension<unknown, unknown> = {
      target: targetPlugin,
      callback: extensionFn as ExtensionCallback<unknown, unknown>,
      dependencies: [],
    };

    this._extensions.push(extension);
    return this;
  }

  destroy(destroyFn: () => void | Promise<void>): IPluginBuilder<TName, TApi, TDeps> {
    this._destroyFn = destroyFn;
    return this;
  }

  /**
   * Builds the plugin into a Plugin instance.
   */
  build(): Result<Plugin<TApi, TDeps>, PluginBuilderError> {
    return this._buildPlugin();
  }

  /**
   * Internal method to build the plugin (called by kernel).
   */
  _buildPlugin(): Result<Plugin<TApi, TDeps>, PluginBuilderError> {
    const validationResult = this.validateBuild();
    if (isFailure(validationResult)) {
      return failure(validationResult.error);
    }

    const plugin: Plugin<TApi, TDeps> = {
      id: this._id,
      name: createPluginName(this._name),
      version: this._version,
      dependencies: this._dependencies,
      extensions: this._extensions,
      setup: this._setupFn!,
      destroy: this._destroyFn,
    };

    return success(plugin);
  }

  private validateDependency(
    plugin: Plugin<unknown, Record<string, unknown>>,
    versionConstraint: string
  ): void {
    if (!plugin?.name || !plugin?.version) {
      throw new PluginBuilderError(
        'Invalid plugin dependency: missing name or version',
        'INVALID_DEPENDENCY'
      );
    }

    if (!this.isValidVersionConstraint(versionConstraint)) {
      throw new PluginBuilderError(
        `Invalid version constraint: ${versionConstraint}`,
        'INVALID_VERSION_CONSTRAINT'
      );
    }
  }

  private validateExtensionTarget(plugin: Plugin<unknown, Record<string, unknown>>): void {
    if (!plugin?.name || !plugin?.version) {
      throw new PluginBuilderError(
        'Invalid extension target: missing name or version',
        'INVALID_EXTENSION_TARGET'
      );
    }
  }

  /**
   * Validates extension target with detailed error reporting.
   * @param targetName - Target plugin name
   * @returns Validation result
   */
  private _validateExtensionTarget(targetName: string): Result<void, string> {
    const basicValidation = this._validateTargetName(targetName);
    if (isFailure(basicValidation)) {
      return basicValidation;
    }

    const selfExtensionCheck = this._checkSelfExtension(targetName);
    if (isFailure(selfExtensionCheck)) {
      return selfExtensionCheck;
    }

    const circularCheck = this._checkCircularDependency();
    if (isFailure(circularCheck)) {
      return circularCheck;
    }

    return success(undefined);
  }

  private _validateTargetName(targetName: string): Result<void, string> {
    if (!targetName || typeof targetName !== 'string') {
      return failure('Extension target must be a non-empty string');
    }

    if (targetName.trim().length === 0) {
      return failure('Extension target name cannot be empty or whitespace');
    }

    return success(undefined);
  }

  private _checkSelfExtension(targetName: string): Result<void, string> {
    if (targetName === this._name) {
      return failure(`Plugin '${this._name}' cannot extend itself`);
    }
    return success(undefined);
  }

  private _checkCircularDependency(): Result<void, string> {
    const hasCircularDependency = this._extensions.some(
      ext => ext.target.name === createPluginName(this._name)
    );
    if (hasCircularDependency) {
      return failure(`Circular extension dependency detected for plugin '${this._name}'`);
    }
    return success(undefined);
  }

  private validateBuild(): Result<void, PluginBuilderError> {
    if (!this._setupFn) {
      return failure(
        new PluginBuilderError('Plugin setup function is required', 'MISSING_SETUP_FUNCTION')
      );
    }

    return success(undefined);
  }

  private isValidVersionConstraint(constraint: string): boolean {
    // Basic semver constraint validation
    return /^[~^]?\d+\.\d+\.\d+/.test(constraint);
  }
}

/**
 * Plugin builder error.
 */
export class PluginBuilderError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PluginBuilderError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Creates a new plugin builder with name and version.
 * @param name - Plugin name
 * @param version - Plugin version (semver)
 * @returns Plugin builder instance
 */
export function plugin<TName extends string>(
  name: TName,
  version: string
): IPluginBuilder<TName, unknown, Record<string, unknown>> {
  return new PluginBuilderImpl(name, version);
}
