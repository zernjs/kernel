/**
 * @description Fundamental types for the Zern Kernel, like Branded types for type safety
 */

import type { MethodWrapper } from '@/extension/wrapper-types';

// Branded types for unique IDs
export type PluginId = string & { readonly __brand: 'PluginId' };
export type KernelId = string & { readonly __brand: 'KernelId' };
export type Version = string & { readonly __brand: 'Version' };

// Kernel context available for plugins
export interface KernelContext {
  readonly id: KernelId;
  readonly config: KernelConfig;
  readonly get: <T>(pluginId: string) => T;
}

// Kernel configuration options
export interface KernelConfig {
  readonly autoGlobal?: boolean;
  readonly strictVersioning?: boolean;
  readonly circularDependencies?: boolean;
  readonly initializationTimeout?: number;
  readonly extensionsEnabled?: boolean;
  readonly logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// Plugin states
export enum PluginState {
  UNLOADED = 'UNLOADED',
  LOADING = 'LOADING',
  LOADED = 'LOADED',
  ERROR = 'ERROR',
}

// Plugin Metadata
export interface PluginMetadata {
  readonly id: PluginId;
  readonly name: string;
  readonly version: Version;
  readonly state: PluginState;
  readonly dependencies: readonly PluginDependency[];
  readonly extensions: readonly PluginExtension[];
  readonly wrappers: readonly MethodWrapper[];
}

// Plugin dependency
export interface PluginDependency {
  readonly pluginId: PluginId;
  readonly versionRange: string;
}

// Plugin extension
export interface PluginExtension {
  readonly targetPluginId: PluginId;
  readonly extensionFn: (api: unknown) => unknown;
}

// Created branded type helpers
export function createPluginId(value: string): PluginId {
  return value as PluginId;
}

export function createKernelId(value: string): KernelId {
  return value as KernelId;
}

export function createVersion(value: string): Version {
  if (!isValidVersion(value)) {
    throw new Error(`Invalid version: ${value}`);
  }
  return value as Version;
}

function isValidVersion(version: string): boolean {
  const semverRegex = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/;
  return semverRegex.test(version);
}
