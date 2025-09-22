/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Wrapper types for method interception
 * @description Types and interfaces for creating method wrappers that can intercept and modify behavior
 */

import type { PluginId } from '@/core';

// Context provided to wrapper functions
export interface WrapperContext<
  TArgs extends readonly unknown[] = readonly unknown[],
  TReturn = unknown,
> {
  readonly pluginName: string;
  readonly methodName: string;
  readonly originalMethod: (...args: TArgs) => TReturn;
  readonly args: TArgs;
}

// Result of a wrapper execution
export interface WrapperResult<TReturn = unknown> {
  readonly shouldCallOriginal: boolean;
  readonly modifiedArgs?: readonly unknown[];
  readonly overrideResult?: TReturn;
}

// Wrapper function signature
export type WrapperFunction<
  TArgs extends readonly unknown[] = readonly unknown[],
  TReturn = unknown,
> = (
  context: WrapperContext<TArgs, TReturn>
) => WrapperResult<TReturn> | Promise<WrapperResult<TReturn>>;

// Post-execution wrapper for modifying results
export type PostWrapperFunction<TReturn = unknown> = (
  originalResult: TReturn,
  context: Omit<WrapperContext, 'args'>
) => TReturn | Promise<TReturn>;

// Wrapper configuration object used with .wrap() method
export interface WrapperConfig {
  readonly before?: WrapperFunction;
  readonly after?: PostWrapperFunction;
  readonly around?: WrapperFunction;
}

// Wrapper configuration for a specific method
export interface MethodWrapper {
  readonly targetPluginId: PluginId;
  readonly methodName: string;
  readonly before?: WrapperFunction;
  readonly after?: PostWrapperFunction;
  readonly around?: WrapperFunction;
}

// Plugin wrapper extension
export interface PluginWrapper {
  readonly targetPluginId: PluginId;
  readonly wrappers: readonly MethodWrapper[];
}

// Enhanced extension that supports both traditional extensions and wrappers
export interface EnhancedPluginExtension {
  readonly targetPluginId: PluginId;
  readonly extensionFn?: (api: unknown) => unknown;
  readonly wrappers?: readonly MethodWrapper[];
}

// Wrapper execution strategy
export enum WrapperStrategy {
  BEFORE = 'before',
  AFTER = 'after',
  AROUND = 'around',
}

// Wrapper execution result
export interface WrapperExecutionResult<TReturn = unknown> {
  readonly success: boolean;
  readonly result?: TReturn;
  readonly error?: Error;
  readonly skippedOriginal?: boolean;
}

// ============================================================================
// AUTO-TYPED WRAPPER TYPES - New enhanced types for automatic type inference
// ============================================================================

// Extract function parameters and return type from a method
export type ExtractMethodSignature<T> = T extends (...args: infer P) => infer R
  ? { args: P; return: R }
  : never;

// Base context interface with core properties - allows dynamic property assignment
export interface BaseWrapperContext<TMethod extends (...args: any[]) => any> {
  readonly pluginName: string;
  readonly methodName: string;
  readonly originalMethod: TMethod;
  readonly args: Parameters<TMethod>;
  // Allow dynamic properties to be added (like startTime)
  [key: string]: any;
}

// Context type that automatically infers property types without requiring explicit interfaces
// Uses intersection with a generic type to capture dynamically added properties
export type AutoTypedWrapperContext<
  TMethod extends (...args: any[]) => any,
  TExtensions = {},
> = BaseWrapperContext<TMethod> & TExtensions;

// Auto-typed wrapper result that infers return type from the target method
export interface AutoTypedWrapperResult<TMethod extends (...args: any[]) => any> {
  readonly shouldCallOriginal: boolean;
  readonly modifiedArgs?: Parameters<TMethod>;
  readonly overrideResult?: ReturnType<TMethod>;
}

// Auto-typed before wrapper that preserves method signature and captures context extensions
export type AutoTypedBeforeWrapper<TMethod extends (...args: any[]) => any, TExtensions = {}> = (
  context: AutoTypedWrapperContext<TMethod, TExtensions>
) => AutoTypedWrapperResult<TMethod> | Promise<AutoTypedWrapperResult<TMethod>>;

// Auto-typed after wrapper that receives context with extensions from before wrapper
export type AutoTypedAfterWrapper<TMethod extends (...args: any[]) => any, TExtensions = {}> = (
  result: Awaited<ReturnType<TMethod>>,
  context: Omit<AutoTypedWrapperContext<TMethod, TExtensions>, 'args'>
) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>>;

// Auto-typed around wrapper that preserves method signature and captures context extensions
export type AutoTypedAroundWrapper<TMethod extends (...args: any[]) => any, TExtensions = {}> = (
  context: AutoTypedWrapperContext<TMethod, TExtensions>
) => AutoTypedWrapperResult<TMethod> | Promise<AutoTypedWrapperResult<TMethod>>;

// Auto-typed wrapper configuration that automatically infers property types
export interface AutoTypedWrapperConfig<TMethod extends (...args: any[]) => any, TExtensions = {}> {
  readonly before?: AutoTypedBeforeWrapper<TMethod, TExtensions>;
  readonly after?: AutoTypedAfterWrapper<TMethod, TExtensions>;
  readonly around?: AutoTypedAroundWrapper<TMethod, TExtensions>;
}

