/**
 * @file Extension Service - Application layer service for extension management.
 * Orchestrates extension operations and application logic.
 */

import type { PluginId } from '../../shared/types/common.types.js';
import type { Result } from '../../shared/types/result.types.js';
import type {
  ExtensionCallback,
  ExtensionConfig,
  ExtensionMetadata,
  ExtensionRegistry,
} from '../../domain/extension/extension.types.js';
import { ExtensionEntity, type ExtensionStats } from '../../domain/extension/extension.entity.js';
import type { Plugin } from '../../domain/plugin/plugin.types.js';

/**
 * Extension service error types.
 */
export class ExtensionServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly extensionId?: string
  ) {
    super(message);
    this.name = 'ExtensionServiceError';
  }
}

/**
 * Extension registration result.
 */
export interface ExtensionRegistrationResult {
  readonly extensionId: string;
  readonly registered: boolean;
  readonly targetPluginId: PluginId;
  readonly warnings: readonly string[];
}

/**
 * Extension application result.
 */
export interface ExtensionApplicationResult<TResult = unknown> {
  readonly extensionId: string;
  readonly applied: boolean;
  readonly result?: TResult;
  readonly executionTime: number;
  readonly warnings: readonly string[];
}

/**
 * Extension validation result.
 */
export interface ExtensionValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Extension service for managing extension lifecycle and operations.
 */
export class ExtensionService {
  private readonly extensions = new Map<string, ExtensionEntity>();
  private readonly registry: ExtensionRegistry = {};

  /**
   * Registers a new extension.
   */
  async registerExtension<TTargetApi = unknown, TResult = unknown>(
    metadata: ExtensionMetadata,
    config: ExtensionConfig,
    callback: ExtensionCallback<TTargetApi, TResult>
  ): Promise<Result<ExtensionRegistrationResult, ExtensionServiceError>> {
    try {
      const validationResult = this.validateExtension<TTargetApi, TResult>(
        metadata,
        config,
        callback
      );
      if (!validationResult.valid) {
        return {
          success: false,
          error: new ExtensionServiceError(
            `Extension validation failed: ${validationResult.errors.join(', ')}`,
            'VALIDATION_FAILED',
            metadata.id
          ),
        };
      }

      const extension = new ExtensionEntity(
        metadata,
        config,
        callback as ExtensionCallback<unknown, unknown>
      );
      this.extensions.set(metadata.id, extension);

      // Update registry
      const targetPluginId = metadata.targetPluginId;
      if (!this.registry[targetPluginId]) {
        this.registry[targetPluginId] = {};
      }

      return {
        success: true,
        data: {
          extensionId: metadata.id,
          registered: true,
          targetPluginId,
          warnings: validationResult.warnings,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new ExtensionServiceError(
          `Extension registration failed: ${error instanceof Error ? error.message : String(error)}`,
          'REGISTRATION_FAILED',
          metadata.id
        ),
      };
    }
  }

  /**
   * Unregisters an extension.
   */
  async unregisterExtension(extensionId: string): Promise<Result<boolean, ExtensionServiceError>> {
    try {
      const extension = this.extensions.get(extensionId);
      if (!extension) {
        return {
          success: false,
          error: new ExtensionServiceError(
            `Extension not found: ${extensionId}`,
            'EXTENSION_NOT_FOUND',
            extensionId
          ),
        };
      }

      extension.deactivate();
      this.extensions.delete(extensionId);

      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: new ExtensionServiceError(
          `Extension unregistration failed: ${error instanceof Error ? error.message : String(error)}`,
          'UNREGISTRATION_FAILED',
          extensionId
        ),
      };
    }
  }

  /**
   * Applies extensions to a target plugin.
   */
  async applyExtensions<TTargetApi = unknown>(
    targetPlugin: Plugin<string, TTargetApi>,
    context?: Record<string, unknown>
  ): Promise<Result<TTargetApi, ExtensionServiceError>> {
    try {
      const targetPluginId = targetPlugin.id as PluginId;
      const applicableExtensions = this.getExtensionsForPlugin(targetPluginId);

      if (applicableExtensions.length === 0) {
        // Plugin doesn't have direct api property, need to call setup
        const setupResult = await targetPlugin.setup(
          {} as Parameters<typeof targetPlugin.setup>[0]
        );
        return { success: true, data: setupResult as TTargetApi };
      }

      // Plugin doesn't have direct api property, need to call setup
      let extendedApi = (await targetPlugin.setup(
        {} as Parameters<typeof targetPlugin.setup>[0]
      )) as TTargetApi;

      for (const extension of applicableExtensions) {
        if (!extension.isActive) {
          continue;
        }

        const result = await extension.execute(extendedApi, context);
        if (result.success && result.result && typeof result.result === 'object') {
          extendedApi = { ...extendedApi, ...result.result } as TTargetApi;
        }
      }

      return { success: true, data: extendedApi };
    } catch (error) {
      return {
        success: false,
        error: new ExtensionServiceError(
          `Extension application failed: ${error instanceof Error ? error.message : String(error)}`,
          'APPLICATION_FAILED',
          targetPlugin.id
        ),
      };
    }
  }

