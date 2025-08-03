/**
 * @fileoverview Dependency-related error types
 * @module @zern/kernel/errors/types/dependency-errors
 */

import type { PluginId } from '../../types/plugin.js';
import { ZernError, type ErrorSuggestion, type RecoveryStrategy } from './base.js';

/**
 * Base class for all dependency-related errors
 */
export abstract class DependencyError extends ZernError {
  readonly category = 'dependency' as const;

  constructor(
    message: string,
    public readonly dependencyChain: PluginId[],
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, options);
  }
}

/**
 * Circular dependency error
 */
export class CircularDependencyError extends DependencyError {
  readonly code = 'CIRCULAR_DEPENDENCY';
  readonly severity = 'high' as const;
  readonly recoverable = false;

  constructor(
    dependencyChain: PluginId[],
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    const cycle = [...dependencyChain, dependencyChain[0]];
    super(`Circular dependency detected: ${cycle.join(' -> ')}`, dependencyChain, options);
  }

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'fix',
        title: 'Break circular dependency',
        description: 'Remove or refactor dependencies to break the circular reference',
        confidence: 0.9,
        priority: 120,
      },
      {
        type: 'fix',
        title: 'Use optional dependencies',
        description: 'Convert some dependencies to optional to break the cycle',
        confidence: 0.8,
        priority: 100,
        action: {
          type: 'config',
          payload: {
            optionalDependencies: this.dependencyChain.slice(-2),
          },
        },
      },
      {
        type: 'fix',
        title: 'Introduce dependency injection',
        description: 'Use dependency injection to decouple plugins',
        confidence: 0.7,
        priority: 80,
      },
      {
        type: 'documentation',
        title: 'Dependency management guide',
        description: 'Review best practices for plugin dependency management',
        confidence: 0.8,
        priority: 70,
        action: {
          type: 'link',
          payload: 'https://docs.zern.dev/plugins/dependencies',
        },
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return []; // Circular dependencies cannot be automatically recovered
  }
}

/**
 * Missing dependency error
 */
export class MissingDependencyError extends DependencyError {
  readonly code = 'MISSING_DEPENDENCY';
  readonly severity = 'high' as const;
  readonly recoverable = true;

  constructor(
    public readonly missingDependency: PluginId,
    public readonly requiredBy: PluginId,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(
      `Missing dependency '${missingDependency}' required by '${requiredBy}'`,
      [requiredBy, missingDependency],
      options
    );
  }

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'fix',
        title: 'Install missing dependency',
        description: `Install the missing plugin: ${this.missingDependency}`,
        confidence: 0.95,
        priority: 120,
        action: {
          type: 'command',
          payload: `pnpm add ${this.missingDependency}`,
        },
      },
      {
        type: 'fix',
        title: 'Check dependency name',
        description: 'Verify that the dependency name is correct',
        confidence: 0.8,
        priority: 100,
      },
      {
        type: 'workaround',
        title: 'Mark as optional',
        description: 'Mark the dependency as optional if not strictly required',
        confidence: 0.6,
        priority: 70,
        action: {
          type: 'config',
          payload: {
            optionalDependencies: [this.missingDependency],
          },
        },
      },
      {
        type: 'workaround',
        title: 'Disable dependent plugin',
        description: `Disable plugin '${this.requiredBy}' that requires the missing dependency`,
        confidence: 0.5,
        priority: 50,
        action: {
          type: 'config',
          payload: {
            disabledPlugins: [this.requiredBy],
          },
        },
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'dependency-install',
        priority: 100,
        description: 'Install missing dependency',
        estimatedTime: 10000,
        canRecover: () => true,
        recover: async () => ({
          success: false,
          strategy: 'dependency-install',
          duration: 0,
          message: 'Automatic dependency installation not implemented',
        }),
      },
      {
        name: 'optional-dependency',
        priority: 80,
        description: 'Mark dependency as optional',
        estimatedTime: 100,
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'optional-dependency',
          duration: 50,
        }),
      },
      {
        name: 'plugin-disable',
        priority: 60,
        description: 'Disable dependent plugin',
        estimatedTime: 200,
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'plugin-disable',
          duration: 100,
        }),
      },
    ];
  }
}

/**
 * Dependency version mismatch error
 */
export class DependencyVersionMismatchError extends DependencyError {
  readonly code = 'DEPENDENCY_VERSION_MISMATCH';
  readonly severity = 'medium' as const;
  readonly recoverable = true;

