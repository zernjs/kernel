/**
 * @file Plugin Service - Application layer service for plugin management.
 * Orchestrates plugin operations and business logic.
 */

import type { PluginId } from '../../shared/types/common.types.js';
import type { Result } from '../../shared/types/result.types.js';
import { success, failure } from '../../shared/types/result.types.js';
import type {
  Plugin,
  PluginRegistrationOptions,
  PluginDependencyContext,
} from '../../domain/plugin/plugin.types.js';
import type { PluginRepository } from '../../domain/plugin/plugin.repository.js';
import { PluginEntity, PluginState } from '../../domain/plugin/plugin.entity.js';

/**
 * Plugin service error types.
 */
export class PluginServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly pluginId?: PluginId
  ) {
    super(message);
    this.name = 'PluginServiceError';
  }
}

/**
 * Plugin registration result.
 */
export interface PluginRegistrationResult {
  readonly pluginId: PluginId;
  readonly registered: boolean;
  readonly warnings: readonly string[];
}

/**
 * Plugin validation result.
 */
export interface PluginValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Plugin service for managing plugin lifecycle and operations.
 */
export class PluginService {
  constructor(private readonly repository: PluginRepository) {}

  /**
   * Registers a new plugin.
   */
  async registerPlugin(
    plugin: Plugin,
    _options: PluginRegistrationOptions = {}
  ): Promise<Result<PluginRegistrationResult, PluginServiceError>> {
    try {
      const validationResult = this.validatePlugin(plugin);
      if (!validationResult.valid) {
        return failure(
          new PluginServiceError(
            `Plugin validation failed: ${validationResult.errors.join(', ')}`,
            'VALIDATION_FAILED',
            plugin.id
          )
        );
      }

      const entity = new PluginEntity(
        plugin.id,
        plugin.name,
        plugin.version,
        plugin.setup,
        plugin.dependencies,
        plugin.extensions,
        plugin.destroy
      );
      const saveResult = await this.repository.save(this.entityToPlugin(entity));

      if (!saveResult.success) {
        return failure(
          new PluginServiceError(
            `Failed to save plugin: ${saveResult.error.message}`,
            'SAVE_FAILED',
            plugin.id
          )
        );
      }

      return success({
        pluginId: plugin.id,
        registered: true,
        warnings: validationResult.warnings,
      });
    } catch (error) {
      return failure(
        new PluginServiceError(
          `Plugin registration failed: ${error instanceof Error ? error.message : String(error)}`,
          'REGISTRATION_FAILED',
          plugin.id
        )
      );
    }
  }

  /**
   * Unregisters a plugin.
   */
  async unregisterPlugin(pluginId: PluginId): Promise<Result<boolean, PluginServiceError>> {
    try {
      const findResult = await this.repository.findById(pluginId);
      if (!findResult.success) {
        return {
          success: false,
          error: new PluginServiceError(
            `Plugin not found: ${pluginId}`,
            'PLUGIN_NOT_FOUND',
            pluginId
          ),
        };
      }

      if (!findResult.data) {
        return failure(
          new PluginServiceError(`Plugin data is null: ${pluginId}`, 'PLUGIN_DATA_NULL', pluginId)
        );
      }

      const entity = this.pluginToEntity(findResult.data);
      if (entity.state !== PluginState.INITIALIZED) {
        const destroyResult = await entity.destroy();
        if (!destroyResult.success) {
          return failure(
            new PluginServiceError(
              `Failed to destroy plugin before unregistration: ${destroyResult.error.message}`,
              'DESTROY_FAILED',
              pluginId
            )
          );
        }
      }

      const removeResult = await this.repository.remove(pluginId);
      if (!removeResult.success) {
        return failure(
          new PluginServiceError(
            `Failed to remove plugin: ${removeResult.error.message}`,
            'REMOVE_FAILED',
            pluginId
          )
        );
      }

      return success(true);
    } catch (error) {
      return failure(
        new PluginServiceError(
          `Plugin unregistration failed: ${error instanceof Error ? error.message : String(error)}`,
          'UNREGISTRATION_FAILED',
          pluginId
        )
      );
    }
  }

  /**
   * Loads a plugin.
   */
  async loadPlugin(pluginId: PluginId): Promise<Result<unknown, PluginServiceError>> {
    try {
      const findResult = await this.repository.findById(pluginId);
      if (!findResult.success) {
        return {
          success: false,
          error: new PluginServiceError(
            `Plugin not found: ${pluginId}`,
            'PLUGIN_NOT_FOUND',
            pluginId
          ),
        };
      }

      if (!findResult.data) {
        return failure(
          new PluginServiceError(`Plugin data is null: ${pluginId}`, 'PLUGIN_DATA_NULL', pluginId)
        );
      }

      const entity = this.pluginToEntity(findResult.data);
      const context: PluginDependencyContext<Record<string, unknown>> = {
        plugins: {},
        kernel: {
          get: <K extends string>(_name: K): unknown => undefined,
        },
      };
      const initResult = await entity.initialize(context);
      if (!initResult.success) {
        return failure(
          new PluginServiceError(
            `Failed to initialize plugin: ${initResult.error.message}`,
            'INIT_FAILED',
            pluginId
          )
        );
      }

      const saveResult = await this.repository.save(this.entityToPlugin(entity));
      if (!saveResult.success) {
        return failure(
          new PluginServiceError(
            `Failed to save plugin state: ${saveResult.error.message}`,
            'SAVE_FAILED',
            pluginId
          )
        );
      }

      return success(initResult.data);
    } catch (error) {
      return failure(
        new PluginServiceError(
          `Plugin loading failed: ${error instanceof Error ? error.message : String(error)}`,
          'LOADING_FAILED',
          pluginId
        )
      );
    }
  }

