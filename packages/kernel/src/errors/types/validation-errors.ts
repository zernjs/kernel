/**
 * @fileoverview Validation-related error types
 * @module @zern/kernel/errors/types/validation-errors
 */

import {
  ZernError,
  type ErrorSuggestion,
  type RecoveryStrategy,
  type RecoveryResult,
} from './base.js';

/**
 * Base class for all validation-related errors
 */
export abstract class ValidationError extends ZernError {
  readonly category = 'validation' as const;

  constructor(
    message: string,
    public readonly path: string,
    public readonly value: unknown,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(message, options);
  }
}

/**
 * Configuration validation error
 */
export class ConfigurationValidationError extends ValidationError {
  readonly code = 'CONFIG_VALIDATION_ERROR';
  readonly severity = 'medium' as const;
  readonly recoverable = true;

  constructor(
    path: string,
    value: unknown,
    public readonly expectedType: string,
    public readonly validationRule?: string,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(
      `Configuration validation failed at '${path}': expected ${expectedType}, got ${typeof value}`,
      path,
      value,
      options
    );
  }

  getSuggestions(): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [
      {
        type: 'fix',
        title: 'Fix configuration type',
        description: `Change value at '${this.path}' to type ${this.expectedType}`,
        confidence: 0.9,
        priority: 120,
      },
      {
        type: 'fix',
        title: 'Use default value',
        description: 'Reset to default configuration value',
        confidence: 0.8,
        priority: 100,
        action: {
          type: 'config',
          payload: { resetPath: this.path },
        },
      },
      {
        type: 'documentation',
        title: 'Configuration documentation',
        description: 'Review configuration schema documentation',
        confidence: 0.7,
        priority: 80,
        action: {
          type: 'link',
          payload: 'https://docs.zern.dev/configuration',
        },
      },
    ];

    if (this.validationRule) {
      suggestions.unshift({
        type: 'fix',
        title: 'Follow validation rule',
        description: `Ensure value follows rule: ${this.validationRule}`,
        confidence: 0.95,
        priority: 130,
      });
    }

    // Add type-specific suggestions
    if (this.expectedType === 'string' && typeof this.value === 'number') {
      suggestions.unshift({
        type: 'fix',
        title: 'Convert to string',
        description: `Wrap value in quotes: "${this.value}"`,
        confidence: 0.9,
        priority: 110,
        action: {
          type: 'config',
          payload: { [this.path]: String(this.value) },
        },
      });
    }

    if (this.expectedType === 'number' && typeof this.value === 'string') {
      const numValue = Number(this.value);
      if (!isNaN(numValue)) {
        suggestions.unshift({
          type: 'fix',
          title: 'Convert to number',
          description: `Remove quotes: ${numValue}`,
          confidence: 0.9,
          priority: 110,
          action: {
            type: 'config',
            payload: { [this.path]: numValue },
          },
        });
      }
    }

    return suggestions;
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'type-coercion',
        priority: 90,
        description: 'Attempt automatic type conversion',
        estimatedTime: 100,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => {
          // Attempt type coercion
          try {
            let coercedValue: unknown;

            switch (this.expectedType) {
              case 'string':
                coercedValue = String(this.value);
                break;
              case 'number':
                coercedValue = Number(this.value);
                if (isNaN(coercedValue as number)) throw new Error('Invalid number');
                break;
              case 'boolean':
                coercedValue = Boolean(this.value);
                break;
              default:
                throw new Error(`Cannot coerce to ${this.expectedType}`);
            }

            return {
              success: true,
              strategy: 'type-coercion',
              duration: 50,
              message: `Coerced ${typeof this.value} to ${this.expectedType}`,
            };
          } catch {
            return {
              success: false,
              strategy: 'type-coercion',
              duration: 50,
              message: 'Type coercion failed',
            };
          }
        },
      },
      {
        name: 'default-value',
        priority: 80,
        description: 'Use default configuration value',
        estimatedTime: 50,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'default-value',
          duration: 25,
        }),
      },
    ];
  }
}

/**
 * Schema validation error
 */
export class SchemaValidationError extends ValidationError {
  readonly code = 'SCHEMA_VALIDATION_ERROR';
  readonly severity = 'medium' as const;
  readonly recoverable = true;

  constructor(
    path: string,
    value: unknown,
    public readonly schemaErrors: Array<{
      path: string;
      message: string;
      code?: string;
    }>,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    const errorMessages = schemaErrors.map(e => `${e.path}: ${e.message}`).join(', ');
    super(`Schema validation failed at '${path}': ${errorMessages}`, path, value, options);
  }

  getSuggestions(): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [
      {
        type: 'fix',
        title: 'Fix schema violations',
        description: 'Correct all schema validation errors',
        confidence: 0.9,
        priority: 120,
      },
      {
        type: 'debug',
        title: 'Validate schema',
        description: 'Run schema validation to see detailed errors',
        confidence: 0.8,
        priority: 100,
        action: {
          type: 'command',
          payload: 'pnpm run schema:validate',
        },
      },
    ];

