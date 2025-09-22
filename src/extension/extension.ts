/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Extension system for modified plugin APIs
 * @description Allows plugins to extend other plugins' APIs and wrap existing methods
 */

import type { PluginId, PluginExtension } from '@/core';
import { createPluginId } from '@/core';
import type {
  EnhancedPluginExtension,
  MethodWrapper,
  WrapperContext,
  WrapperResult,
} from './wrapper-types';

export interface ExtensionManager {
  registerExtension(extension: PluginExtension): void;
  registerEnhancedExtension(extension: EnhancedPluginExtension): void;
  applyExtensions<TApi extends object>(pluginName: string, baseApi: TApi): TApi;
  getExtensions(pluginName: string): readonly PluginExtension[];
  getWrappers(pluginName: string): readonly MethodWrapper[];
  clear(): void;
}

class ExtensionManagerImpl implements ExtensionManager {
  private extensions = new Map<PluginId, PluginExtension[]>();
  private wrappers = new Map<PluginId, MethodWrapper[]>();

  registerExtension(extension: PluginExtension): void {
    const targetName = extension.targetPluginId;
    const existing = this.extensions.get(targetName) ?? [];
    this.extensions.set(targetName, [...existing, extension]);
  }

  registerEnhancedExtension(extension: EnhancedPluginExtension): void {
    // Register traditional extension if present
    if (extension.extensionFn) {
      this.registerExtension({
        targetPluginId: extension.targetPluginId,
        extensionFn: extension.extensionFn,
      });
    }

    // Register wrappers if present
    if (extension.wrappers && extension.wrappers.length > 0) {
      const targetName = extension.targetPluginId;
      const existing = this.wrappers.get(targetName) ?? [];
      this.wrappers.set(targetName, [...existing, ...extension.wrappers]);
    }
  }

  applyExtensions<TApi extends object>(pluginName: string, baseApi: TApi): TApi {
    const extensions = this.extensions.get(createPluginId(pluginName)) ?? [];
    const wrappers = this.wrappers.get(createPluginId(pluginName)) ?? [];

    if (extensions.length === 0 && wrappers.length === 0) {
      return baseApi;
    }

    let extendedApi: TApi = { ...baseApi };

    // Apply traditional extensions first
    for (const extension of extensions) {
      try {
        const extensionResult = extension.extensionFn(extendedApi);
        if (isObject(extensionResult)) {
          extendedApi = {
            ...(extendedApi as unknown as Record<string, unknown>),
            ...extensionResult,
          } as unknown as TApi;
        } else {
          console.warn(`Extension for ${pluginName} returned a non-object; skipping.`);
        }
      } catch (error) {
        console.warn(`Failed to apply extension to ${pluginName}:`, error);
      }
    }

    // Apply wrappers
    extendedApi = this.applyWrappers(pluginName, extendedApi, wrappers);

    return extendedApi;
  }

  private applyWrappers<TApi extends object>(
    pluginName: string,
    api: TApi,
    wrappers: readonly MethodWrapper[]
  ): TApi {
    const wrappedApi = { ...api } as Record<string, unknown>;

    // Process all-methods wrappers and convert them to individual method wrappers
    const expandedWrappers = this.expandAllMethodsWrappers(api, wrappers);

    // Group wrappers by method name
    const wrappersByMethod = new Map<string, MethodWrapper[]>();
    for (const wrapper of expandedWrappers) {
      const existing = wrappersByMethod.get(wrapper.methodName) ?? [];
      wrappersByMethod.set(wrapper.methodName, [...existing, wrapper]);
    }

    // Apply wrappers to each method
    for (const [methodName, methodWrappers] of wrappersByMethod) {
      const originalMethod = wrappedApi[methodName];

      if (typeof originalMethod === 'function') {
        wrappedApi[methodName] = this.createWrappedMethod(
          pluginName,
          methodName,
          originalMethod as (...args: unknown[]) => unknown,
          methodWrappers
        );
      }
    }

    return wrappedApi as TApi;
  }

  private expandAllMethodsWrappers<TApi extends object>(
    api: TApi,
    wrappers: readonly MethodWrapper[]
  ): MethodWrapper[] {
    const expandedWrappers: MethodWrapper[] = [];

    for (const wrapper of wrappers) {
      // Check if this is an all-methods wrapper
      if ((wrapper as any).isAllMethods) {
        const allMethodsWrapper = wrapper as any;
        const config = allMethodsWrapper.config;

        // Get all method names from the API
        const allMethodNames = Object.keys(api).filter(
          key => typeof (api as any)[key] === 'function'
        );

        // Apply filters if specified
        let targetMethods = allMethodNames;
        if (config.filter) {
          if (config.filter.include) {
            targetMethods = targetMethods.filter(method => config.filter.include!.includes(method));
          }
          if (config.filter.exclude) {
            targetMethods = targetMethods.filter(
              method => !config.filter.exclude!.includes(method)
            );
          }
        }

        // Create individual method wrappers for each target method
        for (const methodName of targetMethods) {
          expandedWrappers.push({
            targetPluginId: allMethodsWrapper.targetPluginId,
            methodName,
            before: config.wrapper.before,
            after: config.wrapper.after,
            around: config.wrapper.around,
          });
        }
      } else {
        // Regular method wrapper, add as-is
        expandedWrappers.push(wrapper);
      }
    }

    return expandedWrappers;
  }

