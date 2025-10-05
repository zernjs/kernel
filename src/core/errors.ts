/**
 * @file Error handling system for the Zern Kernel
 * @description Provides a unified error handling system for the Kernel
 */

export abstract class ZernError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class PluginError extends ZernError {
  readonly code: string = 'PLUGIN_ERROR';
}

export class PluginNotFoundError extends PluginError {
  readonly code = 'PLUGIN_NOT_FOUND';

  constructor(pluginId: string) {
    super(`Plugin not found: ${pluginId}`);
  }
}

export class PluginLoadError extends PluginError {
  readonly code = 'PLUGIN_LOAD_ERROR';

  constructor(pluginId: string, cause?: Error) {
    super(`Failed to load plugin ${pluginId}`, cause);
  }
}

export class PluginDependencyError extends PluginError {
  readonly code = 'PLUGIN_DEPENDENCY_ERROR';

  constructor(pluginId: string, dependencyId: string) {
    super(`Dependency error in plugin ${pluginId}: missing ${dependencyId}`);
  }
}

export class KernelError extends ZernError {
  readonly code: string = 'KERNEL_ERROR';
}

export class KernelInitializationError extends KernelError {
  readonly code = 'KERNEL_INITIALIZATION_ERROR';

  constructor(cause?: Error) {
    super('Failed to initialize kernel', cause);
  }
}

export class CircularDependencyError extends KernelError {
  readonly code = 'CIRCULAR_DEPENDENCY_ERROR';

  constructor(cycle: readonly string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`);
  }
}

export class VersionError extends ZernError {
  readonly code: string = 'VERSION_ERROR';
}

export class VersionMismatchError extends VersionError {
  readonly code = 'VERSION_MISMATCH_ERROR';

  constructor(pluginId: string, required: string, actual: string) {
    super(`Version mismatch for ${pluginId}: required ${required}, got ${actual}`);
  }
}