  /**
   * Unloads a plugin.
   */
  async unloadPlugin(pluginId: PluginId): Promise<Result<boolean, PluginServiceError>> {
    try {
      const findResult = await this.repository.findById(pluginId);
      if (!findResult.success) {
        return {
          success: false,
          error: new PluginServiceError(
            `Plugin not found: ${pluginId}`,
            'PLUGIN_NOT_FOUND',
            pluginId
          ),
        };
      }

      if (!findResult.data) {
        return failure(
          new PluginServiceError(`Plugin data is null: ${pluginId}`, 'PLUGIN_DATA_NULL', pluginId)
        );
      }

      const entity = this.pluginToEntity(findResult.data);
      const destroyResult = await entity.destroy();
      if (!destroyResult.success) {
        return failure(
          new PluginServiceError(
            `Failed to destroy plugin: ${destroyResult.error.message}`,
            'DESTROY_FAILED',
            pluginId
          )
        );
      }

      const saveResult = await this.repository.save(this.entityToPlugin(entity));
      if (!saveResult.success) {
        return failure(
          new PluginServiceError(
            `Failed to save plugin state: ${saveResult.error.message}`,
            'SAVE_FAILED',
            pluginId
          )
        );
      }

      return success(true);
    } catch (error) {
      return failure(
        new PluginServiceError(
          `Plugin unloading failed: ${error instanceof Error ? error.message : String(error)}`,
          'UNLOADING_FAILED',
          pluginId
        )
      );
    }
  }

  /**
   * Gets a plugin by ID.
   */
  async getPlugin(pluginId: PluginId): Promise<Result<PluginEntity, PluginServiceError>> {
    try {
      const findResult = await this.repository.findById(pluginId);
      if (!findResult.success) {
        return failure(
          new PluginServiceError(`Plugin not found: ${pluginId}`, 'PLUGIN_NOT_FOUND', pluginId)
        );
      }

      if (!findResult.data) {
        return failure(
          new PluginServiceError(`Plugin data is null: ${pluginId}`, 'PLUGIN_DATA_NULL', pluginId)
        );
      }

      return success(this.pluginToEntity(findResult.data));
    } catch (error) {
      return failure(
        new PluginServiceError(
          `Failed to get plugin: ${error instanceof Error ? error.message : String(error)}`,
          'GET_FAILED',
          pluginId
        )
      );
    }
  }

  /**
   * Lists all plugins.
   */
  async listPlugins(): Promise<Result<readonly PluginEntity[], PluginServiceError>> {
    try {
      const findAllResult = await this.repository.findAll();
      if (!findAllResult.success) {
        return failure(
          new PluginServiceError(
            `Failed to list plugins: ${findAllResult.error.message}`,
            'LIST_FAILED'
          )
        );
      }

      return success(findAllResult.data.map(plugin => this.pluginToEntity(plugin)));
    } catch (error) {
      return failure(
        new PluginServiceError(
          `Failed to list plugins: ${error instanceof Error ? error.message : String(error)}`,
          'LIST_FAILED'
        )
      );
    }
  }

  /**
   * Validates a plugin.
   */
  private validatePlugin(plugin: Plugin): PluginValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    this._validateRequiredFields(plugin, errors);
    this._validatePluginFactory(plugin, errors);
    this._validateDependencies(plugin, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private _validateRequiredFields(plugin: Plugin, errors: string[]): void {
    if (!plugin.id) {
      errors.push('Plugin ID is required');
    }

    if (!plugin.name) {
      errors.push('Plugin name is required');
    }

    if (!plugin.version) {
      errors.push('Plugin version is required');
    }
  }

  private _validatePluginFactory(plugin: Plugin, errors: string[]): void {
    if (!plugin.setup || typeof plugin.setup !== 'function') {
      errors.push('Plugin setup must be a function');
    }
  }

  private _validateDependencies(plugin: Plugin, warnings: string[]): void {
    if (plugin.dependencies && plugin.dependencies.length > 10) {
      warnings.push('Plugin has many dependencies, consider reducing complexity');
    }
  }

  /**
   * Converts PluginEntity to Plugin interface for repository operations.
   */
  private entityToPlugin(entity: PluginEntity): Plugin {
    return {
      id: entity.id,
      name: entity.name,
      version: entity.version,
      dependencies: entity.dependencies,
      extensions: entity.extensions,
      setup: () => entity.api,
      destroy: async (): Promise<void> => {
        const result = await entity.destroy();
        if (!result.success) {
          throw result.error;
        }
      },
    };
  }

  /**
   * Converts Plugin to PluginEntity for internal operations.
   */
  private pluginToEntity(plugin: Plugin): PluginEntity {
    return new PluginEntity(
      plugin.id,
      plugin.name,
      plugin.version,
      plugin.setup,
      plugin.dependencies,
      plugin.extensions,
      plugin.destroy
    );
  }
}
