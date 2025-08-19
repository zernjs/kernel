/**
 * @file Extension system for modified plugin APIs
 * @description Allows plugins to extend other plugins' APIs
 */

import type { PluginId, PluginExtension } from '@/core';
import { createPluginId } from '@/core';

export interface ExtensionManager {
  registerExtension(extension: PluginExtension): void;
  applyExtensions<TApi extends object>(pluginName: string, baseApi: TApi): TApi;
  getExtensions(pluginName: string): readonly PluginExtension[];
  clear(): void;
}

class ExtensionManagerImpl implements ExtensionManager {
  private extensions = new Map<PluginId, PluginExtension[]>();

  registerExtension(extension: PluginExtension): void {
    const targetName = extension.targetPluginId;
    const existing = this.extensions.get(targetName) ?? [];
    this.extensions.set(targetName, [...existing, extension]);
  }

  applyExtensions<TApi extends object>(pluginName: string, baseApi: TApi): TApi {
    const extensions = this.extensions.get(createPluginId(pluginName)) ?? [];

    if (extensions.length === 0) {
      return baseApi;
    }

    let extendedApi: TApi = { ...baseApi };

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

    return extendedApi;
  }

  getExtensions(pluginName: string): readonly PluginExtension[] {
    return this.extensions.get(createPluginId(pluginName)) ?? [];
  }

  clear(): void {
    this.extensions.clear();
  }
}

export function createExtensionManager(): ExtensionManager {
  return new ExtensionManagerImpl();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