// Smart wrapper configuration that infers extensions from before wrapper
export interface SmartWrapperConfig<TMethod extends (...args: any[]) => any> {
  readonly before?: (
    context: AutoTypedWrapperContext<TMethod, {}>
  ) => AutoTypedWrapperResult<TMethod> | Promise<AutoTypedWrapperResult<TMethod>>;
  readonly after?: (
    result: Awaited<ReturnType<TMethod>>,
    context: Omit<AutoTypedWrapperContext<TMethod, any>, 'args'>
  ) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>>;
  readonly around?: (
    context: AutoTypedWrapperContext<TMethod, {}>
  ) => AutoTypedWrapperResult<TMethod> | Promise<AutoTypedWrapperResult<TMethod>>;
}

// Helper type to extract method type from a plugin API
export type ExtractMethodType<
  TPlugin,
  TMethodName extends keyof TPlugin,
> = TPlugin[TMethodName] extends (...args: any[]) => any ? TPlugin[TMethodName] : never;

// Enhanced wrapper configuration that automatically infers types
export interface EnhancedWrapperConfig<TPlugin, TMethodName extends keyof TPlugin, TExtensions = {}>
  extends AutoTypedWrapperConfig<ExtractMethodType<TPlugin, TMethodName>, TExtensions> {}

// ============================================================================
// BACKWARD COMPATIBILITY - Keep existing types for compatibility
// ============================================================================

// Legacy wrapper configuration (for backward compatibility)
export interface LegacyWrapperConfig extends WrapperConfig {}

// Union type that supports both auto-typed and legacy configurations
export type FlexibleWrapperConfig<
  TPlugin = unknown,
  TMethodName extends keyof TPlugin = keyof TPlugin,
> = TPlugin extends unknown ? WrapperConfig : EnhancedWrapperConfig<TPlugin, TMethodName>;

// ============================================================================
// ALL METHODS WRAPPER TYPES - For wrapping all methods of a plugin
// ============================================================================

// Extract all method names from a plugin API
export type ExtractMethodNames<TPlugin> = {
  [K in keyof TPlugin]: TPlugin[K] extends (...args: any[]) => any ? K : never;
}[keyof TPlugin];

// Filter configuration for method selection
export interface MethodFilter<TPlugin> {
  readonly include?: readonly ExtractMethodNames<TPlugin>[];
  readonly exclude?: readonly ExtractMethodNames<TPlugin>[];
}

// Generic wrapper that applies to all methods
export interface AllMethodsWrapper<
  TArgs extends readonly unknown[] = readonly unknown[],
  TReturn = unknown,
> {
  readonly before?: (
    context: WrapperContext<TArgs, TReturn>
  ) => WrapperResult<TReturn> | Promise<WrapperResult<TReturn>>;
  readonly after?: (
    result: TReturn,
    context: Omit<WrapperContext<TArgs, TReturn>, 'args'>
  ) => TReturn | Promise<TReturn>;
  readonly around?: (
    context: WrapperContext<TArgs, TReturn>
  ) => WrapperResult<TReturn> | Promise<WrapperResult<TReturn>>;
}

// Configuration for wrapping all methods of a plugin
export interface AllMethodsWrapperConfig<TPlugin> {
  readonly wrapper: AllMethodsWrapper;
  readonly filter?: MethodFilter<TPlugin>;
}

// Auto-typed version for all methods wrapper with automatic property inference
export interface AutoTypedAllMethodsWrapperConfig<TPlugin, TExtensions = {}> {
  readonly wrapper: {
    readonly before?: <TMethod extends (...args: any[]) => any>(
      context: AutoTypedWrapperContext<TMethod, TExtensions>
    ) => AutoTypedWrapperResult<TMethod> | Promise<AutoTypedWrapperResult<TMethod>>;
    readonly after?: <TMethod extends (...args: any[]) => any>(
      result: Awaited<ReturnType<TMethod>>,
      context: Omit<AutoTypedWrapperContext<TMethod, TExtensions>, 'args'>
    ) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>>;
    readonly around?: <TMethod extends (...args: any[]) => any>(
      context: AutoTypedWrapperContext<TMethod, TExtensions>
    ) => AutoTypedWrapperResult<TMethod> | Promise<AutoTypedWrapperResult<TMethod>>;
  };
  readonly filter?: MethodFilter<TPlugin>;
}

// Smart all-methods wrapper config that automatically infers extensions
export interface SmartAllMethodsWrapperConfig<TPlugin> {
  readonly wrapper: {
    readonly before?: <TMethod extends (...args: any[]) => any>(
      context: AutoTypedWrapperContext<TMethod, {}>
    ) => AutoTypedWrapperResult<TMethod> | Promise<AutoTypedWrapperResult<TMethod>>;
    readonly after?: <TMethod extends (...args: any[]) => any>(
      result: Awaited<ReturnType<TMethod>>,
      context: Omit<AutoTypedWrapperContext<TMethod, any>, 'args'>
    ) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>>;
    readonly around?: <TMethod extends (...args: any[]) => any>(
      context: AutoTypedWrapperContext<TMethod, {}>
    ) => AutoTypedWrapperResult<TMethod> | Promise<AutoTypedWrapperResult<TMethod>>;
  };
  readonly filter?: MethodFilter<TPlugin>;
}
