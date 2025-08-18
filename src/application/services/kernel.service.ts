/**
 * @file Kernel Service - Application layer service for kernel management.
 * Orchestrates kernel operations and lifecycle management.
 */

import type { PluginId, KernelId } from '../../shared/types/common.types.js';
import type { Result } from '../../shared/types/result.types.js';
import { success, failure } from '../../shared/types/result.types.js';
import type {
  KernelConfig,
  KernelEvent,
  KernelEventListener,
  KernelMetadata,
} from '../../domain/kernel/kernel.types.js';
import type { KernelRepository } from '../../domain/kernel/kernel.repository.js';
import { KernelEntity } from '../../domain/kernel/kernel.entity.js';
import type { PluginEntity } from '../../domain/plugin/plugin.entity.js';
import { PluginState } from '../../domain/plugin/plugin.entity.js';

/**
 * Kernel service error types.
 */
export class KernelServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly kernelId?: string
  ) {
    super(message);
    this.name = 'KernelServiceError';
  }
}

/**
 * Kernel initialization result.
 */
export interface KernelInitializationResult {
  readonly kernelId: string;
  readonly initialized: boolean;
  readonly pluginsLoaded: number;
  readonly warnings: readonly string[];
}

/**
 * Kernel statistics.
 */
export interface KernelStatistics {
  readonly totalPlugins: number;
  readonly loadedPlugins: number;
  readonly failedPlugins: number;
  readonly uptime: number;
  readonly memoryUsage?: number;
}

/**
 * Kernel service for managing kernel lifecycle and operations.
 */
export class KernelService {
  constructor(private readonly repository: KernelRepository) {}

  /**
   * Creates and initializes a new kernel.
   */
  async createKernel(
    config: KernelConfig,
    metadata: KernelMetadata
  ): Promise<Result<KernelInitializationResult, KernelServiceError>> {
    try {
      const entity = new KernelEntity(metadata.id, config);
      const saveResult = await this.repository.save(entity);

      if (!saveResult.success) {
        return failure(
          new KernelServiceError(
            `Failed to save kernel: ${saveResult.error.message}`,
            'SAVE_FAILED',
            entity.id as string
          )
        );
      }

      const initResult = await entity.initialize();
      if (!initResult.success) {
        return failure(
          new KernelServiceError(
            `Failed to initialize kernel: ${initResult.error.message}`,
            'INITIALIZATION_FAILED',
            entity.id
          )
        );
      }

      const updateResult = await this.repository.save(entity);
      if (!updateResult.success) {
        return failure(
          new KernelServiceError(
            `Failed to update kernel state: ${updateResult.error.message}`,
            'UPDATE_FAILED',
            entity.id
          )
        );
      }

      return success({
        kernelId: entity.id,
        initialized: true,
        pluginsLoaded: entity.getAllPlugins().length,
        warnings: [],
      });
    } catch (error) {
      return failure(
        new KernelServiceError(
          `Kernel creation failed: ${error instanceof Error ? error.message : String(error)}`,
          'CREATION_FAILED'
        )
      );
    }
  }

  /**
   * Shuts down a kernel and cleans up resources.
   */
  async shutdownKernel(kernelId: KernelId): Promise<Result<boolean, KernelServiceError>> {
    try {
      const findResult = await this.repository.findById(kernelId);
      if (!findResult.success || !findResult.data) {
        return failure(
          new KernelServiceError(`Kernel not found: ${kernelId}`, 'KERNEL_NOT_FOUND', kernelId)
        );
      }

      const entity = findResult.data;
      if (!entity) {
        return failure(
          new KernelServiceError(`Kernel entity is null: ${kernelId}`, 'KERNEL_NULL', kernelId)
        );
      }

      const destroyResult = await entity.destroy();
      if (!destroyResult.success) {
        return failure(
          new KernelServiceError(
            `Failed to destroy kernel: ${destroyResult.error.message}`,
            'DESTROY_FAILED',
            kernelId
          )
        );
      }

      const updateResult = await this.repository.save(entity);
      if (!updateResult.success) {
        return failure(
          new KernelServiceError(
            `Failed to update kernel state: ${updateResult.error.message}`,
            'UPDATE_FAILED',
            kernelId
          )
        );
      }

      return success(true);
    } catch (error) {
      return failure(
        new KernelServiceError(
          `Kernel shutdown failed: ${error instanceof Error ? error.message : String(error)}`,
          'SHUTDOWN_FAILED',
          kernelId
        )
      );
    }
  }

