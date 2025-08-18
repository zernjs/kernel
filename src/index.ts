/**
 * @file Zern Kernel - Pure plugin engine with automatic dependency resolution.
 *
 * The Zern Kernel is a lightweight, type-safe plugin system that provides:
 * - Automatic plugin discovery and dependency resolution
 * - Lifecycle management with state tracking
 * - Plugin extension and hot-reload capabilities
 * - Zero-configuration setup with intelligent defaults
 * - Complete type safety with branded types
 */

// Core builders following new API specification
export {
  plugin,
  type IPluginBuilder,
  PluginBuilderError,
} from './application/builders/plugin.builder.js';

export {
  createKernel,
  createProductionKernel,
  createDevelopmentKernel,
  createTestKernel,
  quickKernel,
  type IKernelBuilder,
  type IBuiltKernel,
  KernelBuilderError,
} from './application/builders/kernel.builder.js';

// Domain types and entities
export type {
  Plugin,
  PluginDependency,
  PluginExtension,
  PluginMetadata,
  PluginLifecycle,
  PluginConfig,
  PluginRegistrationOptions,
  PluginDependencyContext,
  PluginSetupFunction,
  TypedPlugin,
  ExtensionCallback,
} from './domain/plugin/plugin.types.js';

export type {
  KernelConfig,
  KernelMetadata,
  KernelLifecycle,
} from './domain/kernel/kernel.types.js';

export { KernelEntity } from './domain/kernel/kernel.entity.js';

// Shared types and utilities
export type {
  PluginId,
  KernelId,
  Version,
  PluginName,
  LifecycleState,
  BaseConfig,
  BaseMetadata,
  SetupFunction,
} from './shared/types/common.types.js';

export {
  createPluginId,
  createKernelId,
  createVersion,
  createPluginName,
} from './shared/types/common.types.js';

export type { Result } from './shared/types/result.types.js';

export {
  success,
  failure,
  isSuccess,
  isFailure,
  mapResult,
  mapError,
} from './shared/types/result.types.js';

// Repository interfaces
export type { PluginRepository, RepositoryError } from './domain/plugin/plugin.repository.js';

export type { KernelRepository, KernelRepositoryError } from './domain/kernel/kernel.repository.js';

// Repository implementations
export {
  InMemoryPluginRepository,
  InMemoryKernelRepository,
} from './infrastructure/repositories/index.js';

// Services
export { PluginService } from './application/services/plugin.service.js';
export { KernelService } from './application/services/kernel.service.js';
export { ExtensionService } from './application/services/extension.service.js';

// Dependency injection
export {
  createContainer,
  getGlobalContainer,
  type ServiceContainer,
} from './infrastructure/di/container.js';

// Convenience aliases for better DX
export { createKernel as kernel } from './application/builders/kernel.builder.js';
