/**
 * Tipos de erro base para o Zern Kernel
 */

/**
 * Erro base para todos os erros do kernel
 */
export abstract class ZernError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Categorias de erro
 */
export enum ErrorCategory {
  PLUGIN = 'PLUGIN',
  KERNEL = 'KERNEL',
  DEPENDENCY = 'DEPENDENCY',
  VALIDATION = 'VALIDATION',
  LIFECYCLE = 'LIFECYCLE',
}

/**
 * Erros relacionados a plugins
 */
export class PluginNotFoundError extends ZernError {
  readonly code = 'PLUGIN_NOT_FOUND';
  readonly category = ErrorCategory.PLUGIN;
}

export class PluginLoadError extends ZernError {
  readonly code = 'PLUGIN_LOAD_ERROR';
  readonly category = ErrorCategory.PLUGIN;
}

export class PluginInitializationError extends ZernError {
  readonly code = 'PLUGIN_INITIALIZATION_ERROR';
  readonly category = ErrorCategory.PLUGIN;
}

export class DuplicatePluginError extends ZernError {
  readonly code = 'DUPLICATE_PLUGIN';
  readonly category = ErrorCategory.PLUGIN;
}

/**
 * Erros relacionados ao kernel
 */
export class KernelNotInitializedError extends ZernError {
  readonly code = 'KERNEL_NOT_INITIALIZED';
  readonly category = ErrorCategory.KERNEL;
}

export class KernelAlreadyInitializedError extends ZernError {
  readonly code = 'KERNEL_ALREADY_INITIALIZED';
  readonly category = ErrorCategory.KERNEL;
}

/**
 * Erros relacionados a dependências
 */
export class DependencyResolutionError extends ZernError {
  readonly code = 'DEPENDENCY_RESOLUTION_ERROR';
  readonly category = ErrorCategory.DEPENDENCY;
}

export class CircularDependencyError extends ZernError {
  readonly code = 'CIRCULAR_DEPENDENCY';
  readonly category = ErrorCategory.DEPENDENCY;
}

export class VersionConflictError extends ZernError {
  readonly code = 'VERSION_CONFLICT';
  readonly category = ErrorCategory.DEPENDENCY;
}

/**
 * Erros de validação
 */
export class ValidationError extends ZernError {
  readonly code: string = 'VALIDATION_ERROR';
  readonly category = ErrorCategory.VALIDATION;
}

export class InvalidVersionError extends ValidationError {
  readonly code = 'INVALID_VERSION';
}

export class InvalidPluginNameError extends ValidationError {
  readonly code = 'INVALID_PLUGIN_NAME';
}

/**
 * Union type de todos os erros possíveis
 */
export type KernelError =
  | PluginNotFoundError
  | PluginLoadError
  | PluginInitializationError
  | DuplicatePluginError
  | KernelNotInitializedError
  | KernelAlreadyInitializedError
  | DependencyResolutionError
  | CircularDependencyError
  | VersionConflictError
  | ValidationError
  | InvalidVersionError
  | InvalidPluginNameError;
