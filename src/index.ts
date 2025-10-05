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

export type { PluginSetupContext, BuiltPlugin, PluginBuilder } from '@/plugin';
export { plugin } from '@/plugin';

export type { PluginRegistry } from '@/plugin';
export { createPluginRegistry } from '@/plugin';

export type { DependencyResolver } from '@/plugin';
export { createDependencyResolver } from '@/plugin';

export type { Kernel, BuiltKernel, KernelBuilder } from '@/kernel';
export { createKernel } from '@/kernel';

export type { PluginContainer } from '@/kernel';

export type {
  ProxyConfig,
  ProxyContext,
  ProxyBefore,
  ProxyAfter,
  ProxyError,
  ProxyAround,
  ProxyDependenciesWildcard,
  ProxyGlobalWildcard,
  MethodPattern,
} from '@/extension/proxy-types';
export { createPluginContainer } from '@/kernel';

export type { LifecycleManager } from '@/kernel';
export { createLifecycleManager } from '@/kernel';

export { createDirectMethod, getGlobalKernel, setGlobalKernel } from '@/hooks';
export { createDirectExports } from '@/hooks';

export type { ExtensionManager } from '@/extension';
export { createExtensionManager } from '@/extension';

export type {
  Store,
  StoreOptions,
  StoreChange,
  WatchCallback,
  WatchAllCallback,
  WatchBatchCallback,
  ComputedValue,
  ComputedSelector,
} from '@/store';
export { createStore, isStore } from '@/store';

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

export {
  bindMethods,
  combineImplementations,
  createAPI,
  createAPIFactory,
  extendAPI,
  pickMethods,
} from '@/utils';

export { createPluginId, createKernelId, createVersion } from './core/types.js';
