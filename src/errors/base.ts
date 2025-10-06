import { ErrorSeverity, type ErrorContext, type ErrorSolution } from './types';
import { parseStackTrace } from './stack-parser';

export interface ZernErrorOptions {
  cause?: Error;
  severity?: ErrorSeverity;
  context?: ErrorContext;
  solutions?: ErrorSolution[];
}

export abstract class ZernError extends Error {
  abstract readonly code: string;

  public severity: ErrorSeverity;
  public context: ErrorContext;
  public solutions: ErrorSolution[];
  public readonly timestamp: Date;
  public override cause?: Error;

  constructor(message: string, options?: ZernErrorOptions) {
    super(message);
    this.name = this.constructor.name;
    this.severity = options?.severity ?? ErrorSeverity.ERROR;
    this.context = options?.context ?? {};
    this.solutions = options?.solutions ?? [];
    this.timestamp = new Date();
    this.cause = options?.cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    if (this.stack) {
      const parsed = parseStackTrace(this.stack);
      if (parsed[0]) {
        this.context.file = this.context.file ?? parsed[0].file;
        this.context.line = this.context.line ?? parsed[0].line;
        this.context.column = this.context.column ?? parsed[0].column;
      }
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      solutions: this.solutions,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
          }
        : undefined,
    };
  }
}

export class PluginError extends ZernError {
  readonly code: string = 'PLUGIN_ERROR';
}

export class PluginNotFoundError extends PluginError {
  readonly code = 'PLUGIN_NOT_FOUND';

  constructor(context?: { plugin?: string; availablePlugins?: string[] }) {
    const pluginName = context?.plugin ?? 'unknown';
    super(`Plugin not found: ${pluginName}`, {
      severity: ErrorSeverity.ERROR,
      context: context as ErrorContext,
      solutions: [
        {
          title: 'Register the plugin first',
          description: 'Use .use() to register the plugin before accessing it',
          code: `.use(${pluginName}Plugin)`,
        },
        {
          title: 'Check the plugin name',
          description: 'The plugin name may be incorrect',
          code: context?.availablePlugins?.length
            ? `Available: ${context.availablePlugins.join(', ')}`
            : undefined,
        },
      ],
    });
  }
}

export class PluginLoadError extends PluginError {
  readonly code = 'PLUGIN_LOAD_ERROR';

  constructor(context?: { plugin?: string; cause?: Error }) {
    const pluginName = context?.plugin ?? 'unknown';
    super(`Failed to load plugin: ${pluginName}`, {
      severity: ErrorSeverity.FATAL,
      cause: context?.cause,
      context: context as ErrorContext,
      solutions: [
        {
          title: 'Check plugin initialization',
          description: 'Verify that the plugin setup function is correct',
        },
        {
          title: 'Check dependencies',
          description: 'Ensure all required dependencies are registered',
        },
      ],
    });
  }
}

export class PluginDependencyError extends PluginError {
  readonly code = 'PLUGIN_DEPENDENCY_ERROR';

  constructor(context?: { plugin?: string; dependency?: string }) {
    const pluginName = context?.plugin ?? 'unknown';
    const depName = context?.dependency ?? 'unknown';
    super(`Dependency error in plugin ${pluginName}: missing ${depName}`, {
      severity: ErrorSeverity.FATAL,
      context: context as ErrorContext,
      solutions: [
        {
          title: 'Register the dependency',
          description: `Add ${depName} to the kernel before ${pluginName}`,
          code: `.use(${depName}Plugin)`,
        },
        {
          title: 'Check dependency order',
          description: 'Dependencies must be registered before dependent plugins',
        },
      ],
    });
  }
}

export class KernelError extends ZernError {
  readonly code: string = 'KERNEL_ERROR';
}

export class KernelInitializationError extends KernelError {
  readonly code = 'KERNEL_INITIALIZATION_ERROR';

  constructor(context?: { plugin?: string; cause?: Error }) {
    super('Failed to initialize kernel', {
      severity: ErrorSeverity.FATAL,
      cause: context?.cause,
      context: context as ErrorContext,
      solutions: [
        {
          title: 'Check plugin configurations',
          description: 'Verify that all plugins are correctly configured',
        },
        {
          title: 'Check for circular dependencies',
          description: 'Ensure there are no circular dependencies between plugins',
        },
      ],
    });
  }
}

export class CircularDependencyError extends KernelError {
  readonly code = 'CIRCULAR_DEPENDENCY_ERROR';

  constructor(context?: { cycle?: string[] }) {
    const cycle = context?.cycle ?? [];
    super(`Circular dependency detected: ${cycle.join(' -> ')}`, {
      severity: ErrorSeverity.FATAL,
      context: context as ErrorContext,
      solutions: [
        {
          title: 'Break the circular dependency',
          description: 'Refactor plugins to remove circular dependencies',
        },
        {
          title: 'Review plugin architecture',
          description: 'Consider using events or a mediator pattern instead',
        },
      ],
    });
  }
}

export class VersionError extends ZernError {
  readonly code: string = 'VERSION_ERROR';

  constructor(context?: ErrorContext, options?: Omit<ZernErrorOptions, 'context'>) {
    const version = (context as Record<string, unknown>)?.version ?? 'unknown';
    super(`Invalid version: ${version}`, {
      ...options,
      context: context as ErrorContext,
    });
  }
}

export class VersionMismatchError extends VersionError {
  readonly code = 'VERSION_MISMATCH_ERROR';

  constructor(context?: { plugin?: string; required?: string; actual?: string }) {
    const plugin = context?.plugin ?? 'unknown';
    const required = context?.required ?? 'unknown';
    const actual = context?.actual ?? 'unknown';
    super({ ...context, version: `${required} vs ${actual}` } as ErrorContext, {
      severity: ErrorSeverity.ERROR,
      solutions: [
        {
          title: 'Update the plugin version',
          description: `Install version ${required} of ${plugin}`,
        },
        {
          title: 'Adjust version requirements',
          description: 'Update the version range in .depends() to accept the current version',
        },
      ],
    });
    this.message = `Version mismatch for ${plugin}: required ${required}, got ${actual}`;
  }
}

export class ValidationError extends ZernError {
  readonly code = 'VALIDATION_ERROR';

  constructor(context?: ErrorContext, options?: Omit<ZernErrorOptions, 'context'>) {
    super('Validation failed', {
      ...options,
      severity: options?.severity ?? ErrorSeverity.ERROR,
      context,
    });
  }
}

export class ConfigurationError extends ZernError {
  readonly code = 'CONFIGURATION_ERROR';

  constructor(context?: ErrorContext, options?: Omit<ZernErrorOptions, 'context'>) {
    super('Configuration error', {
      ...options,
      severity: options?.severity ?? ErrorSeverity.ERROR,
      context,
    });
  }
}

export class GenericError extends ZernError {
  readonly code = 'GENERIC_ERROR';

  constructor(message: string, options?: ZernErrorOptions) {
    super(message, options);
  }
}
