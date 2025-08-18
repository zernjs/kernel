/**
 * Dependency Injection Container for the Zern Kernel.
 * Manages service instantiation and dependency resolution.
 */

import { PluginService } from '../../application/services/plugin.service';
import { KernelService } from '../../application/services/kernel.service';
import { ExtensionService } from '../../application/services/extension.service';
import { InMemoryPluginRepository } from '../repositories/plugin.repository.impl';
import { InMemoryKernelRepository } from '../repositories/kernel.repository.impl';
import type { PluginRepository } from '../../domain/plugin/plugin.repository';
import type { KernelRepository } from '../../domain/kernel/kernel.repository';

/**
 * Service container interface for dependency injection.
 */
export interface ServiceContainer {
  readonly pluginService: PluginService;
  readonly kernelService: KernelService;
  readonly extensionService: ExtensionService;
  readonly pluginRepository: PluginRepository;
  readonly kernelRepository: KernelRepository;
}

/**
 * Container configuration options.
 */
export interface ContainerConfig {
  readonly useInMemoryRepositories?: boolean;
  readonly pluginRepository?: PluginRepository;
  readonly kernelRepository?: KernelRepository;
}

/**
 * Creates and configures the service container with all dependencies.
 */
export function createContainer(config: ContainerConfig = {}): ServiceContainer {
  // Create repository instances
  const pluginRepository = config.pluginRepository ?? new InMemoryPluginRepository();
  const kernelRepository = config.kernelRepository ?? new InMemoryKernelRepository();

  // Create service instances with injected dependencies
  const pluginService = new PluginService(pluginRepository);
  const kernelService = new KernelService(kernelRepository);
  const extensionService = new ExtensionService();

  return {
    pluginService,
    kernelService,
    extensionService,
    pluginRepository,
    kernelRepository,
  };
}

/**
 * Global container instance for singleton access.
 * This should be used sparingly and primarily for backward compatibility.
 */
let globalContainer: ServiceContainer | null = null;

/**
 * Gets or creates the global container instance.
 */
export function getGlobalContainer(config?: ContainerConfig): ServiceContainer {
  if (!globalContainer) {
    globalContainer = createContainer(config);
  }
  return globalContainer;
}

/**
 * Resets the global container (useful for testing).
 */
export function resetGlobalContainer(): void {
  globalContainer = null;
}

/**
 * Type-safe service accessor for the container.
 */
export type ServiceType = keyof ServiceContainer;

/**
 * Gets a specific service from the container.
 */
export function getService<T extends ServiceType>(
  container: ServiceContainer,
  serviceType: T
): ServiceContainer[T] {
  return container[serviceType];
}
