/**
 * Exports públicos do Zern Kernel
 * API limpa e organizada para consumidores
 */

// Core exports
export type {
  PluginId,
  KernelId,
  Version,
  KernelContext,
  KernelConfig,
  PluginState,
  PluginMetadata,
  PluginDependency,
  PluginExtension,
} from '@/core';

export type { Result } from '@/core';
export {
  success,
  failure,
  isSuccess,
  isFailure,
  mapResult,
  chainResult,
  collectResults,
} from '@/core';

export {
  ZernError,
  PluginError,
  PluginNotFoundError,
  PluginLoadError,
  PluginDependencyError,
  KernelError,
  KernelInitializationError,
  CircularDependencyError,
  VersionError,
  VersionMismatchError,
} from '@/core';

// Plugin exports
export type { PluginSetupContext, BuiltPlugin, PluginBuilder } from '@/plugin';
export { plugin } from '@/plugin';

export type { PluginRegistry } from '@/plugin';
export { createPluginRegistry } from '@/plugin';

export type { DependencyResolver } from '@/plugin';
export { createDependencyResolver } from '@/plugin';

// Kernel exports
export type { Kernel, BuiltKernel, KernelBuilder } from '@/kernel';
export { createKernel } from '@/kernel';

export type { PluginContainer } from '@/kernel';
export { createPluginContainer } from '@/kernel';

export type { LifecycleManager } from '@/kernel';
export { createLifecycleManager } from '@/kernel';

// Extension exports
export type { ExtensionManager } from '@/extension';
export { createExtensionManager } from '@/extension';

// Utility exports
export type { SemanticVersion } from '@/utils';
export { parseVersion, compareVersions, satisfiesVersion, isValidVersionRange } from '@/utils';

export {
  isValidPluginName,
  isValidKernelId,
  validatePluginName,
  validateKernelId,
  isNonEmptyString,
  isObject,
  isFunction,
} from '@/utils';

export {
  isPluginState,
  isPluginDependency,
  isPluginExtension,
  isPluginMetadata,
  isBuiltPlugin,
  isResult,
} from '@/utils';

// Convenience exports
export { createPluginId, createKernelId, createVersion } from './core/types.js';
