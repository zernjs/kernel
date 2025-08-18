/**
 * @file Plugin domain entity - Core business logic for plugins.
 * Represents the fundamental plugin concept with its lifecycle and metadata.
 */

import type { PluginId, PluginName, Version } from '../../shared/types/common.types.js';
import type { Result } from '../../shared/types/result.types.js';
import type {
  PluginDependency,
  PluginExtension,
  PluginSetupFunction,
  PluginDependencyContext,
} from './plugin.types.js';

/**
 * Plugin lifecycle states following domain rules.
 */
export enum PluginState {
  REGISTERED = 'registered',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  DESTROYING = 'destroying',
  DESTROYED = 'destroyed',
}

/**
 * Plugin destroy function type.
 */
export type PluginDestroyFunction = () => void | Promise<void>;

/**
 * Core Plugin entity representing a plugin in the domain.
 * Contains all business logic and validation rules for plugins.
 */
export class PluginEntity<TApi = unknown, TDeps = Record<string, unknown>> {
  private _state: PluginState = PluginState.REGISTERED;
  private _api?: TApi;
  private _lastError?: Error;

  constructor(
    private readonly _id: PluginId,
    private readonly _name: PluginName,
    private readonly _version: Version,
    private readonly _setup: PluginSetupFunction<TApi, TDeps>,
    private readonly _dependencies: readonly PluginDependency[] = [],
    private readonly _extensions: readonly PluginExtension[] = [],
    private readonly _destroy?: PluginDestroyFunction
  ) {
    this.validatePlugin();
  }

  /**
   * Gets the plugin ID.
   */
  get id(): PluginId {
    return this._id;
  }

  /**
   * Gets the plugin name.
   */
  get name(): PluginName {
    return this._name;
  }

  /**
   * Gets the plugin version.
   */
  get version(): Version {
    return this._version;
  }

  /**
   * Gets the current plugin state.
   */
  get state(): PluginState {
    return this._state;
  }

  /**
   * Gets the plugin dependencies.
   */
  get dependencies(): readonly PluginDependency[] {
    return this._dependencies;
  }

  /**
   * Gets the plugin extensions.
   */
  get extensions(): readonly PluginExtension[] {
    return this._extensions;
  }

  /**
   * Gets the plugin API if initialized.
   */
  get api(): TApi | undefined {
    return this._api;
  }

  /**
   * Sets the extended API after applying extensions.
   * This should only be called by the extension system.
   */
  setExtendedApi(extendedApi: TApi): void {
    if (this._state !== PluginState.INITIALIZED) {
      throw new Error(
        `Cannot set extended API for plugin '${this._name}' in state '${this._state}'`
      );
    }
    this._api = extendedApi;
  }

  /**
   * Gets the last error if any.
   */
  get lastError(): Error | undefined {
    return this._lastError;
  }

  /**
   * Checks if the plugin is in a specific state.
   */
  isInState(state: PluginState): boolean {
    return this._state === state;
  }

  /**
   * Checks if the plugin can transition to a new state.
   */
  canTransitionTo(newState: PluginState): boolean {
    const validTransitions: Record<PluginState, PluginState[]> = {
      [PluginState.REGISTERED]: [PluginState.INITIALIZING],
      [PluginState.INITIALIZING]: [PluginState.INITIALIZED, PluginState.REGISTERED],
      [PluginState.INITIALIZED]: [PluginState.DESTROYING],
      [PluginState.DESTROYING]: [PluginState.DESTROYED, PluginState.INITIALIZED],
      [PluginState.DESTROYED]: [],
    };

    return validTransitions[this._state].includes(newState);
  }

  /**
   * Initializes the plugin with its dependencies.
   */
  async initialize(dependencies: PluginDependencyContext<TDeps>): Promise<Result<TApi, Error>> {
    if (!this.canTransitionTo(PluginState.INITIALIZING)) {
      const error = new Error(
        `Cannot initialize plugin '${this._name}' from state '${this._state}'`
      );
      return { success: false, error };
    }

    this._state = PluginState.INITIALIZING;
    this._lastError = undefined;

    try {
      this._api = await this._setup(dependencies);
      this._state = PluginState.INITIALIZED;
      return { success: true, data: this._api };
    } catch (error) {
      this._lastError = error instanceof Error ? error : new Error(String(error));
      this._state = PluginState.REGISTERED;
      return { success: false, error: this._lastError };
    }
  }

  /**
   * Destroys the plugin and cleans up resources.
   */
  async destroy(): Promise<Result<void, Error>> {
    if (!this.canTransitionTo(PluginState.DESTROYING)) {
      const error = new Error(`Cannot destroy plugin '${this._name}' from state '${this._state}'`);
      return { success: false, error };
    }

    this._state = PluginState.DESTROYING;
    this._lastError = undefined;

    try {
      if (this._destroy) {
        await this._destroy();
      }
      this._api = undefined;
      this._state = PluginState.DESTROYED;
      return { success: true, data: undefined };
    } catch (error) {
      this._lastError = error instanceof Error ? error : new Error(String(error));
      this._state = PluginState.INITIALIZED;
      return { success: false, error: this._lastError };
    }
  }

  /**
   * Validates the plugin configuration.
   */
  private validatePlugin(): void {
    if (!this._name || this._name.trim().length === 0) {
      throw new Error('Plugin name cannot be empty');
    }

    if (!this._version || this._version.trim().length === 0) {
      throw new Error('Plugin version cannot be empty');
    }

    if (typeof this._setup !== 'function') {
      throw new Error('Plugin setup must be a function');
    }

    if (this._destroy && typeof this._destroy !== 'function') {
      throw new Error('Plugin destroy must be a function if provided');
    }
  }
}
