/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file Proxy types for method interception
 * @description Modern, simplified types for proxying plugin methods
 */

import type { PluginId } from '@/core';

// ============================================================================
// PROXY CONTEXT - Simplified and powerful
// ============================================================================

/**
 * Context provided to proxy interceptors
 * Contains method info, args, and control methods
 * TData: Type for ctx.data - allows type-safe custom properties between interceptors
 */
export interface ProxyContext<TMethod extends (...args: any[]) => any, TData = any> {
  // Method information
  readonly plugin: string;
  readonly method: string;
  readonly args: Parameters<TMethod>;

  // Execution control (internal flags)
  _skipExecution?: boolean;
  _overrideResult?: Awaited<ReturnType<TMethod>>;
  _modifiedArgs?: Parameters<TMethod>;

  // Custom data object (shared between interceptors) - fully mutable and type-safe!
  data: TData;

  // Helper methods for controlling execution
  skip: () => void;
  replace: (result: Awaited<ReturnType<TMethod>>) => void;
  modifyArgs: (...args: Parameters<TMethod>) => void;
}

// ============================================================================
// INTERCEPTOR TYPES - Clean and intuitive
// ============================================================================

/**
 * Before interceptor - runs before method execution
 * Return void to continue, or use ctx.skip()/ctx.replace() to control flow
 */
export type ProxyBefore<TMethod extends (...args: any[]) => any, TData = any> = (
  ctx: ProxyContext<TMethod, TData>
) => void | Promise<void>;

/**
 * After interceptor - runs after successful method execution
 * Can modify the result by returning a new value
 */
export type ProxyAfter<TMethod extends (...args: any[]) => any, TData = any> = (
  result: Awaited<ReturnType<TMethod>>,
  ctx: ProxyContext<TMethod, TData>
) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>>;

/**
 * Error interceptor - runs when method throws an error
 * Can return a fallback value or re-throw
 */
export type ProxyError<TMethod extends (...args: any[]) => any, TData = any> = (
  error: Error,
  ctx: ProxyContext<TMethod, TData>
) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>> | never;

/**
 * Around interceptor - full control over method execution
 * Use next() to call the original method
 */
export type ProxyAround<TMethod extends (...args: any[]) => any, TData = any> = (
  ctx: ProxyContext<TMethod, TData>,
  next: () => Promise<Awaited<ReturnType<TMethod>>>
) => Promise<Awaited<ReturnType<TMethod>>>;

// ============================================================================
// PROXY CONFIGURATION - Unified and flexible
// ============================================================================

/**
 * Method selection options
 */
export type MethodSelector<TPlugin> =
  | '*' // All methods
  | keyof TPlugin // Single method
  | Array<keyof TPlugin>; // Multiple methods

/**
 * Pattern for method matching (glob-style)
 */
export type MethodPattern = string | RegExp;

/**
 * Proxy configuration - can be an object or a factory function
 * Using factory function allows TypeScript to infer ctx.data types automatically!
 */
export interface ProxyConfigObject<TPlugin = any, TData = any> {
  // Method selection (mutually exclusive with include/exclude)
  methods?: MethodSelector<TPlugin>;

  // Advanced filtering
  include?: MethodPattern[];
  exclude?: MethodPattern[];

  // Interceptors (now with typed context data)
  before?: ProxyBefore<any, TData>;
  after?: ProxyAfter<any, TData>;
  onError?: ProxyError<any, TData>;
  around?: ProxyAround<any, TData>;

  // Advanced options
  priority?: number;
  condition?: (ctx: ProxyContext<any>) => boolean;
  group?: string;
}

/**
 * Factory function for proxy config - allows type inference for ctx.data!
 * The context passed has a mutable data object shared across all interceptors
 */
export type ProxyConfigFactory<TPlugin = any> = (
  ctx: ProxyContext<any, Record<string, any>>
) => ProxyConfigObject<TPlugin, Record<string, any>>;

/**
 * Proxy configuration - object or factory function
 */
