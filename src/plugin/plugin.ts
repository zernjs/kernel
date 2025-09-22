/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Plugin system with builder pattern for the Zern Kernel
 * @description Provides an fluent type-safe API for plugin creation and management
 */

import type { KernelContext, PluginId, Version, PluginDependency, PluginExtension } from '@/core';
import { createPluginId, createVersion } from '@/core';
import type {
  MethodWrapper,
  WrapperFunction,
  PostWrapperFunction,
  AutoTypedWrapperConfig,
  ExtractMethodType,
  AllMethodsWrapperConfig,
  AutoTypedAllMethodsWrapperConfig,
  SmartAllMethodsWrapperConfig,
} from '@/extension/wrapper-types';

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
  readonly wrappers: readonly MethodWrapper[];
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

  // Auto-typed wrapper method - NEW! Automatically infers types from target method
  wrap<TTargetName extends string, TTargetApi, TMethodName extends keyof TTargetApi>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown>,
    methodName: TMethodName,
    wrapper: AutoTypedWrapperConfig<ExtractMethodType<TTargetApi, TMethodName>>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap>;

  // Legacy wrapper method for backward compatibility
  wrap<TTargetName extends string, TTargetApi>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown>,
    methodName: keyof TTargetApi,
    wrapper: {
      before?: WrapperFunction;
      after?: PostWrapperFunction;
      around?: WrapperFunction;
    }
  ): PluginBuilder<TName, TApi, TDeps, TExtMap>;

  // Smart wrapper for all methods - automatically infers extensions from before wrapper
  wrapAll<TTargetName extends string, TTargetApi>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown>,
    config: SmartAllMethodsWrapperConfig<TTargetApi>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap>;

  // Auto-typed wrapper for all methods - NEW! Automatically wraps all methods with type safety
  wrapAll<TTargetName extends string, TTargetApi>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown>,
    config: AutoTypedAllMethodsWrapperConfig<TTargetApi>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap>;

  // Legacy wrapper for all methods for backward compatibility
  wrapAll<TTargetName extends string, TTargetApi>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown>,
    config: AllMethodsWrapperConfig<TTargetApi>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap>;
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
  private wrappers: MethodWrapper[] = [];

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
    next.wrappers = [...this.wrappers];

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

  // Auto-typed wrapper method - NEW! Automatically infers types from target method
  wrap<TTargetName extends string, TTargetApi, TMethodName extends keyof TTargetApi>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown>,
    methodName: TMethodName,
    wrapper: AutoTypedWrapperConfig<ExtractMethodType<TTargetApi, TMethodName>>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap>;

  // Legacy wrapper method for backward compatibility
  wrap<TTargetName extends string, TTargetApi>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown>,
    methodName: keyof TTargetApi,
    wrapper: {
      before?: WrapperFunction;
      after?: PostWrapperFunction;
      around?: WrapperFunction;
    }
  ): PluginBuilder<TName, TApi, TDeps, TExtMap>;

  // Implementation that handles both overloads
  wrap<TTargetName extends string, TTargetApi>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown>,
    methodName: keyof TTargetApi,
    wrapper:
      | AutoTypedWrapperConfig<any>
      | {
          before?: WrapperFunction;
          after?: PostWrapperFunction;
          around?: WrapperFunction;
        }
  ): PluginBuilder<TName, TApi, TDeps, TExtMap> {
    // Check if it's the new auto-typed wrapper or legacy wrapper
    const isAutoTyped =
      'before' in wrapper && typeof wrapper.before === 'function' && wrapper.before.length > 0;

    if (isAutoTyped) {
      // Handle auto-typed wrapper
      const autoWrapper = wrapper as AutoTypedWrapperConfig<any>;
      this.wrappers.push({
        targetPluginId: target.id,
        methodName: methodName as string,
        before: autoWrapper.before as WrapperFunction,
        after: autoWrapper.after as PostWrapperFunction,
        around: autoWrapper.around as WrapperFunction,
      });
    } else {
      // Handle legacy wrapper
      const legacyWrapper = wrapper as {
        before?: WrapperFunction;
        after?: PostWrapperFunction;
        around?: WrapperFunction;
      };
      this.wrappers.push({
        targetPluginId: target.id,
        methodName: methodName as string,
        before: legacyWrapper.before,
        after: legacyWrapper.after,
        around: legacyWrapper.around,
      });
    }
    return this;
  }

  // Implementation for wrapAll method - handles smart, auto-typed and legacy configurations
  wrapAll<TTargetName extends string, TTargetApi>(
    target: BuiltPlugin<TTargetName, TTargetApi, unknown>,
    config:
      | SmartAllMethodsWrapperConfig<TTargetApi>
      | AutoTypedAllMethodsWrapperConfig<TTargetApi>
      | AllMethodsWrapperConfig<TTargetApi>
  ): PluginBuilder<TName, TApi, TDeps, TExtMap> {
    // Get all method names from the target plugin's API
    // This will be resolved at runtime when the plugin is built
    const targetPluginId = target.id;

    // Store the configuration for later processing during plugin initialization
    // We'll need to resolve the actual method names when the target plugin is available
    const allMethodsWrapper = {
      targetPluginId,
      config,
      isAllMethods: true,
    };

    // Add a special marker to identify this as an all-methods wrapper
    (this.wrappers as any[]).push(allMethodsWrapper);

    return this;
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
      this.extensions,
      this.wrappers
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
    readonly extensions: readonly PluginExtension[],
    readonly wrappers: readonly MethodWrapper[]
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
