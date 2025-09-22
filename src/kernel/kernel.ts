/**
 * @file Kernel builder with fluent API
 * @description Manages plugins and extensions with type-safe
 */

import type { KernelId, KernelConfig } from '@/core';
import { createKernelId, KernelInitializationError } from '@/core';
import type { BuiltPlugin } from '@/plugin';
import { PluginContainer, createPluginContainer } from './container';
import { LifecycleManager, createLifecycleManager } from './lifecycle';
import { createExtensionManager } from '@/extension';
import { setGlobalKernel } from '@/hooks';

// Type utilities to compute final plugin APIs including extensions
type PluginNameOf<P> =
  P extends BuiltPlugin<infer N, unknown, unknown> ? (N extends string ? N : never) : never;
type PluginExtMapOf<P> = P extends BuiltPlugin<string, unknown, infer M> ? M : never;
type ExtFor<P, Target extends string> =
  PluginExtMapOf<P> extends Record<string, unknown>
    ? Target extends keyof PluginExtMapOf<P>
      ? PluginExtMapOf<P>[Target]
      : unknown
    : unknown;
type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I
) => void
  ? I
  : never;
type ApiForName<U, Name extends string> =
  Extract<U, BuiltPlugin<Name, unknown, unknown>> extends infer Match
    ? Match extends BuiltPlugin<Name, infer A, unknown>
      ? A
      : never
    : never;
type ExtensionsForName<U, Name extends string> = UnionToIntersection<ExtFor<U, Name>>;
type PluginsMap<U> = { [K in PluginNameOf<U>]: ApiForName<U, K> & ExtensionsForName<U, K> };

// Initialized Kernel
export interface Kernel<TPlugins = Record<string, unknown>> {
  readonly id: KernelId;
  readonly config: KernelConfig;
  get<TName extends keyof TPlugins>(name: TName): TPlugins[TName];
  shutdown(): Promise<void>;
}

// Kernel Built (before initialization)
export interface BuiltKernel<TPlugins> {
  init(): Promise<Kernel<TPlugins>>;
}

// Builder Kernel
export interface KernelBuilder<U extends BuiltPlugin<string, unknown, unknown> = never> {
  use<P extends BuiltPlugin<string, unknown, unknown>>(plugin: P): KernelBuilder<U | P>;

  withConfig(config: Partial<KernelConfig>): KernelBuilder<U>;

  build(): BuiltKernel<PluginsMap<U>>;

  start(): Promise<Kernel<PluginsMap<U>>>;
}

// Builder Implementation
class KernelBuilderImpl<U extends BuiltPlugin<string, unknown, unknown> = never>
  implements KernelBuilder<U>
{
  private plugins: BuiltPlugin<string, unknown, unknown>[] = [];
  private config: KernelConfig = {
    autoGlobal: true,
    strictVersioning: true,
    circularDependencies: false,
    initializationTimeout: 30000,
    extensionsEnabled: true,
    logLevel: 'info',
  };

  use<P extends BuiltPlugin<string, unknown, unknown>>(plugin: P): KernelBuilder<U | P> {
    this.plugins.push(plugin as BuiltPlugin<string, unknown, unknown>);
    return this as unknown as KernelBuilder<U | P>;
  }

  withConfig(config: Partial<KernelConfig>): KernelBuilder<U> {
    this.config = { ...this.config, ...config };
    return this as unknown as KernelBuilder<U>;
  }

  build(): BuiltKernel<PluginsMap<U>> {
    return new BuiltKernelImpl<U>(this.plugins, this.config);
  }

  async start(): Promise<Kernel<PluginsMap<U>>> {
    return this.build().init();
  }
}

// Built Kernel Implementation
class BuiltKernelImpl<U extends BuiltPlugin<string, unknown, unknown>>
  implements BuiltKernel<PluginsMap<U>>
{
  constructor(
    private readonly plugins: readonly BuiltPlugin<string, unknown, unknown>[],
    private readonly config: KernelConfig
  ) {}
  async init(): Promise<Kernel<PluginsMap<U>>> {
    try {
      const kernelId = createKernelId(`kernel-${Date.now()}`);

      const container = createPluginContainer();
      const lifecycle = createLifecycleManager();
      const extensions = createExtensionManager();

      for (const plugin of this.plugins) {
        const result = container.register(plugin);
        if (!result.success) {
          throw result.error;
        }
      }

      const initResult = await lifecycle.initialize(container, extensions, this.config);

      if (!initResult.success) {
        throw initResult.error;
      }

      const kernel = new KernelImpl<PluginsMap<U>>(kernelId, this.config, container, lifecycle);
      if (this.config.autoGlobal) {
        setGlobalKernel(kernel as Kernel<PluginsMap<U>>);
      }
      return kernel;
    } catch (error) {
      throw new KernelInitializationError(error as Error);
    }
  }
}

// Implementation of initialized kernel
class KernelImpl<TPlugins> implements Kernel<TPlugins> {
  constructor(
    readonly id: KernelId,
    readonly config: KernelConfig,
    private readonly container: PluginContainer,
    private readonly lifecycle: LifecycleManager
  ) {}

  get<TName extends keyof TPlugins>(name: TName): TPlugins[TName] {
    const result = this.container.getInstance(name as string);
    if (!result.success) {
      throw result.error;
    }
    return result.data as TPlugins[TName];
  }

  async shutdown(): Promise<void> {
    await this.lifecycle.shutdown();
  }
}

export function createKernel(): KernelBuilder<never> {
  return new KernelBuilderImpl<never>();
}
