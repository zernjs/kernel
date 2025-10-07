/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PluginId } from '@/core';
import type { Store } from '@/store';

/**
 * Plugin access object exposed via ctx.plugins.<name>
 * Combines plugin API with $store and $meta access.
 */
export type ProxyPluginAccess<
  TApi = any,
  TStore extends Record<string, any> = any,
  TMetadata = any,
> = TApi & {
  /**
   * The plugin's reactive store (full Store object with ALL methods).
   * Includes ALL Store methods: watch(), watchAll(), watchBatch(), unwatch(),
   * batch(), transaction(), computed(), select(), getHistory(), clearHistory(),
   * undo(), redo(), reset(), getMetrics(), clearWatchers()
   *
   * @example
   * ```typescript
   * // Access reactive properties
   * ctx.plugins.math.$store.callCount++
   *
   * // Watch changes
   * ctx.plugins.math.$store.watch('callCount', (change) => {
   *   console.log(`Count: ${change.oldValue} → ${change.newValue}`);
   * });
   *
   * // Watch all changes
   * ctx.plugins.math.$store.watchAll((change) => {
   *   console.log(`${change.key} changed`);
   * });
   *
   * // Batch operations
   * ctx.plugins.math.$store.batch(() => {
   *   ctx.plugins.math.$store.x = 1;
   *   ctx.plugins.math.$store.y = 2;
   * });
   *
   * // Transactions with rollback
   * await ctx.plugins.math.$store.transaction(async () => {
   *   ctx.plugins.math.$store.value = 100;
   *   // If error, automatically rolls back
   * });
   *
   * // Computed values
   * const doubled = ctx.plugins.math.$store.computed(s => s.count * 2);
   * console.log(doubled.value);
   *
   * // Get metrics
   * const metrics = ctx.plugins.math.$store.getMetrics?.();
   * ```
   */
  readonly $store: Store<TStore>;

  /**
   * The plugin's metadata including name, version, and custom metadata.
   *
   * @example
   * ```typescript
   * console.log(ctx.plugins.math.$meta.name);     // "math"
   * console.log(ctx.plugins.math.$meta.version);  // "1.0.0"
   * console.log(ctx.plugins.math.$meta.author);   // Custom metadata
   * ```
   */
  readonly $meta: TMetadata & {
    readonly name: string;
    readonly version: string;
  };
};

/**
 * Helper type to wrap all plugins in a dependencies object with $store and $meta
 */
export type ProxyPluginsMap<TDeps extends Record<string, any>> = {
  [K in keyof TDeps]: TDeps[K] extends any ? ProxyPluginAccess<TDeps[K], any, any> : never;
};

/**
 * Context object provided to proxy interceptors.
 * Contains method information, arguments, store, and control helpers.
 *
 * @example
 * ```typescript
 * .proxy({
 *   before: ctx => {
 *     console.log(ctx.pluginName);           // Plugin being proxied
 *     console.log(ctx.method);               // Method being called
 *     console.log(ctx.store);                // YOUR plugin's store (full Store object)
 *     console.log(ctx.plugins.math.$store);  // Target plugin's store (full Store object)
 *     ctx.plugins.math.add(1, 2);            // Call target plugin methods
 *   }
 * })
 * ```
 */
export interface ProxyContext<
  TMethod extends (...args: any[]) => any,
  TStore extends Record<string, any> = any,
  TPlugins = Record<string, any>,
