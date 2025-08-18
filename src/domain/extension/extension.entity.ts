/**
 * @file Extension Entity - Core business logic for plugin extensions.
 * Encapsulates extension behavior and validation rules.
 */

import type { PluginId } from '../../shared/types/common.types.js';
import type {
  ExtensionCallback,
  ExtensionConfig,
  ExtensionCondition,
  ExtensionMetadata,
  ExtensionResult,
} from './extension.types.js';
import { ExtensionPriority } from './extension.types.js';

/**
 * Extension entity representing a plugin extension.
 */
export class ExtensionEntity<TTargetApi = unknown, TResult = unknown> {
  private readonly _metadata: ExtensionMetadata;
  private readonly _config: ExtensionConfig;
  private readonly _callback: ExtensionCallback<TTargetApi, TResult>;
  private _isActive: boolean = true;
  private _executionCount: number = 0;
  private _lastExecutionTime?: Date;
  private _lastError?: Error;

  constructor(
    metadata: ExtensionMetadata,
    config: ExtensionConfig,
    callback: ExtensionCallback<TTargetApi, TResult>
  ) {
    this._metadata = { ...metadata };
    this._config = { ...config };
    this._callback = callback;
    this.validateExtension();
  }

  /**
   * Gets extension metadata.
   */
  get metadata(): ExtensionMetadata {
    return { ...this._metadata };
  }

  /**
   * Gets extension configuration.
   */
  get config(): ExtensionConfig {
    return { ...this._config };
  }

  /**
   * Gets extension ID.
   */
  get id(): string {
    return this._metadata.id;
  }

  /**
   * Gets source plugin ID.
   */
  get sourcePluginId(): PluginId {
    return this._metadata.sourcePluginId;
  }

  /**
   * Gets target plugin ID.
   */
  get targetPluginId(): PluginId {
    return this._metadata.targetPluginId;
  }

  /**
   * Gets extension priority.
   */
  get priority(): ExtensionPriority {
    return this._config.priority ?? ExtensionPriority.NORMAL;
  }

  /**
   * Checks if extension is active.
   */
  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Gets execution count.
   */
  get executionCount(): number {
    return this._executionCount;
  }

  /**
   * Gets last execution time.
   */
  get lastExecutionTime(): Date | undefined {
    return this._lastExecutionTime;
  }

  /**
   * Gets last error.
   */
  get lastError(): Error | undefined {
    return this._lastError;
  }

  /**
   * Activates the extension.
   */
  activate(): void {
    this._isActive = true;
  }

  /**
   * Deactivates the extension.
   */
  deactivate(): void {
    this._isActive = false;
  }

  /**
   * Executes the extension callback.
   */
  async execute(
    targetApi: TTargetApi,
    context?: Record<string, unknown>
  ): Promise<ExtensionResult<TResult>> {
    if (!this._isActive) {
      return {
        success: false,
        error: new Error('Extension is not active'),
        executionTime: 0,
        metadata: this._metadata,
      };
    }

    // Validate conditions if present
    if (this._config.conditions) {
      const conditionsValid = this.validateConditions(this._config.conditions, targetApi, context);
      if (!conditionsValid) {
        return {
          success: false,
          error: new Error('Extension conditions not met'),
          executionTime: 0,
          metadata: this._metadata,
        };
      }
    }

    const startTime = Date.now();
    this._lastExecutionTime = new Date();
    this._executionCount++;

    try {
      const result = await this.executeWithTimeout(targetApi);
      const executionTime = Date.now() - startTime;
      this._lastError = undefined;

      return {
        success: true,
        result,
        executionTime,
        metadata: this._metadata,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this._lastError = error instanceof Error ? error : new Error(String(error));

      return {
        success: false,
        error: this._lastError,
        executionTime,
        metadata: this._metadata,
      };
    }
  }

  /**
   * Validates extension conditions.
   */
  private validateConditions(
    conditions: ExtensionCondition[],
    targetApi: unknown,
    context?: Record<string, unknown>
  ): boolean {
    return conditions.every(condition => {
      const value = this.extractValue(targetApi, condition.path);
      return this.evaluateCondition(condition, value, context);
    });
  }

  /**
   * Extracts value from target API using path.
   */
  private extractValue(target: unknown, path?: string): unknown {
    if (!path) return target;

    const keys = path.split('.');
    let current = target;

    for (const key of keys) {
      if (current == null || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  /**
   * Evaluates a single condition.
   */
  private evaluateCondition(
    condition: ExtensionCondition,
    actualValue: unknown,
    _context?: Record<string, unknown>
  ): boolean {
    const { operator, value: expectedValue } = condition;

    switch (operator) {
      case '=':
        return actualValue === expectedValue;
      case '!=':
        return actualValue !== expectedValue;
      case '>':
        return Number(actualValue) > Number(expectedValue);
      case '<':
        return Number(actualValue) < Number(expectedValue);
      case '>=':
        return Number(actualValue) >= Number(expectedValue);
      case '<=':
        return Number(actualValue) <= Number(expectedValue);
      case 'contains':
        return String(actualValue).includes(String(expectedValue));
      case 'matches':
        return new RegExp(String(expectedValue)).test(String(actualValue));
      default:
        return false;
    }
  }

  /**
   * Executes callback with timeout.
   */
  private async executeWithTimeout(targetApi: TTargetApi): Promise<TResult> {
    const timeout = this._config.timeout ?? 5000; // 5 seconds default

    return new Promise<TResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Extension execution timed out after ${timeout}ms`));
      }, timeout);

      Promise.resolve(this._callback(targetApi))
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Validates extension configuration and metadata.
   */
  private validateExtension(): void {
    if (!this._metadata.id) {
      throw new Error('Extension ID is required');
    }

    if (!this._metadata.sourcePluginId) {
      throw new Error('Source plugin ID is required');
    }

    if (!this._metadata.targetPluginId) {
      throw new Error('Target plugin ID is required');
    }

    if (!this._metadata.targetPluginName) {
      throw new Error('Target plugin name is required');
    }

    if (typeof this._callback !== 'function') {
      throw new Error('Extension callback must be a function');
    }

    if (this._config.timeout && this._config.timeout <= 0) {
      throw new Error('Extension timeout must be positive');
    }

    if (this._config.retries && this._config.retries < 0) {
      throw new Error('Extension retries must be non-negative');
    }
  }

  /**
   * Creates a copy of the extension with new configuration.
   */
  withConfig(newConfig: Partial<ExtensionConfig>): ExtensionEntity<TTargetApi, TResult> {
    const mergedConfig = { ...this._config, ...newConfig };
    return new ExtensionEntity(this._metadata, mergedConfig, this._callback);
  }

  /**
   * Checks if this extension can be applied to a target plugin.
   */
  canApplyTo(targetPluginId: PluginId): boolean {
    return this._metadata.targetPluginId === targetPluginId && this._isActive;
  }

  /**
   * Gets extension statistics.
   */
  getStats(): ExtensionStats {
    return {
      id: this._metadata.id,
      executionCount: this._executionCount,
      lastExecutionTime: this._lastExecutionTime,
      isActive: this._isActive,
      hasError: !!this._lastError,
      priority: this.priority,
    };
  }
}

/**
 * Extension statistics interface.
 */
export interface ExtensionStats {
  readonly id: string;
  readonly executionCount: number;
  readonly lastExecutionTime?: Date;
  readonly isActive: boolean;
  readonly hasError: boolean;
  readonly priority: ExtensionPriority;
}
