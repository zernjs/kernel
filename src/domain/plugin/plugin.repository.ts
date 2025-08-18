/**
 * Repository interface for plugin persistence and retrieval operations.
 * Defines the contract for plugin storage without implementation details.
 */

import type { Result } from '../../shared/types/result.types.js';
import type { PluginId, PluginName, Version } from '../../shared/types/common.types.js';
import type { Plugin } from './plugin.types.js';

/**
 * Plugin repository interface for data access operations.
 */
export interface PluginRepository {
  /**
   * Finds a plugin by its unique identifier.
   * @param id - Plugin unique identifier
   * @returns Result containing the plugin or error
   */
  findById(id: PluginId): Promise<Result<Plugin | null, RepositoryError>>;

  /**
   * Finds a plugin by name and version.
   * @param name - Plugin name
   * @param version - Plugin version
   * @returns Result containing the plugin or error
   */
  findByNameAndVersion(
    name: PluginName,
    version: Version
  ): Promise<Result<Plugin | null, RepositoryError>>;

  /**
   * Finds all plugins with the given name.
   * @param name - Plugin name
   * @returns Result containing array of plugins or error
   */
  findByName(name: PluginName): Promise<Result<readonly Plugin[], RepositoryError>>;

  /**
   * Saves a plugin to the repository.
   * @param plugin - Plugin to save
   * @returns Result indicating success or error
   */
  save(plugin: Plugin): Promise<Result<void, RepositoryError>>;

  /**
   * Removes a plugin from the repository.
   * @param id - Plugin identifier to remove
   * @returns Result indicating success or error
   */
  remove(id: PluginId): Promise<Result<void, RepositoryError>>;

  /**
   * Lists all plugins in the repository.
   * @returns Result containing array of all plugins or error
   */
  findAll(): Promise<Result<readonly Plugin[], RepositoryError>>;

  /**
   * Checks if a plugin exists in the repository.
   * @param id - Plugin identifier
   * @returns Result containing boolean or error
   */
  exists(id: PluginId): Promise<Result<boolean, RepositoryError>>;
}

/**
 * Repository operation errors.
 */
export class RepositoryError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    this.details = details;
  }

  static notFound(id: string): RepositoryError {
    return new RepositoryError(`Plugin not found: ${id}`, 'NOT_FOUND', { id });
  }

  static saveError(id: string, reason: string): RepositoryError {
    return new RepositoryError(`Failed to save plugin ${id}: ${reason}`, 'SAVE_ERROR', {
      id,
      reason,
    });
  }

  static removeError(id: string, reason: string): RepositoryError {
    return new RepositoryError(`Failed to remove plugin ${id}: ${reason}`, 'REMOVE_ERROR', {
      id,
      reason,
    });
  }
}
