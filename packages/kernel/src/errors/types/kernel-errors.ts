/**
 * @fileoverview Kernel-specific error types
 * @module @zern/kernel/errors/types/kernel-errors
 */

import type { KernelOperation } from './base.js';
import {
  ZernError,
  type ErrorSuggestion,
  type RecoveryStrategy,
  type RecoveryResult,
} from './base.js';

/**
 * Base class for all kernel-related errors
 */
export abstract class KernelError extends ZernError {
  readonly category = 'kernel' as const;

  constructor(
    message: string,
    public readonly operation: KernelOperation,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, options);
  }
}

/**
 * Kernel initialization error
 */
export class KernelInitializationError extends KernelError {
  readonly code = 'KERNEL_INIT_FAILED';
  readonly severity = 'critical' as const;
  readonly recoverable = false;

  constructor(
    message: string,
    public readonly phase: 'setup' | 'config' | 'plugins' | 'startup',
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, 'initialization', options);
  }

  getSuggestions(): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [
      {
        type: 'debug',
        title: 'Check kernel configuration',
        description: 'Verify that the kernel configuration is valid and complete',
        confidence: 0.9,
        priority: 100,
        action: {
          type: 'command',
          payload: 'pnpm run config:validate',
        },
      },
      {
        type: 'documentation',
        title: 'Kernel initialization guide',
        description: 'Review the kernel initialization documentation',
        confidence: 0.8,
        priority: 80,
        action: {
          type: 'link',
          payload: 'https://docs.zern.dev/kernel/initialization',
        },
      },
    ];

    if (this.phase === 'plugins') {
      suggestions.unshift({
        type: 'fix',
        title: 'Check plugin dependencies',
        description: 'Verify that all required plugins are installed and compatible',
        confidence: 0.95,
        priority: 120,
        action: {
          type: 'command',
          payload: 'pnpm run plugins:check',
        },
      });
    }

    return suggestions;
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return []; // Kernel initialization errors are not recoverable
  }
}

/**
 * Kernel state management error
 */
export class KernelStateError extends KernelError {
  readonly code = 'KERNEL_STATE_ERROR';
  readonly severity = 'high' as const;
  readonly recoverable = true;

  constructor(
    message: string,
    public readonly currentState: string,
    public readonly targetState: string,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, 'state-management', options);
  }

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'fix',
        title: 'Reset kernel state',
        description: 'Reset the kernel to a known good state',
        confidence: 0.8,
        priority: 100,
        action: {
          type: 'command',
          payload: 'kernel.reset()',
        },
      },
      {
        type: 'debug',
        title: 'Check state transitions',
        description: 'Verify that the state transition is valid',
        confidence: 0.7,
        priority: 80,
      },
      {
        type: 'workaround',
        title: 'Force state change',
        description: 'Force the kernel to the target state (use with caution)',
        confidence: 0.5,
        priority: 40,
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'state-reset',
        priority: 100,
        description: 'Reset kernel to previous stable state',
        estimatedTime: 1000,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'state-reset',
          duration: 500,
        }),
      },
    ];
  }
}

/**
 * Kernel shutdown error
 */
export class KernelShutdownError extends KernelError {
  readonly code = 'KERNEL_SHUTDOWN_ERROR';
  readonly severity = 'medium' as const;
  readonly recoverable = false;

  constructor(
    message: string,
    public readonly reason: 'timeout' | 'plugin-error' | 'force' | 'unknown',
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, 'shutdown', options);
  }

  getSuggestions(): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [
      {
        type: 'debug',
        title: 'Check shutdown logs',
        description: 'Review the shutdown process logs for more details',
        confidence: 0.9,
        priority: 100,
      },
    ];

    if (this.reason === 'timeout') {
      suggestions.unshift({
        type: 'fix',
        title: 'Increase shutdown timeout',
        description: 'Configure a longer shutdown timeout for plugins',
        confidence: 0.8,
        priority: 120,
        action: {
          type: 'config',
          payload: { shutdownTimeout: 30000 },
        },
      });
    }

    if (this.reason === 'plugin-error') {
      suggestions.unshift({
        type: 'fix',
        title: 'Check plugin shutdown hooks',
        description: 'Verify that all plugins implement proper shutdown hooks',
        confidence: 0.9,
        priority: 110,
      });
    }

    return suggestions;
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return []; // Shutdown errors are not recoverable
  }
}

/**
 * Kernel memory error
 */
export class KernelMemoryError extends KernelError {
  readonly code = 'KERNEL_MEMORY_ERROR';
  readonly severity = 'high' as const;
  readonly recoverable = true;

  constructor(
    message: string,
    public readonly memoryUsage: number,
    public readonly memoryLimit: number,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, 'state-management', options);
  }

  getSuggestions(): ErrorSuggestion[] {
    const percentage = (this.memoryUsage / this.memoryLimit) * 100;

    return [
      {
        type: 'fix',
        title: 'Trigger garbage collection',
        description: 'Force garbage collection to free up memory',
        confidence: 0.7,
        priority: 100,
        action: {
          type: 'command',
          payload: 'global.gc && global.gc()',
        },
      },
      {
        type: 'fix',
        title: 'Increase memory limit',
        description: `Current usage: ${percentage.toFixed(1)}%. Consider increasing Node.js memory limit`,
        confidence: 0.8,
        priority: 90,
        action: {
          type: 'command',
          payload: 'node --max-old-space-size=4096',
        },
      },
      {
        type: 'debug',
        title: 'Analyze memory usage',
        description: 'Generate heap snapshot to analyze memory usage patterns',
        confidence: 0.9,
        priority: 80,
        action: {
          type: 'command',
          payload: 'pnpm run debug:memory',
        },
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'garbage-collection',
        priority: 100,
        description: 'Force garbage collection',
        estimatedTime: 500,
        canRecover: (): boolean => typeof global.gc === 'function',
        recover: async (): Promise<RecoveryResult> => {
          if (global.gc) {
            global.gc();
            return {
              success: true,
              strategy: 'garbage-collection',
              duration: 100,
            };
          }
          return {
            success: false,
            strategy: 'garbage-collection',
            duration: 0,
            message: 'Garbage collection not available',
          };
        },
      },
    ];
  }
}

/**
 * Kernel performance error
 */
export class KernelPerformanceError extends KernelError {
  readonly code = 'KERNEL_PERFORMANCE_ERROR';
  readonly severity = 'medium' as const;
  readonly recoverable = true;

  constructor(
    message: string,
    public readonly metric: string,
    public readonly value: number,
    public readonly threshold: number,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, 'state-management', options);
  }

  getSuggestions(): ErrorSuggestion[] {
    return [
      {
        type: 'debug',
        title: 'Profile performance',
        description: `${this.metric} is ${this.value} (threshold: ${this.threshold}). Run performance profiling`,
        confidence: 0.9,
        priority: 100,
        action: {
          type: 'command',
          payload: 'pnpm run profile',
        },
      },
      {
        type: 'fix',
        title: 'Optimize configuration',
        description: 'Review and optimize kernel configuration for better performance',
        confidence: 0.7,
        priority: 80,
      },
      {
        type: 'workaround',
        title: 'Increase threshold',
        description: 'Temporarily increase the performance threshold',
        confidence: 0.5,
        priority: 40,
      },
    ];
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'performance-optimization',
        priority: 80,
        description: 'Apply automatic performance optimizations',
        estimatedTime: 2000,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'performance-optimization',
          duration: 1500,
        }),
      },
    ];
  }
}
