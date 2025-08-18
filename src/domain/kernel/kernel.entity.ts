/**
 * @file Kernel domain entity - Core business logic for kernel management.
 * Represents the kernel with its lifecycle and plugin management capabilities.
 */

import type { KernelId, PluginId, PluginName } from '../../shared/types/common.types.js';
import type { Result } from '../../shared/types/result.types.js';
import type { PluginEntity } from '../plugin/plugin.entity.js';
import type { KernelConfig } from './kernel.types.js';
import { KernelState } from './kernel.types.js';

/**
 * Core Kernel entity representing the plugin management system.
 * Contains all business logic and validation rules for kernel operations.
 */
export class KernelEntity {
  private _state: KernelState = KernelState.UNINITIALIZED;
  private readonly _plugins = new Map<PluginId, PluginEntity>();
  private readonly _pluginsByName = new Map<PluginName, PluginEntity>();
  private _lastError?: Error;
  private readonly _createdAt: Date;
  private _lastModified: Date;

  constructor(
    private readonly _id: KernelId,
    private readonly _config: KernelConfig
  ) {
    this._createdAt = new Date();
    this._lastModified = new Date();
    this.validateConfig();
  }

  /**
   * Gets the kernel ID.
   */
  get id(): KernelId {
    return this._id;
  }

  /**
   * Gets the kernel configuration.
   */
  get config(): KernelConfig {
    return { ...this._config };
  }

  /**
   * Gets the current kernel state.
   */
  get state(): KernelState {
    return this._state;
  }

  /**
   * Gets the creation timestamp.
   */
  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  /**
   * Gets the last modification timestamp.
   */
  get lastModified(): Date {
    return new Date(this._lastModified);
  }

  /**
   * Gets the last error if any.
   */
  get lastError(): Error | undefined {
    return this._lastError;
  }

  /**
   * Gets the number of registered plugins.
   */
  get pluginCount(): number {
    return this._plugins.size;
  }

  /**
   * Gets all registered plugin names.
   */
  get pluginNames(): readonly PluginName[] {
    return Array.from(this._pluginsByName.keys());
  }

  /**
   * Checks if the kernel is in a specific state.
   */
  isInState(state: KernelState): boolean {
    return this._state === state;
  }

  /**
   * Checks if the kernel can transition to a new state.
   */
  canTransitionTo(newState: KernelState): boolean {
    const validTransitions: Record<KernelState, KernelState[]> = {
      [KernelState.UNINITIALIZED]: [KernelState.BUILDING, KernelState.ERROR],
      [KernelState.BUILDING]: [KernelState.BUILT, KernelState.ERROR],
      [KernelState.BUILT]: [KernelState.INITIALIZING, KernelState.ERROR],
      [KernelState.INITIALIZING]: [KernelState.INITIALIZED, KernelState.ERROR],
      [KernelState.INITIALIZED]: [KernelState.DESTROYING, KernelState.ERROR],
      [KernelState.DESTROYING]: [KernelState.DESTROYED, KernelState.ERROR],
      [KernelState.DESTROYED]: [],
      [KernelState.ERROR]: [KernelState.UNINITIALIZED],
    };

    return validTransitions[this._state].includes(newState);
  }

  /**
   * Registers a plugin with the kernel.
   */
  registerPlugin(plugin: PluginEntity): Result<void, Error> {
    if (!this.isInState(KernelState.UNINITIALIZED)) {
      const error = new Error(`Cannot register plugin in state '${this._state}'`);
      return { success: false, error };
    }

    if (this._plugins.has(plugin.id)) {
      const error = new Error(`Plugin with ID '${plugin.id}' is already registered`);
      return { success: false, error };
    }

    if (this._pluginsByName.has(plugin.name)) {
      const error = new Error(`Plugin with name '${plugin.name}' is already registered`);
      return { success: false, error };
    }

    this._plugins.set(plugin.id, plugin);
    this._pluginsByName.set(plugin.name, plugin);
    this._lastModified = new Date();

    return { success: true, data: undefined };
  }

