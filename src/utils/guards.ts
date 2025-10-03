/**
 * @file Type guards for validate types in runtime
 * @description Provides type safety in dynamic operations
 */

import type {
  PluginMetadata,
  PluginState,
  PluginDependency,
  PluginExtension,
  Result,
} from '@/core';
import type { BuiltPlugin } from '@/plugin';
import { isObject } from './validation';

export function isPluginState(value: unknown): value is PluginState {
  return typeof value === 'string' && ['UNLOADED', 'LOADING', 'LOADED', 'ERROR'].includes(value);
}

export function isPluginDependency(value: unknown): value is PluginDependency {
  return (
    isObject(value) &&
    'pluginId' in value &&
    typeof (value as Record<string, unknown>).pluginId === 'string' &&
    'versionRange' in value &&
    typeof (value as Record<string, unknown>).versionRange === 'string'
  );
}

export function isPluginExtension(value: unknown): value is PluginExtension {
  return (
    isObject(value) &&
    'targetPluginId' in value &&
    typeof (value as Record<string, unknown>).targetPluginId === 'string' &&
    'extensionFn' in value &&
    typeof (value as Record<string, unknown>).extensionFn === 'function'
  );
}

export function isPluginMetadata(value: unknown): value is PluginMetadata {
  return (
    isObject(value) &&
    'id' in value &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    'name' in value &&
    typeof (value as Record<string, unknown>).name === 'string' &&
    'version' in value &&
    typeof (value as Record<string, unknown>).version === 'string' &&
    'state' in value &&
    isPluginState((value as Record<string, unknown>).state) &&
    'dependencies' in value &&
    Array.isArray((value as Record<string, unknown>).dependencies) &&
    'extensions' in value &&
    Array.isArray((value as Record<string, unknown>).extensions) &&
    'wrappers' in value &&
    Array.isArray((value as Record<string, unknown>).wrappers)
  );
}

export function isBuiltPlugin(value: unknown): value is BuiltPlugin<string, unknown> {
  return (
    isObject(value) &&
    'id' in value &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    'name' in value &&
    typeof (value as Record<string, unknown>).name === 'string' &&
    'version' in value &&
    typeof (value as Record<string, unknown>).version === 'string' &&
    'setupFn' in value &&
    typeof (value as Record<string, unknown>).setupFn === 'function' &&
    'dependencies' in value &&
    Array.isArray((value as Record<string, unknown>).dependencies) &&
    'extensions' in value &&
    Array.isArray((value as Record<string, unknown>).extensions)
  );
}

export function isResult<T, E>(value: unknown): value is Result<T, E> {
  return (
    isObject(value) &&
    'success' in value &&
    typeof (value as Record<string, unknown>).success === 'boolean' &&
    ((value as Record<string, unknown>).success === true ? 'data' in value : 'error' in value)
  );
}