  /**
   * Executes a specific extension.
   */
  async executeExtension<TTargetApi = unknown, TResult = unknown>(
    extensionId: string,
    targetApi: TTargetApi,
    context?: Record<string, unknown>
  ): Promise<Result<ExtensionApplicationResult<TResult>, ExtensionServiceError>> {
    try {
      const extension = this.extensions.get(extensionId);
      if (!extension) {
        return {
          success: false,
          error: new ExtensionServiceError(
            `Extension not found: ${extensionId}`,
            'EXTENSION_NOT_FOUND',
            extensionId
          ),
        };
      }

      const result = await extension.execute(targetApi, context);

      return {
        success: true,
        data: {
          extensionId,
          applied: result.success,
          result: result.result as TResult,
          executionTime: result.executionTime,
          warnings: result.success ? [] : [result.error?.message || 'Unknown error'],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new ExtensionServiceError(
          `Extension execution failed: ${error instanceof Error ? error.message : String(error)}`,
          'EXECUTION_FAILED',
          extensionId
        ),
      };
    }
  }

  /**
   * Gets an extension by ID.
   */
  getExtension(extensionId: string): Result<ExtensionEntity, ExtensionServiceError> {
    try {
      const extension = this.extensions.get(extensionId);
      if (!extension) {
        return {
          success: false,
          error: new ExtensionServiceError(
            `Extension not found: ${extensionId}`,
            'EXTENSION_NOT_FOUND',
            extensionId
          ),
        };
      }

      return { success: true, data: extension };
    } catch (error) {
      return {
        success: false,
        error: new ExtensionServiceError(
          `Failed to get extension: ${error instanceof Error ? error.message : String(error)}`,
          'GET_FAILED',
          extensionId
        ),
      };
    }
  }

  /**
   * Lists all extensions.
   */
  listExtensions(): Result<readonly ExtensionEntity[], ExtensionServiceError> {
    try {
      return { success: true, data: Array.from(this.extensions.values()) };
    } catch (error) {
      return {
        success: false,
        error: new ExtensionServiceError(
          `Failed to list extensions: ${error instanceof Error ? error.message : String(error)}`,
          'LIST_FAILED'
        ),
      };
    }
  }

  /**
   * Gets extensions for a specific plugin.
   */
  getExtensionsForPlugin(pluginId: PluginId): ExtensionEntity[] {
    return Array.from(this.extensions.values()).filter(extension => extension.canApplyTo(pluginId));
  }

  /**
   * Gets extension statistics.
   */
  getExtensionStatistics(extensionId: string): Result<ExtensionStats, ExtensionServiceError> {
    try {
      const extension = this.extensions.get(extensionId);
      if (!extension) {
        return {
          success: false,
          error: new ExtensionServiceError(
            `Extension not found: ${extensionId}`,
            'EXTENSION_NOT_FOUND',
            extensionId
          ),
        };
      }

      return { success: true, data: extension.getStats() };
    } catch (error) {
      return {
        success: false,
        error: new ExtensionServiceError(
          `Failed to get extension statistics: ${error instanceof Error ? error.message : String(error)}`,
          'STATISTICS_FAILED',
          extensionId
        ),
      };
    }
  }

  /**
   * Activates an extension.
   */
  activateExtension(extensionId: string): Result<boolean, ExtensionServiceError> {
    try {
      const extension = this.extensions.get(extensionId);
      if (!extension) {
        return {
          success: false,
          error: new ExtensionServiceError(
            `Extension not found: ${extensionId}`,
            'EXTENSION_NOT_FOUND',
            extensionId
          ),
        };
      }

      extension.activate();
      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: new ExtensionServiceError(
          `Failed to activate extension: ${error instanceof Error ? error.message : String(error)}`,
          'ACTIVATION_FAILED',
          extensionId
        ),
      };
    }
  }

  /**
   * Deactivates an extension.
   */
  deactivateExtension(extensionId: string): Result<boolean, ExtensionServiceError> {
    try {
      const extension = this.extensions.get(extensionId);
      if (!extension) {
        return {
          success: false,
          error: new ExtensionServiceError(
            `Extension not found: ${extensionId}`,
            'EXTENSION_NOT_FOUND',
            extensionId
          ),
        };
      }

      extension.deactivate();
      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: new ExtensionServiceError(
          `Failed to deactivate extension: ${error instanceof Error ? error.message : String(error)}`,
          'DEACTIVATION_FAILED',
          extensionId
        ),
      };
    }
  }

  /**
   * Validates an extension.
   */
  private validateExtension<TTargetApi = unknown, TResult = unknown>(
    metadata: ExtensionMetadata,
    config: ExtensionConfig,
    _callback: ExtensionCallback<TTargetApi, TResult>
  ): ExtensionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!metadata.id) {
      errors.push('Extension ID is required');
    }

    if (!metadata.sourcePluginId) {
      errors.push('Source plugin ID is required');
    }

    if (!metadata.targetPluginId) {
      errors.push('Target plugin ID is required');
    }

    if (!metadata.targetPluginName) {
      errors.push('Target plugin name is required');
    }

    if (!_callback || typeof _callback !== 'function') {
      errors.push('Extension callback must be a function');
    }

    if (config.timeout && config.timeout <= 0) {
      errors.push('Extension timeout must be positive');
    }

    if (config.retries && config.retries < 0) {
      errors.push('Extension retries must be non-negative');
    }

    if (config.timeout && config.timeout > 30000) {
      warnings.push('Extension timeout is very high, consider reducing it');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
