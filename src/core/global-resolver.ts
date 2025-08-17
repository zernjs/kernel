/**
 * @file Global kernel resolution system.
 * Provides automatic kernel discovery and type-safe plugin access.
 */

import type { Plugin } from './types.js';
import { ZernKernelInstance, getGlobalKernel } from './kernel.js';

/**
 * Type-safe plugin accessor that leverages global type augmentation.
 */
export type GlobalPluginAccessor<T extends string = string> = {
  readonly [K in T]: unknown;
};

/**
 * Global kernel resolver with automatic type inference.
 */
export class GlobalResolver {
  private static instance?: GlobalResolver;
  private kernel?: ZernKernelInstance<Record<string, unknown>>;

  /**
   * Gets the singleton global resolver instance.
   */
  static getInstance(): GlobalResolver {
    if (!GlobalResolver.instance) {
      GlobalResolver.instance = new GlobalResolver();
    }
    return GlobalResolver.instance;
  }

  /**
   * Resets the global resolver instance.
   * Useful for testing or when you need a fresh resolver.
   */
  static reset(): void {
    GlobalResolver.instance = undefined;
  }

  /**
   * Sets the global kernel instance.
   * @param kernel - Kernel to set as global
   */
  setKernel(kernel: ZernKernelInstance<Record<string, unknown>>): void {
    this.kernel = kernel;
  }

  /**
   * Gets the global kernel instance.
   * Creates a new one if none exists.
   */
  getKernel(): ZernKernelInstance<Record<string, unknown>> {
    if (!this.kernel) {
      this.kernel = getGlobalKernel();
    }
    return this.kernel;
  }

  /**
   * Gets a plugin from the global kernel with type safety.
   * @param name - Plugin name
   * @returns Plugin API or undefined if not found
   */
  getPlugin<T = unknown>(name: string): T | undefined {
    return this.getKernel().get<T>(name);
  }

  /**
   * Gets a plugin from the global kernel with type assertion.
   * @param name - Plugin name
   * @returns Plugin API
   * @throws {Error} If plugin is not found or not initialized
   */
  requirePlugin<T = unknown>(name: string): T {
    const plugin = this.getPlugin<T>(name);
    if (plugin === undefined) {
      throw new Error(`Required plugin '${name}' is not available`);
    }
    return plugin;
  }

  /**
   * Checks if a plugin is available in the global kernel.
   * @param name - Plugin name
   */
  hasPlugin(name: string): boolean {
    return this.getKernel().has(name);
  }

  /**
   * Gets all available plugin names from the global kernel.
   */
  getAvailablePlugins(): readonly string[] {
    return this.getKernel().getPluginNames();
  }

  /**
   * Registers a plugin with the global kernel.
   * @param plugin - Plugin to register
   */
  registerPlugin(plugin: Plugin): void {
    this.getKernel().register(plugin);
  }

  /**
   * Initializes the global kernel if not already initialized.
   */
  async ensureInitialized(): Promise<void> {
    const kernel = this.getKernel();
    if (kernel.currentState === 'uninitialized') {
      await kernel.initialize();
    }
  }
}

/**
 * Gets the global resolver instance.
 */
export function getGlobalResolver(): GlobalResolver {
  return GlobalResolver.getInstance();
}

/**
 * Convenience function to get a plugin from the global kernel.
 * @param name - Plugin name
 * @returns Plugin API or undefined if not found
 */
export function getGlobalPlugin<T = unknown>(name: string): T | undefined {
  return getGlobalResolver().getPlugin<T>(name);
}

/**
 * Convenience function to require a plugin from the global kernel.
 * @param name - Plugin name
 * @returns Plugin API
 * @throws {Error} If plugin is not found
 */
export function requireGlobalPlugin<T = unknown>(name: string): T {
  return getGlobalResolver().requirePlugin<T>(name);
}

/**
 * Convenience function to check if a plugin exists in the global kernel.
 * @param name - Plugin name
 */
export function hasGlobalPlugin(name: string): boolean {
  return getGlobalResolver().hasPlugin(name);
}

/**
 * Convenience function to register a plugin with the global kernel.
 * @param plugin - Plugin to register
 */
export function registerGlobalPlugin(plugin: Plugin): void {
  getGlobalResolver().registerPlugin(plugin);
}

/**
 * Type-safe global plugin accessor.
 * Uses module augmentation to provide compile-time type safety.
 */
export const globalPlugins = new Proxy({} as GlobalPluginAccessor, {
  get<T extends string>(target: GlobalPluginAccessor, prop: T): unknown {
    if (typeof prop === 'string') {
      return getGlobalPlugin(prop);
    }
    return undefined;
  },

  has(target: GlobalPluginAccessor, prop: string | symbol): boolean {
    if (typeof prop === 'string') {
      return hasGlobalPlugin(prop);
    }
    return false;
  },

  ownKeys(_target: GlobalPluginAccessor): ArrayLike<string | symbol> {
    return getGlobalResolver().getAvailablePlugins();
  },

  getOwnPropertyDescriptor(
    _target: GlobalPluginAccessor,
    prop: string | symbol
  ): PropertyDescriptor | undefined {
    if (typeof prop === 'string' && hasGlobalPlugin(prop)) {
      return {
        enumerable: true,
        configurable: true,
        get: () => getGlobalPlugin(prop),
      };
    }
    return undefined;
  },
});

/**
 * Decorator for automatic dependency injection from global kernel.
 * @param pluginName - Name of the plugin to inject
 */
export function inject(pluginName: string) {
  return function <T>(target: unknown, propertyKey: string | symbol): void {
    let value: T | undefined;

    const getter = (): T | undefined => {
      if (value === undefined) {
        value = getGlobalPlugin<T>(pluginName);
      }
      return value;
    };

    const setter = (newValue: T | undefined): void => {
      value = newValue;
    };

    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    });
  };
}

/**
 * Decorator for required dependency injection from global kernel.
 * Throws an error if the plugin is not available.
 * @param pluginName - Name of the plugin to inject
 */
export function injectRequired(pluginName: string) {
  return function <T>(target: unknown, propertyKey: string | symbol): void {
    let value: T | undefined;

    const getter = (): T => {
      if (value === undefined) {
        value = requireGlobalPlugin<T>(pluginName);
      }
      return value;
    };

    const setter = (newValue: T): void => {
      value = newValue;
    };

    Object.defineProperty(target, propertyKey, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    });
  };
}

/**
 * Utility function to wait for a plugin to become available.
 * @param name - Plugin name
 * @param timeout - Timeout in milliseconds (default: 5000)
 * @returns Promise resolving to plugin API
 */
export async function waitForPlugin<T = unknown>(name: string, timeout = 5000): Promise<T> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const plugin = getGlobalPlugin<T>(name);
    if (plugin !== undefined) {
      return plugin;
    }

    // Wait 10ms before checking again
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error(`Plugin '${name}' did not become available within ${timeout}ms`);
}