  constructor(
    public readonly dependency: PluginId,
    public readonly requiredVersion: string,
    public readonly actualVersion: string,
    public readonly requiredBy: PluginId,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(
      `Dependency version mismatch: '${dependency}' requires ${requiredVersion}, found ${actualVersion}`,
      [requiredBy, dependency],
      options
    );
  }

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'fix',
        title: 'Update dependency version',
        description: `Update ${this.dependency} to version ${this.requiredVersion}`,
        confidence: 0.9,
        priority: 120,
        action: {
          type: 'command',
          payload: `pnpm add ${this.dependency}@${this.requiredVersion}`,
        },
      },
      {
        type: 'fix',
        title: 'Check version compatibility',
        description: 'Verify if the current version is compatible despite the mismatch',
        confidence: 0.7,
        priority: 90,
      },
      {
        type: 'workaround',
        title: 'Override version check',
        description: 'Override the version check (may cause compatibility issues)',
        confidence: 0.4,
        priority: 40,
        action: {
          type: 'config',
          payload: {
            versionOverrides: {
              [this.dependency]: this.actualVersion,
            },
          },
        },
      },
      {
        type: 'fix',
        title: 'Update dependent plugin',
        description: `Update ${this.requiredBy} to work with ${this.dependency}@${this.actualVersion}`,
        confidence: 0.6,
        priority: 70,
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'version-compatibility-check',
        priority: 90,
        description: 'Check if versions are actually compatible',
        estimatedTime: 500,
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'version-compatibility-check',
          duration: 200,
        }),
      },
      {
        name: 'version-override',
        priority: 60,
        description: 'Override version check temporarily',
        estimatedTime: 100,
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'version-override',
          duration: 50,
        }),
      },
    ];
  }
}

/**
 * Dependency resolution timeout error
 */
export class DependencyResolutionTimeoutError extends DependencyError {
  readonly code = 'DEPENDENCY_RESOLUTION_TIMEOUT';
  readonly severity = 'medium' as const;
  readonly recoverable = true;

  constructor(
    dependencyChain: PluginId[],
    public readonly timeout: number,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(
      `Dependency resolution timed out after ${timeout}ms for chain: ${dependencyChain.join(' -> ')}`,
      dependencyChain,
      options
    );
  }

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'fix',
        title: 'Increase resolution timeout',
        description: `Increase dependency resolution timeout (current: ${this.timeout}ms)`,
        confidence: 0.8,
        priority: 100,
        action: {
          type: 'config',
          payload: {
            dependencyResolutionTimeout: this.timeout * 2,
          },
        },
      },
      {
        type: 'debug',
        title: 'Check dependency complexity',
        description: 'Analyze the dependency chain for complexity issues',
        confidence: 0.9,
        priority: 90,
      },
      {
        type: 'fix',
        title: 'Simplify dependencies',
        description: 'Reduce the complexity of the dependency chain',
        confidence: 0.7,
        priority: 80,
      },
      {
        type: 'workaround',
        title: 'Use parallel resolution',
        description: 'Enable parallel dependency resolution if available',
        confidence: 0.6,
        priority: 60,
        action: {
          type: 'config',
          payload: {
            parallelDependencyResolution: true,
          },
        },
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'timeout-extension',
        priority: 80,
        description: 'Extend timeout and retry resolution',
        estimatedTime: this.timeout,
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'timeout-extension',
          duration: 100,
        }),
      },
      {
        name: 'parallel-resolution',
        priority: 70,
        description: 'Use parallel resolution strategy',
        estimatedTime: this.timeout / 2,
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'parallel-resolution',
          duration: 200,
        }),
      },
    ];
  }
}

/**
 * Dependency conflict error
 */
export class DependencyConflictError extends DependencyError {
  readonly code = 'DEPENDENCY_CONFLICT';
  readonly severity = 'high' as const;
  readonly recoverable = true;

  constructor(
    public readonly conflictingDependency: PluginId,
    public readonly conflictingVersions: Array<{
      version: string;
      requiredBy: PluginId[];
    }>,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    const versions = conflictingVersions
      .map(v => `${v.version} (by ${v.requiredBy.join(', ')})`)
      .join(', ');
    super(
      `Dependency conflict for '${conflictingDependency}': ${versions}`,
      [conflictingDependency],
      options
    );
  }

  getSuggestions(): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [
      {
        type: 'fix',
        title: 'Resolve version conflict',
        description: 'Choose a compatible version that satisfies all requirements',
        confidence: 0.8,
        priority: 120,
      },
      {
        type: 'fix',
        title: 'Update conflicting plugins',
        description: 'Update plugins to use compatible dependency versions',
        confidence: 0.7,
        priority: 100,
      },
      {
        type: 'workaround',
        title: 'Use version ranges',
        description: 'Configure version ranges to allow compatible versions',
        confidence: 0.6,
        priority: 80,
      },
    ];

    // Add specific suggestions for each conflicting version
    this.conflictingVersions.forEach((conflict, index) => {
      suggestions.push({
        type: 'fix',
        title: `Use version ${conflict.version}`,
        description: `Use ${this.conflictingDependency}@${conflict.version} (required by ${conflict.requiredBy.join(', ')})`,
        confidence: 0.5,
        priority: 60 - index * 10,
        action: {
          type: 'command',
          payload: `pnpm add ${this.conflictingDependency}@${conflict.version}`,
        },
      });
    });

    return suggestions;
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'version-resolution',
        priority: 90,
        description: 'Automatically resolve to compatible version',
        estimatedTime: 2000,
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'version-resolution',
          duration: 1500,
        }),
      },
      {
        name: 'conflict-ignore',
        priority: 40,
        description: 'Ignore version conflicts (may cause issues)',
        estimatedTime: 100,
        canRecover: () => true,
        recover: async () => ({
          success: true,
          strategy: 'conflict-ignore',
          duration: 50,
        }),
      },
    ];
  }
}
