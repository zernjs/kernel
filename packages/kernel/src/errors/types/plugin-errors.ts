/**
 * @fileoverview Plugin-specific error types
 * @module @zern/kernel/errors/types/plugin-errors
 */

import type { PluginId } from '../../types/plugin.js';
import type { PluginLifecyclePhase } from './base.js';
import {
  ZernError,
  type ErrorSuggestion,
  type RecoveryStrategy,
  type RecoveryResult,
} from './base.js';

/**
 * Base class for all plugin-related errors
 */
export abstract class PluginError extends ZernError {
  readonly category = 'plugin' as const;

  constructor(
    message: string,
    public readonly pluginId: PluginId,
    public readonly phase: PluginLifecyclePhase,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, options);
  }
}

/**
 * Plugin not found error
 */
export class PluginNotFoundError extends PluginError {
  readonly code = 'PLUGIN_NOT_FOUND';
  readonly severity = 'high' as const;
  readonly recoverable = true;

  constructor(
    pluginId: PluginId,
    public readonly searchPaths: string[],
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(
      `Plugin '${pluginId}' not found in search paths: ${searchPaths.join(', ')}`,
      pluginId,
      'discovery',
      options
    );
  }

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'fix',
        title: 'Install missing plugin',
        description: `Run: pnpm add ${this.pluginId}`,
        confidence: 0.9,
        priority: 120,
        action: {
          type: 'command',
          payload: `pnpm add ${this.pluginId}`,
        },
      },
      {
        type: 'fix',
        title: 'Check plugin name',
        description: 'Verify that the plugin name is spelled correctly',
        confidence: 0.8,
        priority: 100,
      },
      {
        type: 'workaround',
        title: 'Mark as optional dependency',
        description: 'Add to optionalDependencies in plugin config',
        confidence: 0.7,
        priority: 70,
        action: {
          type: 'config',
          payload: { optionalDependencies: [this.pluginId] },
        },
      },
      {
        type: 'documentation',
        title: 'Plugin documentation',
        description: 'Check official plugin documentation',
        confidence: 0.8,
        priority: 60,
        action: {
          type: 'link',
          payload: `https://docs.zern.dev/plugins/${this.pluginId}`,
        },
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'plugin-install',
        priority: 100,
        description: 'Attempt to install the missing plugin',
        estimatedTime: 10000,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => {
          // This would be implemented to actually install the plugin
          return {
            success: false,
            strategy: 'plugin-install',
            duration: 0,
            message: 'Automatic plugin installation not implemented',
          };
        },
      },
      {
        name: 'optional-dependency',
        priority: 80,
        description: 'Mark plugin as optional and continue',
        estimatedTime: 100,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'optional-dependency',
          duration: 50,
        }),
      },
    ];
  }
}

/**
 * Plugin initialization error
 */
export class PluginInitializationError extends PluginError {
  readonly code = 'PLUGIN_INIT_FAILED';
  readonly severity = 'high' as const;
  readonly recoverable = true;

  constructor(
    pluginId: PluginId,
    message: string,
    public readonly retryCount: number = 0,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(
      `Plugin '${pluginId}' initialization failed: ${message}`,
      pluginId,
      'initialization',
      options
    );
  }

  getSuggestions(): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [
      {
        type: 'debug',
        title: 'Check plugin logs',
        description: 'Review the plugin initialization logs for more details',
        confidence: 0.9,
        priority: 100,
      },
      {
        type: 'fix',
        title: 'Verify plugin configuration',
        description: 'Check that the plugin configuration is valid',
        confidence: 0.8,
        priority: 90,
        action: {
          type: 'command',
          payload: `pnpm run plugin:validate ${this.pluginId}`,
        },
      },
      {
        type: 'fix',
        title: 'Check dependencies',
        description: 'Verify that all plugin dependencies are available',
        confidence: 0.85,
        priority: 95,
      },
    ];

    if (this.retryCount < 3) {
      suggestions.unshift({
        type: 'fix',
        title: 'Retry initialization',
        description: `Retry plugin initialization (attempt ${this.retryCount + 1}/3)`,
        confidence: 0.7,
        priority: 110,
        action: {
          type: 'command',
          payload: `plugin.retry()`,
        },
      });
    }

    return suggestions;
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'plugin-restart',
        priority: 100,
        description: 'Restart the plugin',
        estimatedTime: 2000,
        canRecover: error => error instanceof PluginInitializationError && error.retryCount < 3,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'plugin-restart',
          duration: 1500,
        }),
      },
      {
        name: 'safe-mode',
        priority: 60,
        description: 'Load plugin in safe mode with minimal configuration',
        estimatedTime: 1000,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'safe-mode',
          duration: 800,
        }),
      },
    ];
  }
}

/**
 * Plugin configuration error
 */
export class PluginConfigurationError extends PluginError {
  readonly code = 'PLUGIN_CONFIG_ERROR';
  readonly severity = 'medium' as const;
  readonly recoverable = true;

  constructor(
    pluginId: PluginId,
    message: string,
    public readonly configPath: string,
    public readonly expectedType?: string,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(
      `Plugin '${pluginId}' configuration error at '${configPath}': ${message}`,
      pluginId,
      'configuration',
      options
    );
  }