export type ProxyConfig<TPlugin = any, TData = any> =
  | ProxyConfigObject<TPlugin, TData>
  | ProxyConfigFactory<TPlugin>;

// ============================================================================
// INTERNAL TYPES - For kernel/extension manager
// ============================================================================

/**
 * Proxy target type
 * - PluginId: Specific plugin
 * - 'self': Plugin's own methods
 * - '*': All dependencies
 * - '**': All plugins in kernel
 */
export type ProxyTarget = PluginId | 'self' | '*' | '**';

/**
 * Internal proxy metadata stored by the kernel
 */
export interface ProxyMetadata {
  readonly targetPluginId: ProxyTarget;
  // Can be a config object or a factory function
  readonly config: ProxyConfig<any>;
}

/**
 * Compiled proxy for a specific method
 */
export interface CompiledMethodProxy {
  readonly targetPluginId: PluginId;
  readonly methodName: string;
  readonly before?: ProxyBefore<any>;
  readonly after?: ProxyAfter<any>;
  readonly onError?: ProxyError<any>;
  readonly around?: ProxyAround<any>;
  readonly priority: number;
  readonly condition?: (ctx: ProxyContext<any>) => boolean;
  readonly group?: string;
  // Factory function if config was a function (for type inference)
  readonly configFactory?: ProxyConfigFactory<any>;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Extract all method names from a plugin API
 */
export type ExtractMethodNames<TPlugin> = {
  [K in keyof TPlugin]: TPlugin[K] extends (...args: any[]) => any ? K : never;
}[keyof TPlugin];

/**
 * Check if a method name matches a pattern
 */
export function matchesPattern(methodName: string, pattern: MethodPattern): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(methodName);
  }

  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
    .replace(/\*/g, '.*'); // Convert * to .*

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(methodName);
}

/**
 * Check if a method should be proxied based on config
 */
export function shouldProxyMethod<TPlugin>(
  methodName: string,
  config: ProxyConfigObject<TPlugin>
): boolean {
  // Check explicit methods selector
  if (config.methods !== undefined) {
    if (config.methods === '*') return true;
    if (typeof config.methods === 'string') return config.methods === methodName;
    if (Array.isArray(config.methods)) return config.methods.includes(methodName as any);
  }

  // Check include patterns
  if (config.include && config.include.length > 0) {
    const included = config.include.some((pattern: MethodPattern) =>
      matchesPattern(methodName, pattern)
    );
    if (!included) return false;
  }

  // Check exclude patterns
  if (config.exclude && config.exclude.length > 0) {
    const excluded = config.exclude.some((pattern: MethodPattern) =>
      matchesPattern(methodName, pattern)
    );
    if (excluded) return false;
  }

  // If no selector specified, proxy all methods
  return true;
}

// ============================================================================
// CONTEXT HELPER METHODS
// ============================================================================

/**
 * Skip method execution
 */
export function skipExecution(ctx: ProxyContext<any>): void {
  ctx._skipExecution = true;
}

/**
 * Replace method result
 */
export function replaceResult<T>(ctx: ProxyContext<any>, result: T): void {
  ctx._skipExecution = true;
  ctx._overrideResult = result;
}

/**
 * Modify method arguments
 */
export function modifyArgs<TMethod extends (...args: any[]) => any>(
  ctx: ProxyContext<TMethod>,
  ...newArgs: Parameters<TMethod>
): void {
  ctx._modifiedArgs = newArgs;
}

/**
 * Attach helper methods to context
 */
export function enhanceContext<TMethod extends (...args: any[]) => any, TData = any>(
  ctx: ProxyContext<TMethod, TData>
): ProxyContext<TMethod, TData> {
  // Add data object if not present
  if (!ctx.data) {
    (ctx as any).data = {};
  }

  // Add helper methods
  (ctx as any).skip = (): void => skipExecution(ctx);
  (ctx as any).replace = (result: Awaited<ReturnType<TMethod>>): void => replaceResult(ctx, result);
  (ctx as any).modifyArgs = (...args: Parameters<TMethod>): void => modifyArgs(ctx, ...args);

  return ctx;
}
