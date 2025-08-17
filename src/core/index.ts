/**
 * @file Zern Kernel core module exports.
 * Provides the main API for the Zern Kernel plugin system.
 */

// Core types
export type {
  SemVer,
  VersionConstraint,
  PluginDependency,
  LoadOrderConstraint,
  Plugin,
  KernelConfig,
  PluginRegistrationOptions,
  ResolutionResult,
  DependencyConflict,
  DependencyError,
  KernelState,
  PluginState,
} from './types.js';

// Core kernel
export { ZernKernel, ZernKernelInstance, getGlobalKernel, resetGlobalKernel } from './kernel.js';

// Plugin builder
export {
  plugin,
  typedPlugin,
  simplePlugin,
  type PluginBuilder,
  type DependencyBuilder,
} from './plugin-builder.js';

// Kernel builder
export {
  createKernel,
  createProductionKernel,
  createDevelopmentKernel,
  createTestKernel,
  quickKernel,
  type KernelBuilder,
} from './kernel-builder.js';

// Global resolver
export {
  GlobalResolver,
  getGlobalPlugin,
  requireGlobalPlugin,
  hasGlobalPlugin,
  inject,
  injectRequired,
  waitForPlugin,
} from './global-resolver.js';

// Extension utilities
export {
  override,
  extend,
  overload,
  addMiddleware,
  addMethod,
  createExtensionHelper,
  createChainableAPI,
  type ExtensionOperation,
  type ExtensionContext,
  type MiddlewareFunction,
  type WithAddedMethod,
  type WithOverriddenMethod,
  type ChainableAPI,
  type FluentChain,
  type ChainableResult,
} from './extension-utils.js';

// Dependency resolution
export {
  DependencyGraph,
  VersionResolver,
  TopologicalSorter,
  ConflictDetector,
  DependencyResolver,
  createDependencyResolver,
  quickResolve,
  type PluginEntry,
  type ResolutionContext,
  type DetailedResolutionResult,
  type VersionRequirement,
  type VersionResolution,
  type LoadOrderSpec,
  type SortResult,
  type ConflictResolutionStrategy,
  type ConflictResolution,
} from './dependency-resolver/index.js';

// Utilities
export {
  parseVersion,
  parseConstraint,
  compareVersions,
  satisfiesConstraint,
  stringifyVersion,
  getHighestVersion,
} from './utils/index.js';
