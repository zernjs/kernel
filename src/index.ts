/**
 * @file Zern Kernel - Pure plugin engine with automatic dependency resolution.
 *
 * The Zern Kernel is a lightweight, type-safe plugin system that provides:
 * - Automatic plugin discovery and dependency resolution
 * - Lifecycle management with state tracking
 * - Plugin augmentation and hot-reload capabilities
 * - Zero-configuration setup with intelligent defaults
 */

// Re-export everything from core
export * from './core/index.js';

// Convenience aliases for common use cases
export {
  ZernKernel as Kernel,
  createKernel as kernel,
  quickKernel,
  plugin,
  getGlobalPlugin as getPlugin,
  requireGlobalPlugin as requirePlugin,
  hasGlobalPlugin as hasPlugin,
} from './core/index.js';

// Extension utilities
export {
  override,
  extend,
  overload,
  addMiddleware,
  addMethod,
  createExtensionHelper,
  createChainableAPI,
} from './core/extension-utils.js';

// Type aliases for better DX
export type {
  Plugin as PluginInterface,
  KernelConfig as Config,
  PluginDependency as Dependency,
  WithAddedMethod,
  WithOverriddenMethod,
  ChainableAPI,
  FluentChain,
  ChainableResult,
} from './core/index.js';