> {
  /**
   * Name of the plugin being proxied (string).
   *
   * @example
   * ```typescript
   * before: ctx => {
   *   console.log(ctx.pluginName); // "math"
   * }
   * ```
   */
  readonly pluginName: string;

  /**
   * Typed access to available plugin instances with their stores and metadata.
   * Each plugin object contains:
   * - `$store` - The plugin's reactive store
   * - `$meta` - The plugin's metadata
   * - Plugin API methods (add, multiply, etc.)
   *
   * Available plugins depend on proxy type:
   * - Single plugin proxy: Only the target plugin
   * - Wildcard '*': All dependency plugins
   * - Global '**': Record<string, any> (no typing)
   *
   * @example
   * ```typescript
   * // Single plugin proxy
   * .proxy(mathPlugin, {
   *   before: ctx => {
   *     // Access target plugin's store
   *     ctx.plugins.math.$store.callCount++;
   *
   *     // Access target plugin's metadata
   *     console.log(ctx.plugins.math.$meta.version);
   *
   *     // Call target plugin methods
   *     const result = ctx.plugins.math.add(1, 2);
   *   }
   * })
   *
   * // Wildcard '*' proxy
   * .depends(mathPlugin, '^1.0.0')
   * .depends(apiPlugin, '^1.0.0')
   * .proxy('*', {
   *   before: ctx => {
   *     ctx.plugins.math.$store.lastResult = 0;
   *     ctx.plugins.api.$store.requestCount++;
   *   }
   * })
   * ```
   */
  readonly plugins: TPlugins;

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
   * Reactive store of YOUR plugin (the one doing the proxy).
   * Full Store object with ALL methods: watch(), watchAll(), watchBatch(), unwatch(),
   * batch(), transaction(), computed(), select(), getHistory(), clearHistory(),
   * undo(), redo(), reset(), getMetrics(), clearWatchers()
   * This is NOT the target plugin's store - access target stores via ctx.plugins.<name>.$store
   *
   * @example
   * ```typescript
   * const loggingPlugin = plugin('logging', '1.0.0')
   *   .store(() => ({ logCount: 0, logs: [] }))
   *   .depends(mathPlugin, '^1.0.0')
   *   .proxy(mathPlugin, {
   *     before: ctx => {
   *       // YOUR store (loggingPlugin's store) - full Store object with ALL methods
   *       ctx.store.logCount++;
   *
   *       // Watch your own store changes
   *       ctx.store.watch('logCount', (change) => {
   *         console.log(`Log count: ${change.oldValue} → ${change.newValue}`);
   *       });
   *
   *       // Batch operations on your store
   *       ctx.store.batch(() => {
   *         ctx.store.logCount++;
   *         ctx.store.logs.push('New log');
   *       });
   *
   *       // Target plugin's store (mathPlugin's store) - also full Store object
   *       ctx.plugins.math.$store.callCount++;
   *
   *       // Watch target plugin's store
   *       ctx.plugins.math.$store.watch('callCount', (change) => {
   *         console.log(`Math called ${change.newValue} times`);
   *       });
   *
   *       // Use computed values from target plugin
   *       const doubled = ctx.plugins.math.$store.computed(s => s.callCount * 2);
   *       console.log(doubled.value);
   *     }
   *   })
   * ```
   */
  readonly store: Store<TStore>;

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

export type ProxyBefore<
  TMethod extends (...args: any[]) => any,
  TStore extends Record<string, any> = any,
  TPlugins = Record<string, any>,
> = (ctx: ProxyContext<TMethod, TStore, TPlugins>) => void | Promise<void>;

export type ProxyAfter<
  TMethod extends (...args: any[]) => any,
  TStore extends Record<string, any> = any,
  TPlugins = Record<string, any>,
> = (
  result: Awaited<ReturnType<TMethod>>,
  ctx: ProxyContext<TMethod, TStore, TPlugins>
) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>>;

export type ProxyError<
  TMethod extends (...args: any[]) => any,
  TStore extends Record<string, any> = any,
  TPlugins = Record<string, any>,
> = (
  error: Error,
  ctx: ProxyContext<TMethod, TStore, TPlugins>
) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>> | never;

export type ProxyAround<
  TMethod extends (...args: any[]) => any,
  TStore extends Record<string, any> = any,
  TPlugins = Record<string, any>,
> = (
  ctx: ProxyContext<TMethod, TStore, TPlugins>,
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
export interface ProxyConfig<
  TStore extends Record<string, any> = any,
  TPlugins = Record<string, any>,
> {
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
  before?: ProxyBefore<any, TStore, TPlugins>;

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
  after?: ProxyAfter<any, TStore, TPlugins>;

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
  onError?: ProxyError<any, TStore, TPlugins>;

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
  around?: ProxyAround<any, TStore, TPlugins>;

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
  condition?: (
    ctx: ProxyContext<any, TStore extends Record<string, any> ? TStore : any, TPlugins>
  ) => boolean;

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
  readonly sourcePluginId?: PluginId;
  readonly config: ProxyConfig<any>;
}

export interface CompiledMethodProxy {
  readonly targetPluginId: PluginId;
  readonly sourcePluginId?: PluginId;
  readonly methodName: string;
  readonly before?: ProxyBefore<any, any, any>;
  readonly after?: ProxyAfter<any, any, any>;
  readonly onError?: ProxyError<any, any, any>;
  readonly around?: ProxyAround<any, any, any>;
  readonly priority: number;
  readonly condition?: (ctx: ProxyContext<any, any, any>) => boolean;
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

export function skipExecution<
  TStore extends Record<string, any> = any,
  TPlugins = Record<string, any>,
>(ctx: ProxyContext<any, TStore, TPlugins>): void {
  ctx._skipExecution = true;
}

export function replaceResult<
  T,
  TStore extends Record<string, any> = any,
  TPlugins = Record<string, any>,
>(ctx: ProxyContext<any, TStore, TPlugins>, result: T): void {
  ctx._skipExecution = true;
  ctx._overrideResult = result;
}

export function modifyArgs<
  TMethod extends (...args: any[]) => any,
  TStore extends Record<string, any> = any,
  TPlugins = Record<string, any>,
>(ctx: ProxyContext<TMethod, TStore, TPlugins>, ...newArgs: Parameters<TMethod>): void {
  ctx._modifiedArgs = newArgs;
}

export function enhanceContext<
  TMethod extends (...args: any[]) => any,
  TStore extends Record<string, any> = Record<string, never>,
  TPlugins = Record<string, any>,
>(ctx: ProxyContext<TMethod, TStore, TPlugins>): ProxyContext<TMethod, TStore, TPlugins> {
  (ctx as any).skip = (): void => skipExecution(ctx as any);
  (ctx as any).replace = (result: Awaited<ReturnType<TMethod>>): void =>
    replaceResult(ctx as any, result);
  (ctx as any).modifyArgs = (...args: Parameters<TMethod>): void => modifyArgs(ctx as any, ...args);

  return ctx;
}