  /**
   * Unregisters a plugin from the kernel.
   */
  unregisterPlugin(pluginId: PluginId): Result<void, Error> {
    if (!this.isInState(KernelState.UNINITIALIZED)) {
      const error = new Error(`Cannot unregister plugin in state '${this._state}'`);
      return { success: false, error };
    }

    const plugin = this._plugins.get(pluginId);
    if (!plugin) {
      const error = new Error(`Plugin with ID '${pluginId}' is not registered`);
      return { success: false, error };
    }

    this._plugins.delete(pluginId);
    this._pluginsByName.delete(plugin.name);
    this._lastModified = new Date();

    return { success: true, data: undefined };
  }

  /**
   * Gets a plugin by ID.
   */
  getPluginById(pluginId: PluginId): PluginEntity | undefined {
    return this._plugins.get(pluginId);
  }

  /**
   * Gets a plugin by name.
   */
  getPluginByName(pluginName: PluginName): PluginEntity | undefined {
    return this._pluginsByName.get(pluginName);
  }

  /**
   * Checks if a plugin is registered.
   */
  hasPlugin(pluginId: PluginId): boolean {
    return this._plugins.has(pluginId);
  }

  /**
   * Checks if a plugin name is registered.
   */
  hasPluginByName(pluginName: PluginName): boolean {
    return this._pluginsByName.has(pluginName);
  }

  /**
   * Gets all registered plugins.
   */
  getAllPlugins(): readonly PluginEntity[] {
    return Array.from(this._plugins.values());
  }

  /**
   * Initializes the kernel and all registered plugins.
   */
  async initialize(): Promise<Result<void, Error>> {
    if (!this.canTransitionTo(KernelState.INITIALIZING)) {
      const error = new Error(`Cannot initialize kernel from state '${this._state}'`);
      return { success: false, error };
    }

    this._state = KernelState.INITIALIZING;
    this._lastError = undefined;

    try {
      // Initialize plugins in dependency order
      // This would be handled by the application service
      this._state = KernelState.INITIALIZED;
      this._lastModified = new Date();
      return { success: true, data: undefined };
    } catch (error) {
      this._lastError = error instanceof Error ? error : new Error(String(error));
      this._state = KernelState.UNINITIALIZED;
      return { success: false, error: this._lastError };
    }
  }

  /**
   * Destroys the kernel and all plugins.
   */
  async destroy(): Promise<Result<void, Error>> {
    if (!this.canTransitionTo(KernelState.DESTROYING)) {
      const error = new Error(`Cannot destroy kernel from state '${this._state}'`);
      return { success: false, error };
    }

    this._state = KernelState.DESTROYING;
    this._lastError = undefined;

    try {
      // Destroy plugins in reverse dependency order
      // This would be handled by the application service
      this._plugins.clear();
      this._pluginsByName.clear();
      this._state = KernelState.DESTROYED;
      this._lastModified = new Date();
      return { success: true, data: undefined };
    } catch (error) {
      this._lastError = error instanceof Error ? error : new Error(String(error));
      this._state = KernelState.INITIALIZED;
      return { success: false, error: this._lastError };
    }
  }

  /**
   * Validates the kernel configuration.
   */
  private validateConfig(): void {
    if (!this._config) {
      throw new Error('Kernel configuration cannot be null or undefined');
    }

    if (
      typeof this._config.autoGlobal !== 'undefined' &&
      typeof this._config.autoGlobal !== 'boolean'
    ) {
      throw new Error('autoGlobal must be a boolean');
    }

    if (
      typeof this._config.strictVersioning !== 'undefined' &&
      typeof this._config.strictVersioning !== 'boolean'
    ) {
      throw new Error('strictVersioning must be a boolean');
    }

    if (
      typeof this._config.allowCircularDependencies !== 'undefined' &&
      typeof this._config.allowCircularDependencies !== 'boolean'
    ) {
      throw new Error('allowCircularDependencies must be a boolean');
    }
  }
}
