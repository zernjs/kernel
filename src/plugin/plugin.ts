/**
 * @file Plugin system with builder pattern for the Zern Kernel
 * @description Provides an fluent type-safe API for plugin creation and management
 */

import type { KernelContext, PluginId, Version, PluginDependency, PluginExtension } from '@/core';
import { createPluginId, createVersion } from '@/core';

// Context available in plugin setup function
export interface PluginSetupContext<TDeps = Record<string, never>> {
  readonly plugins: TDeps;
  readonly kernel: KernelContext;
}

// Plugin builted, result of the setup function
export interface BuiltPlugin<TName extends string, TApi, TExtMap = Record<string, never>> {
  readonly id: PluginId;
  readonly name: TName;
  readonly version: Version;
  readonly dependencies: readonly PluginDependency[];
  readonly extensions: readonly PluginExtension[];
  readonly setupFn: (ctx: PluginSetupContext<Record<string, unknown>>) => TApi;
  // Phantom type to carry compile-time extension info
  readonly __extensions__?: TExtMap | undefined;
}

// Plugin builder
export interface PluginBuilder<
  TName extends string,
  TApi = unknown,
  TDeps = Record<string, never>,
  TExtMap = Record<string, never>,
> {
  setup<TNewApi>(
    fn: (ctx: PluginSetupContext<TDeps>) => TNewApi
  ): BuiltPlugin<TName, TNewApi, TExtMap>;

  depends<TDepName extends string, TDepApi>(
    plugin: BuiltPlugin<TDepName, TDepApi>,
    versionRange?: string
  ): PluginBuilder<TName, TApi, TDeps & Record<TDepName, TDepApi>, TExtMap>;

  extend<TTargetName extends string, TTargetApi, TExt extends object>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown>,
    fn: (api: TTargetApi) => TExt
  ): PluginBuilder<TName, TApi, TDeps, TExtMap & Record<TTargetName, TExt>>;
}

// Builder plugin implementation
class PluginBuilderImpl<
  TName extends string,
  TApi = unknown,
  TDeps = Record<string, never>,
  TExtMap = Record<string, never>,
> implements PluginBuilder<TName, TApi, TDeps, TExtMap>
{
  private dependencies: PluginDependency[] = [];
  private extensions: PluginExtension[] = [];

  constructor(
    private readonly name: TName,
    private readonly version: Version
  ) {}

  depends<TDepName extends string, TDepApi>(
    plugin: BuiltPlugin<TDepName, TDepApi>,
    versionRange = '*'
  ): PluginBuilder<TName, TApi, TDeps & Record<TDepName, TDepApi>, TExtMap> {
    const next = new PluginBuilderImpl<TName, TApi, TDeps & Record<TDepName, TDepApi>, TExtMap>(
      this.name,
      this.version
    );

    next.dependencies = [
      ...this.dependencies,
      {
        pluginId: plugin.id,
        versionRange,
      },
    ];
    next.extensions = [...this.extensions];

    return next;
  }

  extend<TTargetName extends string, TTargetApi, TExt extends object>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown>,
    fn: (api: TTargetApi) => TExt
  ): PluginBuilder<TName, TApi, TDeps, TExtMap & Record<TTargetName, TExt>> {
    this.extensions.push({
      targetPluginId: target.id,
      extensionFn: fn as (api: unknown) => unknown,
    });
    return this as unknown as PluginBuilder<
      TName,
      TApi,
      TDeps,
      TExtMap & Record<TTargetName, TExt>
    >;
  }

  setup<TNewApi>(
    fn: (ctx: PluginSetupContext<TDeps>) => TNewApi
  ): BuiltPlugin<TName, TNewApi, TExtMap> {
    const setupFn = fn as unknown as (ctx: PluginSetupContext<Record<string, unknown>>) => TNewApi;
    return new BuiltPluginImpl(
      this.name,
      this.version,
      setupFn,
      this.dependencies,
      this.extensions
    );
  }
}

// Built plugin implementation
class BuiltPluginImpl<TName extends string, TApi, TExtMap = Record<string, never>>
  implements BuiltPlugin<TName, TApi, TExtMap>
{
  readonly id: PluginId;

  constructor(
    readonly name: TName,
    readonly version: Version,
    readonly setupFn: (ctx: PluginSetupContext<Record<string, unknown>>) => TApi,
    readonly dependencies: readonly PluginDependency[],
    readonly extensions: readonly PluginExtension[]
  ) {
    this.id = createPluginId(name);
  }
}

// Factory function for plugin builder
export function plugin<TName extends string>(
  name: TName,
  version: string
): PluginBuilder<TName, unknown, Record<string, never>, Record<string, never>> {
  return new PluginBuilderImpl(name, createVersion(version));
}