  private createWrappedMethod(
    pluginName: string,
    methodName: string,
    originalMethod: (...args: unknown[]) => unknown,
    wrappers: readonly MethodWrapper[]
  ): (...args: unknown[]) => unknown {
    // Check if any wrapper is async or if the original method returns a Promise
    const hasAsyncWrappers = wrappers.some(
      wrapper =>
        this.isAsyncWrapper(wrapper.before) ||
        this.isAsyncWrapper(wrapper.after) ||
        this.isAsyncWrapper(wrapper.around)
    );

    const isOriginalAsync = this.isAsyncMethod(originalMethod);

    // If no async wrappers and original method is sync, keep it synchronous
    if (!hasAsyncWrappers && !isOriginalAsync) {
      return (...args: unknown[]) => {
        let context: WrapperContext = {
          pluginName,
          methodName,
          originalMethod,
          args: [...args], // Create mutable copy
        };

        try {
          // Execute before wrappers (synchronously)
          for (const wrapper of wrappers) {
            if (wrapper.before) {
              const result = wrapper.before(context) as WrapperResult;
              if (!result.shouldCallOriginal) {
                return result.overrideResult;
              }
              // Update args if modified
              if (result.modifiedArgs) {
                context = {
                  ...context,
                  args: [...result.modifiedArgs], // Create mutable copy
                };
              }
            }
          }

          // Execute around wrappers (only the first one found)
          const aroundWrapper = wrappers.find(w => w.around);
          let result: unknown;

          if (aroundWrapper) {
            const wrapperResult = aroundWrapper.around!(context) as WrapperResult;
            if (!wrapperResult.shouldCallOriginal) {
              result = wrapperResult.overrideResult;
            } else {
              result = originalMethod(...context.args);
            }
          } else {
            result = originalMethod(...context.args);
          }

          // Execute after wrappers (synchronously)
          for (const wrapper of wrappers) {
            if (wrapper.after) {
              // Preserve all context properties including dynamic ones like startTime, but exclude args
              const { args, ...afterContext } = context;
              result = wrapper.after(result, afterContext) as unknown;
            }
          }

          return result;
        } catch (error) {
          console.warn(`Error in wrapped method ${pluginName}.${methodName}:`, error);
          throw error;
        }
      };
    }

    // Async version for when we have async wrappers or async original method
    return async (...args: unknown[]) => {
      let context: WrapperContext = {
        pluginName,
        methodName,
        originalMethod,
        args: [...args], // Create mutable copy
      };

      try {
        // Execute before wrappers
        for (const wrapper of wrappers) {
          if (wrapper.before) {
            const result = await wrapper.before(context);
            if (!result.shouldCallOriginal) {
              return result.overrideResult;
            }
            // Update args if modified
            if (result.modifiedArgs) {
              context = {
                ...context,
                args: [...result.modifiedArgs], // Create mutable copy
              };
            }
          }
        }

        // Execute around wrappers (only the first one found)
        const aroundWrapper = wrappers.find(w => w.around);
        let result: unknown;

        if (aroundWrapper) {
          const wrapperResult = await aroundWrapper.around!(context);
          if (!wrapperResult.shouldCallOriginal) {
            result = wrapperResult.overrideResult;
          } else {
            result = await originalMethod(...context.args);
          }
        } else {
          result = await originalMethod(...context.args);
        }

        // Execute after wrappers
        for (const wrapper of wrappers) {
          if (wrapper.after) {
            // Preserve all context properties including dynamic ones like startTime, but exclude args
            const { args, ...afterContext } = context;
            result = await wrapper.after(result, afterContext);
          }
        }

        return result;
      } catch (error) {
        console.warn(`Error in wrapped method ${pluginName}.${methodName}:`, error);
        throw error;
      }
    };
  }

  private isAsyncWrapper(wrapper: unknown): boolean {
    if (!wrapper || typeof wrapper !== 'function') return false;

    // Check if the function is async by looking at its constructor
    return wrapper.constructor.name === 'AsyncFunction';
  }

  private isAsyncMethod(method: (...args: unknown[]) => unknown): boolean {
    // Check if the function is async by looking at its constructor
    return method.constructor.name === 'AsyncFunction';
  }

  getExtensions(pluginName: string): readonly PluginExtension[] {
    return this.extensions.get(createPluginId(pluginName)) ?? [];
  }

  getWrappers(pluginName: string): readonly MethodWrapper[] {
    return this.wrappers.get(createPluginId(pluginName)) ?? [];
  }

  clear(): void {
    this.extensions.clear();
    this.wrappers.clear();
  }
}

export function createExtensionManager(): ExtensionManager {
  return new ExtensionManagerImpl();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
