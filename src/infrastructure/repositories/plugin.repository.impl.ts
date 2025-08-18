import { PluginEntity } from '../../domain/plugin/plugin.entity.js';
import { PluginRepository, RepositoryError } from '../../domain/plugin/plugin.repository.js';
import { PluginId, PluginName, Version } from '../../shared/types/common.types.js';
import { Result, success, failure } from '../../shared/types/result.types.js';
import { Plugin } from '../../domain/plugin/plugin.types.js';

/**
 * Implementação em memória do repositório de plugins.
 * Em um ambiente real, isso seria conectado a um banco de dados ou sistema de arquivos.
 */
export class InMemoryPluginRepository implements PluginRepository {
  private readonly plugins = new Map<PluginId, PluginEntity>();

  async save(plugin: Plugin): Promise<Result<void, RepositoryError>> {
    try {
      // Convert Plugin to PluginEntity for storage
      const entity = new PluginEntity(
        plugin.id,
        plugin.name,
        plugin.version,
        plugin.setup,
        plugin.dependencies,
        plugin.extensions || [],
        plugin.destroy
      );
      this.plugins.set(plugin.id, entity);
      return success(undefined);
    } catch (error) {
      return failure(
        RepositoryError.saveError(plugin.id, error instanceof Error ? error.message : String(error))
      );
    }
  }

  async findById(id: PluginId): Promise<Result<Plugin | null, RepositoryError>> {
    try {
      const entity = this.plugins.get(id);
      if (!entity) {
        return success(null);
      }
      // Convert PluginEntity back to Plugin interface
      const plugin: Plugin = {
        id: entity.id,
        name: entity.name,
        version: entity.version,
        dependencies: entity.dependencies,
        extensions: entity.extensions,
        setup: async (deps): Promise<unknown> => {
          const result = await entity.initialize(deps);
          if (result.success) {
            return result.data;
          }
          throw result.error;
        },
        destroy: async (): Promise<void> => {
          const result = await entity.destroy();
          if (!result.success) {
            throw result.error;
          }
        },
      };
      return success(plugin);
    } catch {
      return failure(RepositoryError.notFound(id));
    }
  }

  async findByName(name: PluginName): Promise<Result<readonly Plugin[], RepositoryError>> {
    try {
      const entities = Array.from(this.plugins.values()).filter(entity => entity.name === name);
      const plugins: Plugin[] = entities.map(entity => ({
        id: entity.id,
        name: entity.name,
        version: entity.version,
        dependencies: entity.dependencies,
        extensions: entity.extensions,
        setup: async (deps): Promise<unknown> => {
          const result = await entity.initialize(deps);
          if (result.success) {
            return result.data;
          }
          throw result.error;
        },
        destroy: async (): Promise<void> => {
          const result = await entity.destroy();
          if (!result.success) {
            throw result.error;
          }
        },
      }));
      return success(plugins);
    } catch {
      return failure(
        new RepositoryError(`Failed to find plugins by name ${name}`, 'FIND_BY_NAME_ERROR')
      );
    }
  }

  async findAll(): Promise<Result<readonly Plugin[], RepositoryError>> {
    try {
      const entities = Array.from(this.plugins.values());
      const plugins: Plugin[] = entities.map(entity => ({
        id: entity.id,
        name: entity.name,
        version: entity.version,
        dependencies: entity.dependencies,
        extensions: entity.extensions,
        setup: async (deps): Promise<unknown> => {
          const result = await entity.initialize(deps);
          if (result.success) {
            return result.data;
          }
          throw result.error;
        },
        destroy: async (): Promise<void> => {
          const result = await entity.destroy();
          if (!result.success) {
            throw result.error;
          }
        },
      }));
      return success(plugins);
    } catch {
      return failure(new RepositoryError('Failed to retrieve all plugins', 'FIND_ALL_ERROR'));
    }
  }

  async remove(id: PluginId): Promise<Result<void, RepositoryError>> {
    try {
      if (!this.plugins.has(id)) {
        return failure(RepositoryError.notFound(id));
      }
      this.plugins.delete(id);
      return success(undefined);
    } catch (error) {
      return failure(
        RepositoryError.removeError(id, error instanceof Error ? error.message : String(error))
      );
    }
  }

  async exists(id: PluginId): Promise<Result<boolean, RepositoryError>> {
    try {
      const exists = this.plugins.has(id);
      return success(exists);
    } catch {
      return failure(new RepositoryError(`Failed to check if plugin ${id} exists`, 'EXISTS_ERROR'));
    }
  }

  async findByNameAndVersion(
    name: PluginName,
    version: Version
  ): Promise<Result<Plugin | null, RepositoryError>> {
    try {
      const entity = Array.from(this.plugins.values()).find(
        entity => entity.name === name && entity.version === version
      );
      if (!entity) {
        return success(null);
      }
      const plugin: Plugin = {
        id: entity.id,
        name: entity.name,
        version: entity.version,
        dependencies: entity.dependencies,
        extensions: entity.extensions,
        setup: async (deps): Promise<unknown> => {
          const result = await entity.initialize(deps);
          if (result.success) {
            return result.data;
          }
          throw result.error;
        },
        destroy: async (): Promise<void> => {
          const result = await entity.destroy();
          if (!result.success) {
            throw result.error;
          }
        },
      };
      return success(plugin);
    } catch {
      return failure(
        new RepositoryError(
          `Failed to find plugin ${name}@${version}`,
          'FIND_BY_NAME_VERSION_ERROR'
        )
      );
    }
  }

  async clear(): Promise<void> {
    this.plugins.clear();
  }

  async count(): Promise<number> {
    return this.plugins.size;
  }
}