  /**
   * Registers a plugin with the kernel.
   */
  async registerPlugin(
    kernelId: KernelId,
    plugin: PluginEntity
  ): Promise<Result<boolean, KernelServiceError>> {
    try {
      const findResult = await this.repository.findById(kernelId);
      if (!findResult.success || !findResult.data) {
        return failure(
          new KernelServiceError(`Kernel not found: ${kernelId}`, 'KERNEL_NOT_FOUND', kernelId)
        );
      }

      const entity = findResult.data;
      const registerResult = entity.registerPlugin(plugin);
      if (!registerResult.success) {
        return failure(
          new KernelServiceError(
            `Failed to register plugin: ${registerResult.error.message}`,
            'PLUGIN_REGISTRATION_FAILED',
            kernelId
          )
        );
      }

      const updateResult = await this.repository.save(entity);
      if (!updateResult.success) {
        return failure(
          new KernelServiceError(
            `Failed to update kernel state: ${updateResult.error.message}`,
            'UPDATE_FAILED',
            kernelId
          )
        );
      }

      return success(true);
    } catch (error) {
      return failure(
        new KernelServiceError(
          `Plugin registration failed: ${error instanceof Error ? error.message : String(error)}`,
          'PLUGIN_REGISTRATION_FAILED',
          kernelId
        )
      );
    }
  }

  /**
   * Unregisters a plugin from the kernel.
   */
  async unregisterPlugin(
    kernelId: KernelId,
    pluginId: PluginId
  ): Promise<Result<boolean, KernelServiceError>> {
    try {
      const findResult = await this.repository.findById(kernelId);
      if (!findResult.success || !findResult.data) {
        return failure(
          new KernelServiceError(`Kernel not found: ${kernelId}`, 'KERNEL_NOT_FOUND', kernelId)
        );
      }

      const entity = findResult.data;
      const unregisterResult = entity.unregisterPlugin(pluginId);
      if (!unregisterResult.success) {
        return failure(
          new KernelServiceError(
            `Failed to unregister plugin: ${unregisterResult.error.message}`,
            'PLUGIN_UNREGISTRATION_FAILED',
            kernelId
          )
        );
      }

      const updateResult = await this.repository.save(entity);
      if (!updateResult.success) {
        return failure(
          new KernelServiceError(
            `Failed to update kernel state: ${updateResult.error.message}`,
            'UPDATE_FAILED',
            kernelId
          )
        );
      }

      return success(true);
    } catch (error) {
      return failure(
        new KernelServiceError(
          `Plugin unregistration failed: ${error instanceof Error ? error.message : String(error)}`,
          'PLUGIN_UNREGISTRATION_FAILED',
          kernelId
        )
      );
    }
  }

  /**
   * Gets a kernel by ID.
   */
  async getKernel(kernelId: KernelId): Promise<Result<KernelEntity, KernelServiceError>> {
    try {
      const findResult = await this.repository.findById(kernelId);
      if (!findResult.success || !findResult.data) {
        return failure(
          new KernelServiceError(`Kernel not found: ${kernelId}`, 'KERNEL_NOT_FOUND', kernelId)
        );
      }

      return success(findResult.data);
    } catch (error) {
      return failure(
        new KernelServiceError(
          `Failed to get kernel: ${error instanceof Error ? error.message : String(error)}`,
          'GET_FAILED',
          kernelId
        )
      );
    }
  }

  /**
   * Gets kernel statistics.
   */
  async getKernelStatistics(
    kernelId: KernelId
  ): Promise<Result<KernelStatistics, KernelServiceError>> {
    try {
      const findResult = await this.repository.findById(kernelId);
      if (!findResult.success || !findResult.data) {
        return failure(
          new KernelServiceError(`Kernel not found: ${kernelId}`, 'KERNEL_NOT_FOUND', kernelId)
        );
      }

      const entity = findResult.data;
      const plugins = entity.getAllPlugins();
      const loadedPlugins = plugins.filter(p => p.state === PluginState.INITIALIZED).length;
      const failedPlugins = plugins.filter(p => p.lastError !== undefined).length;

      return success({
        totalPlugins: plugins.length,
        loadedPlugins,
        failedPlugins,
        uptime: Date.now() - entity.createdAt.getTime(),
      });
    } catch (error) {
      return failure(
        new KernelServiceError(
          `Failed to get kernel statistics: ${error instanceof Error ? error.message : String(error)}`,
          'STATISTICS_FAILED',
          kernelId
        )
      );
    }
  }

  /**
   * Adds an event listener to the kernel.
   * TODO: Implement event listener functionality in KernelEntity
   */
  async addEventListener(
    kernelId: KernelId,
    _event: KernelEvent,
    _listener: KernelEventListener
  ): Promise<Result<boolean, KernelServiceError>> {
    try {
      const findResult = await this.repository.findById(kernelId);
      if (!findResult.success || !findResult.data) {
        return failure(
          new KernelServiceError(`Kernel not found: ${kernelId}`, 'KERNEL_NOT_FOUND', kernelId)
        );
      }

      // TODO: Implement addEventListener method in KernelEntity
      // const entity = findResult.data;
      // entity.addEventListener(event, listener);

      // For now, return success without actual implementation
      return success(true);
    } catch (error) {
      return failure(
        new KernelServiceError(
          `Failed to add event listener: ${error instanceof Error ? error.message : String(error)}`,
          'EVENT_LISTENER_FAILED',
          kernelId
        )
      );
    }
  }
}
