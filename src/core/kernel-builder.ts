/**
 * @file Fluent API for building and configuring Zern Kernels.
 * Provides an intuitive interface for kernel creation with validation.
 */

import type { KernelConfig, Plugin, PluginRegistrationOptions } from './types.js';
import { ZernKernelInstance } from './kernel.js';

/**
 * Plugin registration entry for the builder.
 */
interface PluginEntry {
  readonly plugin: Plugin;
  readonly options: PluginRegistrationOptions;
}

/**
 * Fluent builder interface for kernel configuration.
 */
export interface KernelBuilder {
  /**
   * Enables automatic global kernel registration.
   * When enabled, the kernel will be available globally.
   */
  withAutoGlobal(enabled?: boolean): this;

  /**
   * Enables strict version checking for dependencies.
   * When enabled, version conflicts will cause initialization to fail.
   */
  withStrictVersioning(enabled?: boolean): this;

  /**
   * Allows circular dependencies between plugins.
   * Use with caution as it can lead to initialization issues.
   */
  withCircularDependencies(enabled?: boolean): this;

  /**
   * Registers a plugin with the kernel.
   * @param plugin - Plugin to register
   * @param options - Registration options
   */
  withPlugin(plugin: Plugin, options?: PluginRegistrationOptions): this;

  /**
   * Registers multiple plugins at once.
   * @param plugins - Array of plugins to register
   */
  withPlugins(plugins: readonly Plugin[]): this;

  /**
   * Registers multiple plugins with their options.
   * @param entries - Array of plugin entries with options
   */
  withPluginEntries(entries: readonly PluginEntry[]): this;

  /**
   * Sets a custom configuration object.
   * This will override any previously set configuration options.
   * @param config - Complete kernel configuration
   */
  withConfig(config: KernelConfig): this;

  /**
   * Builds and returns the configured kernel.
   * @returns Configured kernel instance
   */
  build(): ZernKernelInstance;

  /**
   * Builds the kernel and immediately initializes it.
   * @returns Promise resolving to initialized kernel
   * @throws {Error} If initialization fails
   */
  buildAndInitialize(): Promise<ZernKernelInstance>;
}

/**
 * Internal implementation of the kernel builder.
 */
class KernelBuilderImpl implements KernelBuilder {
  private config: KernelConfig = {};
  private readonly pluginEntries: PluginEntry[] = [];

  withAutoGlobal(enabled = true): this {
    this.config = { ...this.config, autoGlobal: enabled };
    return this;
  }

  withStrictVersioning(enabled = true): this {
    this.config = { ...this.config, strictVersioning: enabled };
    return this;
  }

  withCircularDependencies(enabled = true): this {
    this.config = { ...this.config, allowCircularDependencies: enabled };
    return this;
  }

  withPlugin(plugin: Plugin, options: PluginRegistrationOptions = {}): this {
    this.validatePlugin(plugin);

    // Check for duplicate plugin names
    if (this.pluginEntries.some(entry => entry.plugin.name === plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered in this builder`);
    }

    this.pluginEntries.push({ plugin, options });
    return this;
  }

  withPlugins(plugins: readonly Plugin[]): this {
    for (const plugin of plugins) {
      this.withPlugin(plugin);
    }
    return this;
  }

  withPluginEntries(entries: readonly PluginEntry[]): this {
    for (const entry of entries) {
      this.withPlugin(entry.plugin, entry.options);
    }
    return this;
  }

  withConfig(config: KernelConfig): this {
    this.config = { ...config };
    return this;
  }

  build(): ZernKernelInstance {
    const kernel = new ZernKernelInstance(this.config);

    // Register all plugins
    for (const entry of this.pluginEntries) {
      kernel.register(entry.plugin, entry.options);
    }

    return kernel;
  }

  async buildAndInitialize(): Promise<ZernKernelInstance> {
    const kernel = this.build();
    await kernel.initialize();
    return kernel;
  }

  /**
   * Validates a plugin before registration.
   * @param plugin - Plugin to validate
   * @throws {Error} If plugin is invalid
   */
  private validatePlugin(plugin: Plugin): void {
    if (!plugin) {
      throw new Error('Plugin cannot be null or undefined');
    }

    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error('Plugin must have a valid name');
    }

    if (!plugin.version || typeof plugin.version !== 'string') {
      throw new Error(`Plugin '${plugin.name}' must have a valid version`);
    }

    if (typeof plugin.setup !== 'function') {
      throw new Error(`Plugin '${plugin.name}' must have a setup function`);
    }

    if (plugin.destroy && typeof plugin.destroy !== 'function') {
      throw new Error(`Plugin '${plugin.name}' destroy must be a function if provided`);
    }

    if (!Array.isArray(plugin.dependencies)) {
      throw new Error(`Plugin '${plugin.name}' dependencies must be an array`);
    }
  }
}

/**
 * Creates a new kernel builder instance.
 * @returns Fresh kernel builder
 */
export function createKernel(): KernelBuilder {
  return new KernelBuilderImpl();
}

/**
 * Creates a kernel builder with default production configuration.
 * - Auto global: enabled
 * - Strict versioning: enabled
 * - Circular dependencies: disabled
 * @returns Configured kernel builder
 */
export function createProductionKernel(): KernelBuilder {
  return createKernel()
    .withAutoGlobal(true)
    .withStrictVersioning(true)
    .withCircularDependencies(false);
}

/**
 * Creates a kernel builder with default development configuration.
 * - Auto global: enabled
 * - Strict versioning: disabled (for easier development)
 * - Circular dependencies: enabled (for flexibility)
 * @returns Configured kernel builder
 */
export function createDevelopmentKernel(): KernelBuilder {
  return createKernel()
    .withAutoGlobal(true)
    .withStrictVersioning(false)
    .withCircularDependencies(true);
}

/**
 * Creates a kernel builder with testing configuration.
 * - Auto global: disabled (for test isolation)
 * - Strict versioning: disabled
 * - Circular dependencies: enabled
 * @returns Configured kernel builder
 */
export function createTestKernel(): KernelBuilder {
  return createKernel()
    .withAutoGlobal(false)
    .withStrictVersioning(false)
    .withCircularDependencies(true);
}

/**
 * Utility function to quickly create and initialize a kernel with plugins.
 * @param plugins - Plugins to register
 * @param config - Optional kernel configuration
 * @returns Promise resolving to initialized kernel
 */
export async function quickKernel(
  plugins: readonly Plugin[],
  config?: KernelConfig
): Promise<ZernKernelInstance> {
  const builder = createKernel();

  if (config) {
    builder.withConfig(config);
  }

  return builder.withPlugins(plugins).buildAndInitialize();
}