  getSuggestions(): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [
      {
        type: 'fix',
        title: 'Check configuration syntax',
        description: `Verify the configuration at '${this.configPath}' is valid`,
        confidence: 0.9,
        priority: 100,
      },
      {
        type: 'fix',
        title: 'Use default configuration',
        description: 'Reset to default plugin configuration',
        confidence: 0.8,
        priority: 80,
        action: {
          type: 'command',
          payload: `plugin.resetConfig('${this.pluginId}')`,
        },
      },
      {
        type: 'documentation',
        title: 'Configuration documentation',
        description: 'Review the plugin configuration documentation',
        confidence: 0.7,
        priority: 70,
        action: {
          type: 'link',
          payload: `https://docs.zern.dev/plugins/${this.pluginId}/config`,
        },
      },
    ];

    if (this.expectedType) {
      suggestions.unshift({
        type: 'fix',
        title: 'Fix configuration type',
        description: `Expected type: ${this.expectedType}`,
        confidence: 0.95,
        priority: 120,
      });
    }

    return suggestions;
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'default-config',
        priority: 100,
        description: 'Use default configuration',
        estimatedTime: 500,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'default-config',
          duration: 200,
        }),
      },
      {
        name: 'config-validation',
        priority: 80,
        description: 'Validate and fix configuration',
        estimatedTime: 1000,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'config-validation',
          duration: 800,
        }),
      },
    ];
  }
}

/**
 * Plugin runtime error
 */
export class PluginRuntimeError extends PluginError {
  readonly code = 'PLUGIN_RUNTIME_ERROR';
  readonly severity = 'medium' as const;
  readonly recoverable = true;

  constructor(
    pluginId: PluginId,
    message: string,
    public readonly operation: string,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(
      `Plugin '${pluginId}' runtime error during '${operation}': ${message}`,
      pluginId,
      'runtime',
      options
    );
  }

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'debug',
        title: 'Check operation context',
        description: `Review the context of operation '${this.operation}'`,
        confidence: 0.8,
        priority: 100,
      },
      {
        type: 'fix',
        title: 'Restart plugin',
        description: 'Restart the plugin to recover from runtime error',
        confidence: 0.7,
        priority: 90,
        action: {
          type: 'command',
          payload: `plugin.restart('${this.pluginId}')`,
        },
      },
      {
        type: 'workaround',
        title: 'Disable problematic operation',
        description: `Temporarily disable the '${this.operation}' operation`,
        confidence: 0.6,
        priority: 60,
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'operation-retry',
        priority: 90,
        description: 'Retry the failed operation',
        estimatedTime: 1000,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'operation-retry',
          duration: 500,
        }),
      },
      {
        name: 'plugin-isolation',
        priority: 70,
        description: 'Isolate plugin to prevent cascading failures',
        estimatedTime: 500,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'plugin-isolation',
          duration: 300,
        }),
      },
    ];
  }
}

/**
 * Plugin version conflict error
 */
export class PluginVersionConflictError extends PluginError {
  readonly code = 'PLUGIN_VERSION_CONFLICT';
  readonly severity = 'high' as const;
  readonly recoverable = true;

  constructor(
    pluginId: PluginId,
    public readonly requiredVersion: string,
    public readonly actualVersion: string,
    public readonly requiredBy: PluginId[],
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(
      `Plugin '${pluginId}' version conflict: required ${requiredVersion}, found ${actualVersion}`,
      pluginId,
      'validation',
      options
    );
  }

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'fix',
        title: 'Update plugin version',
        description: `Update ${this.pluginId} to version ${this.requiredVersion}`,
        confidence: 0.9,
        priority: 120,
        action: {
          type: 'command',
          payload: `pnpm add ${this.pluginId}@${this.requiredVersion}`,
        },
      },
      {
        type: 'fix',
        title: 'Check compatibility',
        description: 'Verify version compatibility with dependent plugins',
        confidence: 0.8,
        priority: 100,
      },
      {
        type: 'workaround',
        title: 'Use version override',
        description: 'Override version check (may cause instability)',
        confidence: 0.4,
        priority: 40,
        action: {
          type: 'config',
          payload: { versionOverrides: { [this.pluginId]: this.actualVersion } },
        },
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'version-update',
        priority: 100,
        description: 'Update to compatible version',
        estimatedTime: 5000,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: false,
          strategy: 'version-update',
          duration: 0,
          message: 'Automatic version updates not implemented',
        }),
      },
    ];
  }
}

/**
 * Plugin timeout error
 */
export class PluginTimeoutError extends PluginError {
  readonly code = 'PLUGIN_TIMEOUT';
  readonly severity = 'medium' as const;
  readonly recoverable = true;

  constructor(
    pluginId: PluginId,
    public readonly operation: string,
    public readonly timeout: number,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(
      `Plugin '${pluginId}' operation '${operation}' timed out after ${timeout}ms`,
      pluginId,
      'runtime',
      options
    );
  }

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'fix',
        title: 'Increase timeout',
        description: `Increase timeout for operation '${this.operation}' (current: ${this.timeout}ms)`,
        confidence: 0.8,
        priority: 100,
        action: {
          type: 'config',
          payload: { timeouts: { [this.operation]: this.timeout * 2 } },
        },
      },
      {
        type: 'debug',
        title: 'Profile operation performance',
        description: 'Analyze why the operation is taking longer than expected',
        confidence: 0.9,
        priority: 90,
      },
      {
        type: 'workaround',
        title: 'Disable timeout',
        description: 'Disable timeout for this operation (not recommended)',
        confidence: 0.3,
        priority: 30,
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'timeout-extension',
        priority: 80,
        description: 'Extend timeout and retry',
        estimatedTime: this.timeout,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'timeout-extension',
          duration: 100,
        }),
      },
      {
        name: 'operation-cancellation',
        priority: 60,
        description: 'Cancel the operation and continue',
        estimatedTime: 100,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'operation-cancellation',
          duration: 50,
        }),
      },
    ];
  }
}