    // Add specific suggestions for each schema error
    this.schemaErrors.forEach((error, index) => {
      suggestions.push({
        type: 'fix',
        title: `Fix ${error.path}`,
        description: error.message,
        confidence: 0.8,
        priority: 110 - index * 5,
      });
    });

    return suggestions;
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'schema-repair',
        priority: 85,
        description: 'Attempt to repair schema violations',
        estimatedTime: 500,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'schema-repair',
          duration: 300,
        }),
      },
      {
        name: 'partial-validation',
        priority: 60,
        description: 'Use partial validation ignoring non-critical errors',
        estimatedTime: 100,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'partial-validation',
          duration: 50,
        }),
      },
    ];
  }
}

/**
 * Plugin metadata validation error
 */
export class PluginMetadataValidationError extends ValidationError {
  readonly code = 'PLUGIN_METADATA_VALIDATION_ERROR';
  readonly severity = 'high' as const;
  readonly recoverable = true;

  constructor(
    public readonly pluginId: string,
    path: string,
    value: unknown,
    public readonly requiredFields: string[],
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(`Plugin metadata validation failed for '${pluginId}' at '${path}'`, path, value, options);
  }

  getSuggestions(): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [
      {
        type: 'fix',
        title: 'Fix plugin metadata',
        description: `Ensure plugin '${this.pluginId}' has valid metadata`,
        confidence: 0.9,
        priority: 120,
      },
      {
        type: 'documentation',
        title: 'Plugin metadata schema',
        description: 'Review the plugin metadata schema requirements',
        confidence: 0.8,
        priority: 100,
        action: {
          type: 'link',
          payload: 'https://docs.zern.dev/plugins/metadata',
        },
      },
    ];

    // Add suggestions for missing required fields
    this.requiredFields.forEach(field => {
      suggestions.push({
        type: 'fix',
        title: `Add required field: ${field}`,
        description: `Plugin metadata must include '${field}' field`,
        confidence: 0.95,
        priority: 130,
      });
    });

    return suggestions;
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'metadata-defaults',
        priority: 80,
        description: 'Use default values for missing metadata fields',
        estimatedTime: 200,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'metadata-defaults',
          duration: 100,
        }),
      },
      {
        name: 'metadata-generation',
        priority: 70,
        description: 'Generate metadata from plugin analysis',
        estimatedTime: 1000,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'metadata-generation',
          duration: 800,
        }),
      },
    ];
  }
}

/**
 * Input validation error
 */
export class InputValidationError extends ValidationError {
  readonly code = 'INPUT_VALIDATION_ERROR';
  readonly severity = 'low' as const;
  readonly recoverable = true;

  constructor(
    path: string,
    value: unknown,
    public readonly constraints: Record<string, unknown>,
    options: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    } = {}
  ) {
    super(
      `Input validation failed at '${path}': value does not meet constraints`,
      path,
      value,
      options
    );
  }

  getSuggestions(): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [
      {
        type: 'fix',
        title: 'Fix input value',
        description: `Ensure input at '${this.path}' meets validation constraints`,
        confidence: 0.9,
        priority: 100,
      },
    ];

    // Add constraint-specific suggestions
    Object.entries(this.constraints).forEach(([constraint, value]) => {
      switch (constraint) {
        case 'min':
          suggestions.push({
            type: 'fix',
            title: `Increase value`,
            description: `Value must be at least ${value}`,
            confidence: 0.8,
            priority: 90,
          });
          break;
        case 'max':
          suggestions.push({
            type: 'fix',
            title: `Decrease value`,
            description: `Value must be at most ${value}`,
            confidence: 0.8,
            priority: 90,
          });
          break;
        case 'pattern':
          suggestions.push({
            type: 'fix',
            title: `Match pattern`,
            description: `Value must match pattern: ${value}`,
            confidence: 0.8,
            priority: 90,
          });
          break;
        case 'enum':
          suggestions.push({
            type: 'fix',
            title: `Use valid value`,
            description: `Value must be one of: ${Array.isArray(value) ? value.join(', ') : value}`,
            confidence: 0.9,
            priority: 95,
          });
          break;
      }
    });

    return suggestions;
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'input-sanitization',
        priority: 70,
        description: 'Sanitize input to meet constraints',
        estimatedTime: 100,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'input-sanitization',
          duration: 50,
        }),
      },
      {
        name: 'constraint-relaxation',
        priority: 40,
        description: 'Temporarily relax validation constraints',
        estimatedTime: 50,
        canRecover: (): boolean => true,
        recover: async (): Promise<RecoveryResult> => ({
          success: true,
          strategy: 'constraint-relaxation',
          duration: 25,
        }),
      },
    ];
  }
}
