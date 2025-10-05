/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PluginId } from '@/core';

/**
 * Context object provided to proxy interceptors.
 * Contains method information, arguments, store, and control helpers.
 *
 * @example
 * ```typescript
 * .proxy({
 *   before: ctx => {
 *     console.log(ctx.plugin);  // Plugin name
 *     console.log(ctx.method);  // Method name
 *     console.log(ctx.args);    // Method arguments
 *     console.log(ctx.store);   // Reactive store
 *   }
 * })
 * ```
 */
export interface ProxyContext<TMethod extends (...args: any[]) => any, TStore = any> {
  /**
   * Name of the plugin being proxied.
   */
  readonly plugin: string;

  /**
   * Name of the method being called.
   */
  readonly method: string;

  /**
   * Arguments passed to the method.
   * Array of values that can be modified with modifyArgs().
   */
  readonly args: Parameters<TMethod>;

  _skipExecution?: boolean;
  _overrideResult?: Awaited<ReturnType<TMethod>>;
  _modifiedArgs?: Parameters<TMethod>;

  /**
   * Reactive store shared across lifecycle, setup, and proxy interceptors.
   * Read and write properties to share state.
   *
   * @example
   * ```typescript
   * before: ctx => {
   *   ctx.store.callCount = (ctx.store.callCount || 0) + 1;
   * }
   * ```
   */
  readonly store: TStore;

  /**
   * Skips execution of the original method.
   * Use with replace() to provide a custom result.
   *
   * @example
   * ```typescript
   * before: ctx => {
   *   if (cached) {
   *     ctx.skip();
   *     ctx.replace(cachedValue);
   *   }
   * }
   * ```
   */
  skip: () => void;

  /**
   * Replaces the method result with a custom value.
   * Automatically calls skip() internally.
   *
   * @example
   * ```typescript
   * before: ctx => {
   *   ctx.replace({ mock: 'data' });  // Returns this instead
   * }
   * ```
   */
  replace: (result: Awaited<ReturnType<TMethod>>) => void;

  /**
   * Modifies the arguments before method execution.
   * Only works in before interceptor.
   *
   * @example
   * ```typescript
   * before: ctx => {
   *   const [a, b] = ctx.args;
   *   ctx.modifyArgs(a * 2, b * 2);  // Double all args
   * }
   * ```
   */
  modifyArgs: (...args: Parameters<TMethod>) => void;
}

export type ProxyBefore<TMethod extends (...args: any[]) => any, TStore = any> = (
  ctx: ProxyContext<TMethod, TStore>
) => void | Promise<void>;

export type ProxyAfter<TMethod extends (...args: any[]) => any, TStore = any> = (
  result: Awaited<ReturnType<TMethod>>,
  ctx: ProxyContext<TMethod, TStore>
) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>>;

export type ProxyError<TMethod extends (...args: any[]) => any, TStore = any> = (
  error: Error,
  ctx: ProxyContext<TMethod, TStore>
) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>> | never;

export type ProxyAround<TMethod extends (...args: any[]) => any, TStore = any> = (
  ctx: ProxyContext<TMethod, TStore>,
  next: () => Promise<Awaited<ReturnType<TMethod>>>
) => Promise<Awaited<ReturnType<TMethod>>>;

export type MethodPattern = string | RegExp;

/**
 * `'*'` - Proxies all methods of all plugins declared in `.depends()`
 *
 * @example
 * ```typescript
 * .depends(mathPlugin)
 * .depends(apiPlugin)
 * .proxy('*', { ... })  // Proxies both mathPlugin and apiPlugin
 * ```
 */
export type ProxyDependenciesWildcard = '*';

/**
 * `'**'` - Proxies all methods of ALL plugins in the kernel
 *
 * @example
 * ```typescript
 * .proxy('**', { ... })  // Proxies every plugin method in the application
 * ```
 */
export type ProxyGlobalWildcard = '**';

/**
 * Configuration for method interception with proxies.
 *
 * @example
 * ```typescript
 * const plugin = plugin('myPlugin', '1.0.0')
 *   .proxy({
 *     include: ['fetch*', 'save*'],
 *     before: ctx => console.log('Calling:', ctx.method),
 *     after: (result, ctx) => {
 *       console.log('Result:', result);
 *       return result;
 *     }
 *   })
 *   .setup(() => ({ ... }));
 * ```
 */
export interface ProxyConfig<TStore = any> {
  /**
   * Glob patterns or regex to include specific methods.
   * If not specified, all methods are included.
   *
   * @example
   * ```typescript
   * include: ['fetch*']        // All methods starting with 'fetch'
   * include: ['get*', 'set*']  // Multiple patterns
   * include: [/^(get|set)/]    // Using regex
   * ```
   */
  include?: MethodPattern[];

  /**
   * Glob patterns or regex to exclude specific methods.
   * Takes precedence over include patterns.
   *
   * @example
   * ```typescript
   * exclude: ['internal*']  // Exclude internal methods
   * exclude: [/_private$/]  // Exclude methods ending with _private
   * ```
   */
  exclude?: MethodPattern[];

