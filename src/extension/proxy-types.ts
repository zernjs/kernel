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
 * Contains method info, args, control methods, and shared store
 * TStore: Type for ctx.store - shared state between lifecycle/setup/proxy
 */
export interface ProxyContext<TMethod extends (...args: any[]) => any, TStore = any> {
  // Method information
  readonly plugin: string;
  readonly method: string;
  readonly args: Parameters<TMethod>;

  // Execution control (internal flags)
  _skipExecution?: boolean;
  _overrideResult?: Awaited<ReturnType<TMethod>>;
  _modifiedArgs?: Parameters<TMethod>;

  // Shared store (type-safe, mutable, shared across lifecycle/setup/proxy)
  readonly store: TStore;

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
export type ProxyBefore<TMethod extends (...args: any[]) => any, TStore = any> = (
  ctx: ProxyContext<TMethod, TStore>
) => void | Promise<void>;

/**
 * After interceptor - runs after successful method execution
 * Can modify the result by returning a new value
 */
export type ProxyAfter<TMethod extends (...args: any[]) => any, TStore = any> = (
  result: Awaited<ReturnType<TMethod>>,
  ctx: ProxyContext<TMethod, TStore>
) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>>;

/**
 * Error interceptor - runs when method throws an error
 * Can return a fallback value or re-throw
 */
export type ProxyError<TMethod extends (...args: any[]) => any, TStore = any> = (
  error: Error,
  ctx: ProxyContext<TMethod, TStore>
) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>> | never;

/**
 * Around interceptor - full control over method execution
 * Use next() to call the original method
 */
export type ProxyAround<TMethod extends (...args: any[]) => any, TStore = any> = (
  ctx: ProxyContext<TMethod, TStore>,
  next: () => Promise<Awaited<ReturnType<TMethod>>>
) => Promise<Awaited<ReturnType<TMethod>>>;

// ============================================================================
// PROXY CONFIGURATION - Unified and flexible
// ============================================================================

/**
 * Pattern for method matching (glob-style or regex)
 */
export type MethodPattern = string | RegExp;

/**
 * Proxy configuration - object with interceptors
 * Store is accessible via ctx.store in all interceptors
 */
export interface ProxyConfig<TStore = any> {
  // Method filtering (glob patterns or regex)
  include?: MethodPattern[];
  exclude?: MethodPattern[];

  // Interceptors (with access to typed store via ctx.store)
  before?: ProxyBefore<any, TStore>;
  after?: ProxyAfter<any, TStore>;
  onError?: ProxyError<any, TStore>;
  around?: ProxyAround<any, TStore>;

  // Advanced options
  priority?: number;
  condition?: (ctx: ProxyContext<any, TStore>) => boolean;
  group?: string;
}

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
export function shouldProxyMethod(methodName: string, config: ProxyConfig): boolean {
  // Check include patterns (if specified, method must match)
  if (config.include && config.include.length > 0) {
    const included = config.include.some((pattern: MethodPattern) =>
      matchesPattern(methodName, pattern)
    );
    if (!included) return false;
  }

  // Check exclude patterns (if method matches, exclude it)
  if (config.exclude && config.exclude.length > 0) {
    const excluded = config.exclude.some((pattern: MethodPattern) =>
      matchesPattern(methodName, pattern)
    );
    if (excluded) return false;
  }

  // If no selectors specified, proxy all methods by default
  return true;
}

// ============================================================================
// CONTEXT HELPER METHODS
// ============================================================================

/**
 * Skip method execution
 */
export function skipExecution<TStore = any>(ctx: ProxyContext<any, TStore>): void {
  ctx._skipExecution = true;
}

/**
 * Replace method result
 */
export function replaceResult<T, TStore = any>(ctx: ProxyContext<any, TStore>, result: T): void {
  ctx._skipExecution = true;
  ctx._overrideResult = result;
}

/**
 * Modify method arguments
 */
export function modifyArgs<TMethod extends (...args: any[]) => any, TStore = any>(
  ctx: ProxyContext<TMethod, TStore>,
  ...newArgs: Parameters<TMethod>
): void {
  ctx._modifiedArgs = newArgs;
}

/**
 * Attach helper methods to context
 * Store must be provided separately and is immutable reference
 */
export function enhanceContext<
  TMethod extends (...args: any[]) => any,
  TStore = Record<string, never>,
>(ctx: ProxyContext<TMethod, TStore>): ProxyContext<TMethod, TStore> {
  // Add helper methods
  (ctx as any).skip = (): void => skipExecution(ctx);
  (ctx as any).replace = (result: Awaited<ReturnType<TMethod>>): void => replaceResult(ctx, result);
  (ctx as any).modifyArgs = (...args: Parameters<TMethod>): void => modifyArgs(ctx, ...args);

  return ctx;
}
