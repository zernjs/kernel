/**
 * Repository implementations for the infrastructure layer.
 * Provides concrete implementations of domain repository interfaces.
 */

export { InMemoryPluginRepository } from './plugin.repository.impl';
export { InMemoryKernelRepository } from './kernel.repository.impl';

// Re-export repository interfaces for convenience
export type { PluginRepository } from '../../domain/plugin/plugin.repository';
export type { KernelRepository } from '../../domain/kernel/kernel.repository';