  /**
   * Runs before the method execution.
   * Can skip execution or modify arguments using ctx helpers.
   *
   * @example
   * ```typescript
   * before: ctx => {
   *   console.log(`Calling ${ctx.method} with:`, ctx.args);
   *   // Skip execution conditionally
   *   if (someCondition) ctx.skip();
   *   // Or modify arguments
   *   ctx.modifyArgs(...newArgs);
   * }
   * ```
   */
  before?: ProxyBefore<any, TStore>;

  /**
   * Runs after successful method execution.
   * Can transform the result by returning a new value.
   *
   * @example
   * ```typescript
   * after: (result, ctx) => {
   *   console.log(`${ctx.method} returned:`, result);
   *   // Transform result
   *   return transformedResult;
   * }
   * ```
   */
  after?: ProxyAfter<any, TStore>;

  /**
   * Handles errors thrown during method execution.
   * Can return a fallback value or re-throw.
   *
   * @example
   * ```typescript
   * onError: (error, ctx) => {
   *   console.error(`${ctx.method} failed:`, error);
   *   // Return fallback
   *   return defaultValue;
   *   // Or re-throw
   *   throw new CustomError(error);
   * }
   * ```
   */
  onError?: ProxyError<any, TStore>;

  /**
   * Complete control over method execution.
   * Must call next() to execute the original method.
   *
   * @example
   * ```typescript
   * around: async (ctx, next) => {
   *   console.time(ctx.method);
   *   try {
   *     const result = await next();
   *     console.timeEnd(ctx.method);
   *     return result;
   *   } catch (error) {
   *     console.timeEnd(ctx.method);
   *     throw error;
   *   }
   * }
   * ```
   */
  around?: ProxyAround<any, TStore>;

  /**
   * Execution priority when multiple proxies target the same method.
   * Higher numbers execute first. Default: 0.
   *
   * @example
   * ```typescript
   * priority: 10  // Executes before priority 0 proxies
   * ```
   */
  priority?: number;

  /**
   * Conditional execution - proxy only runs if this returns true.
   *
   * @example
   * ```typescript
   * condition: ctx => ctx.args[0] > 100  // Only proxy if first arg > 100
   * ```
   */
  condition?: (ctx: ProxyContext<any, TStore>) => boolean;

  /**
   * Optional group name for organizing related proxies.
   *
   * @example
   * ```typescript
   * group: 'logging'  // Group all logging proxies together
   * ```
   */
  group?: string;
}

export type ProxyTarget = PluginId | 'self' | '*' | '**';

export interface ProxyMetadata {
  readonly targetPluginId: ProxyTarget;
  readonly config: ProxyConfig<any>;
}

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

export type ExtractMethodNames<TPlugin> = {
  [K in keyof TPlugin]: TPlugin[K] extends (...args: any[]) => any ? K : never;
}[keyof TPlugin];

export function matchesPattern(
  methodName: string,
  pattern: MethodPattern,
  maxLength = 200
): boolean {
  if (typeof pattern === 'string' && pattern.length > maxLength) {
    throw new Error(`Pattern too long: ${pattern.length} characters (max: ${maxLength})`);
  }

  if (methodName.length > maxLength) {
    throw new Error(`Method name too long: ${methodName.length} characters (max: ${maxLength})`);
  }

  if (pattern instanceof RegExp) {
    return pattern.test(methodName);
  }

  const regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]*');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(methodName);
}

export function validateProxyConfig(config: ProxyConfig, maxLength = 200): void {
  const patterns = [...(config.include || []), ...(config.exclude || [])];

  for (const pattern of patterns) {
    if (typeof pattern === 'string' && pattern.length > maxLength) {
      throw new Error(
        `Pattern too long: ${pattern.length} characters (max: ${maxLength}). ` +
          `This prevents potential ReDoS attacks.`
      );
    }
  }
}

export function shouldProxyMethod(methodName: string, config: ProxyConfig): boolean {
  if (config.include && config.include.length > 0) {
    const included = config.include.some((pattern: MethodPattern) =>
      matchesPattern(methodName, pattern)
    );
    if (!included) return false;
  }

  if (config.exclude && config.exclude.length > 0) {
    const excluded = config.exclude.some((pattern: MethodPattern) =>
      matchesPattern(methodName, pattern)
    );
    if (excluded) return false;
  }

  return true;
}

export function skipExecution<TStore = any>(ctx: ProxyContext<any, TStore>): void {
  ctx._skipExecution = true;
}

export function replaceResult<T, TStore = any>(ctx: ProxyContext<any, TStore>, result: T): void {
  ctx._skipExecution = true;
  ctx._overrideResult = result;
}

export function modifyArgs<TMethod extends (...args: any[]) => any, TStore = any>(
  ctx: ProxyContext<TMethod, TStore>,
  ...newArgs: Parameters<TMethod>
): void {
  ctx._modifiedArgs = newArgs;
}

export function enhanceContext<
  TMethod extends (...args: any[]) => any,
  TStore = Record<string, never>,
>(ctx: ProxyContext<TMethod, TStore>): ProxyContext<TMethod, TStore> {
  (ctx as any).skip = (): void => skipExecution(ctx);
  (ctx as any).replace = (result: Awaited<ReturnType<TMethod>>): void => replaceResult(ctx, result);
  (ctx as any).modifyArgs = (...args: Parameters<TMethod>): void => modifyArgs(ctx, ...args);

  return ctx;
}
